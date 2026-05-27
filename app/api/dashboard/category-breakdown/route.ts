/**
 * GET /api/dashboard/category-breakdown
 * Get spending by category with percentages
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { getCategoryBreakdown } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching category breakdown");

    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    const result = await getCategoryBreakdown(
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined
    );

    // Calculate total for percentages
    const total = result.reduce(
      (sum, item) => sum + parseFloat(item.totalAmount || "0"),
      0
    );

    const breakdown = result.map((item) => ({
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      parentCategory: item.parentCategory,
      totalAmount: parseFloat(item.totalAmount || "0"),
      percentageOfTotal: total > 0 ? ((parseFloat(item.totalAmount || "0") / total) * 100).toFixed(1) : "0",
      movementCount: item.movementCount,
      color: item.color,
    }));

    return successResponse({
      breakdown,
    });
  } catch (error) {
    Logger.error("Failed to fetch category breakdown", error);
    return errorResponse(error);
  }
}
