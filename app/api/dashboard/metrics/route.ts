/**
 * GET /api/dashboard/metrics
 * Get key financial metrics
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { db } from "@/db";
import { movements, documents } from "@/db/schema";
import { sql, gte, lte } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching dashboard metrics");

    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    const conditions = [];
    if (startDate) conditions.push(gte(movements.transactionDate, startDate));
    if (endDate) conditions.push(lte(movements.transactionDate, endDate));

    const dateRange = {
      startDate: startDate || null,
      endDate: endDate || null,
    };

    // TODO: Implement metrics queries
    // - Total income, expenses, balance
    // - Movement count, document count
    // - Categorization percentage
    // - Average confidence

    return successResponse({
      totalIncome: 0,
      totalExpenses: 0,
      balance: 0,
      movementCount: 0,
      documentCount: 0,
      categorizedPercent: 0,
      averageConfidence: 0,
      dateRange,
    });
  } catch (error) {
    Logger.error("Failed to fetch metrics", error);
    return errorResponse(error);
  }
}

/**
 * GET /api/dashboard/uncategorized-count
 * Get count of movements awaiting categorization
 */
export async function getUncategorizedCount(request: NextRequest) {
  try {
    Logger.info("Fetching uncategorized count");

    // TODO: Implement uncategorized count query
    return successResponse({
      uncategorizedCount: 0,
    });
  } catch (error) {
    Logger.error("Failed to fetch uncategorized count", error);
    return errorResponse(error);
  }
}
