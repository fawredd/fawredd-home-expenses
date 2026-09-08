/**
 * GET /api/movements/[movementId]/category
 * Get current category and confidence for a movement
 */
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { categories, movements, userCorrections } from "@/db/schema";
import { eq } from "drizzle-orm";
import { UpdateCategorySchema } from "@/lib/types";
import { recordSuccessfulCategorization } from "@/lib/categorization";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ movementId: string }> },
) {
  try {
    const { movementId } = await params;
    Logger.info(`Fetching category for movement: ${movementId}`);

    const movement = await db
      .select({
        movementId: movements.id,
        amount: movements.amount,
        vendor: movements.vendorName,
        transactionDate: movements.transactionDate,
        categoryId: movements.categoryId,
        categoryName: categories.name,
        confidence: movements.confidenceScore,
        method: movements.categorizationMethod,
        isManualCorrection: movements.isManualCorrection,
        correctedAt: movements.correctedAt,
      })
      .from(movements)
      .leftJoin(categories, eq(movements.categoryId, categories.id))
      .where(eq(movements.id, movementId));

    if (movement.length === 0) {
      throw HttpErrors.notFound("Movement");
    }

    return successResponse(movement[0]);
  } catch (error) {
    Logger.error("Failed to fetch movement category", error);
    return errorResponse(error);
  }
}

/**
 * PUT /api/movements/[movementId]/category
 * Manually assign or correct movement category
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ movementId: string }> },
) {
  try {
    const { movementId } = await params;
    const rawBody = await request.json();
    const { categoryId, reason } = UpdateCategorySchema.parse(rawBody);

    Logger.info(`Updating category for movement: ${movementId}`, {
      categoryId,
    });

    // Get the movement
    const movement = await db.query.movements.findFirst({
      where: eq(movements.id, movementId),
    });

    if (!movement) {
      throw HttpErrors.notFound("Movement");
    }

    // Verify category exists
    const category = await db.query.categories.findFirst({
      where: eq(categories.id, categoryId),
    });

    if (!category) {
      throw HttpErrors.notFound("Category");
    }

    // Update movement with corrected category
    await db
      .update(movements)
      .set({
        categoryId,
        correctedCategoryId: categoryId,
        isManualCorrection: true,
        correctedAt: new Date(),
        isReviewed: true,
      })
      .where(eq(movements.id, movementId))
      .returning();

    const correctionValues: {
      movementId: string;
      newCategoryId: string;
      oldCategoryId?: string;
      reason?: string;
    } = {
      movementId,
      newCategoryId: categoryId,
      reason: reason ?? undefined,
    };

    if (movement.categoryId) {
      correctionValues.oldCategoryId = movement.categoryId;
    }

    const correctionKey = createHash("sha256")
      .update(JSON.stringify({ movementId, categoryId, reason: reason ?? "" }))
      .digest("hex");

    await db
      .insert(userCorrections)
      .values({ ...correctionValues, correctionKey })
      .onConflictDoNothing({ target: userCorrections.correctionKey });

    await recordSuccessfulCategorization(
      movement.vendorName ?? "",
      categoryId,
      movementId,
    );

    Logger.info(`Movement category updated`, {
      movementId,
      oldCategory: movement.categoryId ?? undefined,
      newCategory: categoryId,
    });

    return successResponse(
      {
        movementId,
        categoryId,
        categoryName: category.name,
        message: "Category updated successfully",
      },
      200,
      "Categoría actualizada correctamente",
    );
  } catch (error) {
    Logger.error("Failed to update movement category", error);
    return errorResponse(error);
  }
}
