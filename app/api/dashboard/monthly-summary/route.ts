/**
 * GET /api/dashboard/monthly-summary
 * Get monthly income, expense, and balance summary
 */
import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  Logger,
  getCurrentUserId,
} from "@/lib/api-utils";
import { getMonthlySummary } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching monthly summary");

    const userId = getCurrentUserId(request);
    const year = request.nextUrl.searchParams.get("year");
    const result = await getMonthlySummary(
      year ? parseInt(year) : undefined,
      userId,
    );

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
