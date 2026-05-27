/**
 * GET /api/dashboard/monthly-summary
 * Get monthly income, expense, and balance summary
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { getMonthlySummary } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching monthly summary");

    const year = request.nextUrl.searchParams.get("year");
    const result = await getMonthlySummary(year ? parseInt(year) : undefined);

    return successResponse({
      summary: result.map((row) => ({
        yearMonth: row.yearMonth,
        totalIncome: parseFloat(row.totalIncome || "0"),
        totalExpenses: parseFloat(row.totalExpenses || "0"),
        balance: parseFloat(row.balance || "0"),
        movementCount: row.movementCount,
      })),
    });
  } catch (error) {
    Logger.error("Failed to fetch monthly summary", error);
    return errorResponse(error);
  }
}

/**
 * GET /api/dashboard/annual-summary
 * Get annual income, expense, and balance summary
 */

export async function getAnnualSummary(request: NextRequest) {
  try {
    Logger.info("Fetching annual summary");

    // TODO: Implement annual summary query
    return successResponse({
      summary: [],
    });
  } catch (error) {
    Logger.error("Failed to fetch annual summary", error);
    return errorResponse(error);
  }
}
