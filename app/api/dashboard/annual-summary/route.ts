/**
 * GET /api/dashboard/annual-summary
 * Get annual income, expense, and balance summary
 */
import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  Logger,
  getCurrentUserId,
} from "@/lib/api-utils";
import { getAnnualSummary } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching annual summary");

    const userId = getCurrentUserId(request);
    const result = await getAnnualSummary(userId);

    return successResponse({
      summary: result.map((row) => ({
        year: row.year,
        totalIncome: parseFloat(row.totalIncome || "0"),
        totalExpenses: parseFloat(row.totalExpenses || "0"),
        balance:
          parseFloat(row.totalIncome || "0") -
          parseFloat(row.totalExpenses || "0"),
        movementCount: parseInt(row.movementCount || "0"),
      })),
    });
  } catch (error) {
    Logger.error("Failed to fetch annual summary", error);
    return errorResponse(error);
  }
}
