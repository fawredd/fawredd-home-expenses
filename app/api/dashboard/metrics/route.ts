/**
 * GET /api/dashboard/metrics
 * Get key financial metrics
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { db } from "@/db";
import { movements, documents, categories } from "@/db/schema";
import { sql, gte, lte, eq } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching dashboard metrics");

    const startDate = request.nextUrl.searchParams.get("startDate");
    const endDate = request.nextUrl.searchParams.get("endDate");

    // Build conditions for date range
    const dateFilters = [];
    if (startDate)
      dateFilters.push(gte(movements.transactionDate, startDate));
    if (endDate)
      dateFilters.push(lte(movements.transactionDate, endDate));

    // Get financial metrics
    const financialMetrics = await db
      .select({
        totalIncome: sql<string>`COALESCE(SUM(CASE WHEN movement_type = 'income' THEN amount ELSE 0 END)::TEXT, '0')`,
        totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN movement_type = 'expense' THEN amount ELSE 0 END)::TEXT, '0')`,
        movementCount: sql<string>`COUNT(*)::TEXT`,
      })
      .from(movements)
      .where(
        dateFilters.length > 0
          ? sql`${sql.join(dateFilters, sql` AND `)}`
          : undefined,
      );

    // Get document count
    const documentMetrics = await db
      .select({
        documentCount: sql<string>`COUNT(*)::TEXT`,
        processedCount: sql<string>`COUNT(CASE WHEN processing_status = 'completed' THEN 1 END)::TEXT`,
      })
      .from(documents)
      .where(
        dateFilters.length > 0
          ? sql`${sql.join(dateFilters, sql` AND `)}`
          : undefined,
      );

    // Get categorization metrics
    const categorizationMetrics = await db
      .select({
        categorizedCount: sql<string>`COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END)::TEXT`,
        averageConfidence: sql<string>`COALESCE(AVG(confidence_score)::TEXT, '0')`,
      })
      .from(movements)
      .where(
        dateFilters.length > 0
          ? sql`${sql.join(dateFilters, sql` AND `)}`
          : undefined,
      );

    const totalIncome = parseFloat(financialMetrics[0]?.totalIncome || "0");
    const totalExpenses = parseFloat(financialMetrics[0]?.totalExpenses || "0");
    const movementCount = parseInt(financialMetrics[0]?.movementCount || "0");
    const documentCount = parseInt(documentMetrics[0]?.documentCount || "0");
    const processedCount = parseInt(documentMetrics[0]?.processedCount || "0");
    const categorizedCount = parseInt(
      categorizationMetrics[0]?.categorizedCount || "0",
    );
    const averageConfidence = parseFloat(
      categorizationMetrics[0]?.averageConfidence || "0",
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
