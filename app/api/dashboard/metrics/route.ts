/**
 * GET /api/dashboard/metrics
 * Get key financial metrics
 */
import { NextRequest } from "next/server";
import {
  successResponse,
  errorResponse,
  Logger,
  getCurrentUserId,
} from "@/lib/api-utils";
import { getDashboardMetrics } from "@/db/queries";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching dashboard metrics");

    const userId = getCurrentUserId(request);
    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");
    const metrics = await getDashboardMetrics({
      userId,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
    });

    const totalIncome = parseFloat(
      metrics.financialMetrics?.totalIncome || "0",
    );
    const totalExpenses = parseFloat(
      metrics.financialMetrics?.totalExpenses || "0",
    );
    const movementCount = parseInt(
      metrics.financialMetrics?.movementCount || "0",
    );
    const documentCount = parseInt(
      metrics.documentMetrics?.documentCount || "0",
    );
    const processedCount = parseInt(
      metrics.documentMetrics?.processedCount || "0",
    );
    const categorizedCount = parseInt(
      metrics.categorizationMetrics?.categorizedCount || "0",
    );
    const averageConfidence = parseFloat(
      metrics.categorizationMetrics?.averageConfidence || "0",
    );

    const categorizedPercent =
      movementCount > 0
        ? ((categorizedCount / movementCount) * 100).toFixed(1)
        : "0";

    return successResponse({
      totalIncome,
      totalExpenses,
      balance: totalIncome - totalExpenses,
      movementCount,
      documentCount,
      processedDocuments: processedCount,
      categorizedMovements: categorizedCount,
      categorizedPercent: parseFloat(categorizedPercent),
      averageConfidence: parseFloat(averageConfidence.toString()),
      dateRange: {
        startDate: startDate || null,
        endDate: endDate || null,
      },
    });
  } catch (error) {
    Logger.error("Failed to fetch metrics", error);
    return errorResponse(error);
  }
}
