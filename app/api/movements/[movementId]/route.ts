import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import {
  successResponse,
  errorResponse,
  Logger,
  HttpErrors,
} from "@/lib/api-utils";
import { db } from "@/db";
import { movements, categories, userCorrections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UpdateMovementSchema } from "@/lib/types";
import { recordSuccessfulCategorization } from "@/lib/categorization";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ movementId: string }> },
) {
  try {
    const { movementId } = await params;
    const rawBody = await request.json();
    const { categoryId, vendorName, amount, transactionDate, reason } =
      UpdateMovementSchema.parse(rawBody);

    Logger.info(`Updating movement: ${movementId}`);

    const movement = await db.query.movements.findFirst({
      where: eq(movements.id, movementId),
    });

    if (!movement) {
      throw HttpErrors.notFound("Movement");
    }

    const updates: Partial<typeof movements.$inferInsert> = {
      isManualCorrection: true,
      correctedAt: new Date(),
      isReviewed: true,
    };

    if (vendorName) updates.vendorName = vendorName;
    if (amount) updates.amount = amount.toString();
    if (transactionDate) updates.transactionDate = transactionDate;
    if (categoryId) {
      updates.categoryId = categoryId;
      updates.correctedCategoryId = categoryId;

      const category = await db.query.categories.findFirst({
        where: eq(categories.id, categoryId),
      });

      if (!category) {
        throw HttpErrors.notFound("Category");
      }

      const correctionKey = createHash("sha256")
        .update(
          JSON.stringify({
            movementId,
            categoryId,
            vendorName: vendorName ?? movement.vendorName,
            amount: amount ?? movement.amount,
            transactionDate: transactionDate ?? movement.transactionDate,
            reason: reason ?? "",
          }),
        )
        .digest("hex");

      await db
        .insert(userCorrections)
        .values({
          movementId,
          newCategoryId: categoryId,
          oldCategoryId: movement.categoryId ?? undefined,
          reason: reason ?? undefined,
          correctionKey,
        })
        .onConflictDoNothing({ target: userCorrections.correctionKey });

      const updatedVendor = vendorName || movement.vendorName || "";
      await recordSuccessfulCategorization(
        updatedVendor,
        categoryId,
        movementId,
      );
    } else if (vendorName && movement.categoryId) {
      // If vendor changed but category didn't, still record it as a successful categorization for RAG learning
      await recordSuccessfulCategorization(
        vendorName,
        movement.categoryId,
        movementId,
      );
    }

    const updated = await db
      .update(movements)
      .set(updates)
      .where(eq(movements.id, movementId))
      .returning();

    return successResponse(
      updated[0],
      200,
      "Movimiento actualizado correctamente",
    );
  } catch (error) {
    Logger.error("Failed to update movement", error);
    return errorResponse(error);
  }
}
