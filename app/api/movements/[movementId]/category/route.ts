/**
 * GET /api/movements/[movementId]/category
 * Get current category and confidence for a movement
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { movements, categories } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { movementId: string } },
) {
  try {
    const { movementId } = params;
    Logger.info(`Fetching category for movement: ${movementId}`);

    const movement = await db
      .select({
        movementId: movements.id,
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
  { params }: { params: { movementId: string } },
) {
  try {
    const { movementId } = params;
    const body = await request.json();
    const { categoryId, reason } = body;

    Logger.info(`Updating category for movement: ${movementId}`, {
      categoryId,
    });

    // TODO: Validate categoryId exists
    // TODO: Update movement category
    // TODO: Create user correction record
    // TODO: Update RAG embeddings

    return successResponse({
      movementId,
      categoryId,
      message: "Category updated successfully",
    });
  } catch (error) {
    Logger.error("Failed to update movement category", error);
    return errorResponse(error);
  }
}
