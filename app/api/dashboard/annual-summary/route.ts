/**
 * GET /api/dashboard/annual-summary
 * Get annual income, expense, and balance summary
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { db } from "@/db";
import { movements } from "@/db/schema";
import { sql } from "drizzle-orm";

export async function GET(request: NextRequest) {
  try {
    Logger.info("Fetching annual summary");

    const result = await db
      .select({
        year: sql<string>`TO_CHAR(${movements.transactionDate}, 'YYYY')`,
        totalIncome: sql<string>`COALESCE(SUM(CASE WHEN movement_type = 'income' THEN amount ELSE 0 END)::TEXT, '0')`,
        totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN movement_type = 'expense' THEN amount ELSE 0 END)::TEXT, '0')`,
        movementCount: sql<string>`COUNT(*)::TEXT`,
      })
      .from(movements)
      .groupBy(sql`TO_CHAR(${movements.transactionDate}, 'YYYY')`)
      .orderBy(sql`TO_CHAR(${movements.transactionDate}, 'YYYY') DESC`);

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
