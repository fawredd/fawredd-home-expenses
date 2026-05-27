/**
 * Database utilities and query builders
 */
import { db } from "./index";
import { movements, categories, extractions, documents } from "./schema";
import { and, sql, desc, gte, lte, inArray } from "drizzle-orm";

/**
 * Dashboard query builder - Get movements with filters
 */
export async function getDashboardMovements({
  startDate,
  endDate,
  categoryIds,
  vendorSearch,
  minAmount,
  maxAmount,
  movementType,
  sortBy = "date",
  sortOrder = "desc",
  limit = 50,
  offset = 0,
}: {
  startDate?: Date;
  endDate?: Date;
  categoryIds?: string[];
  vendorSearch?: string;
  minAmount?: number;
  maxAmount?: number;
  movementType?: "income" | "expense" | "all";
  sortBy?: "date" | "amount" | "vendor" | "category";
  sortOrder?: "asc" | "desc";
  limit?: number;
  offset?: number;
}) {
  const conditions = [];

  if (startDate)
    conditions.push(gte(movements.transactionDate, startDate.toISOString().split("T")[0]));
  if (endDate)
    conditions.push(lte(movements.transactionDate, endDate.toISOString().split("T")[0]));

  if (categoryIds && categoryIds.length > 0) {
    conditions.push(inArray(movements.categoryId, categoryIds));
  }

  if (vendorSearch) {
    conditions.push(
      sql`${movements.vendorName} ILIKE ${`%${vendorSearch}%`}`
    );
  }

  if (minAmount !== undefined)
    conditions.push(sql`${movements.amount} >= ${minAmount}`);
  if (maxAmount !== undefined)
    conditions.push(sql`${movements.amount} <= ${maxAmount}`);

  if (movementType && movementType !== "all") {
    conditions.push(sql`${movements.movementType} = ${movementType}`);
  }

  let orderBy;
  const orderDir = sortOrder === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "amount":
      orderBy = sortOrder === "asc" ? movements.amount : desc(movements.amount);
      break;
    case "vendor":
      orderBy = sortOrder === "asc" ? movements.vendorName : desc(movements.vendorName);
      break;
    case "category":
      orderBy = sortOrder === "asc" ? movements.categoryId : desc(movements.categoryId);
      break;
    case "date":
    default:
      orderBy = sortOrder === "asc" ? movements.transactionDate : desc(movements.transactionDate);
  }

  const query = db
    .select({
      id: movements.id,
      transactionDate: movements.transactionDate,
      vendor: movements.vendorName,
      amount: movements.amount,
      currency: movements.currency,
      categoryId: movements.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      movementType: movements.movementType,
      confidence: movements.confidenceScore,
      isReviewed: movements.isReviewed,
      description: movements.description,
    })
    .from(movements)
    .leftJoin(categories, sql`${movements.categoryId} = ${categories.id}`);

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(movements)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const result = await query
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return {
    movements: result,
    total: total[0]?.count || 0,
  };
}

/**
 * Get monthly summary
 */
export async function getMonthlySummary(year?: number) {
  const query = db
    .select({
      yearMonth: sql<string>`DATE_TRUNC('month', ${movements.transactionDate})`,
      totalIncome: sql<string>`SUM(CASE WHEN ${movements.movementType} = 'income' THEN ${movements.amount} ELSE 0 END)`,
      totalExpenses: sql<string>`SUM(CASE WHEN ${movements.movementType} = 'expense' THEN ${movements.amount} ELSE 0 END)`,
      balance: sql<string>`SUM(CASE WHEN ${movements.movementType} = 'income' THEN ${movements.amount} ELSE -${movements.amount} END)`,
      movementCount: sql<number>`COUNT(*)`,
    })
    .from(movements)
    .groupBy(sql`DATE_TRUNC('month', ${movements.transactionDate})`)
    .orderBy(desc(sql`DATE_TRUNC('month', ${movements.transactionDate})`))
    .limit(24);

  return query;
}

/**
 * Get category breakdown
 */
export async function getCategoryBreakdown(startDate?: Date, endDate?: Date) {
  const conditions = [];
  if (startDate)
    conditions.push(gte(movements.transactionDate, startDate.toISOString().split("T")[0]));
  if (endDate)
    conditions.push(lte(movements.transactionDate, endDate.toISOString().split("T")[0]));

  const result = await db
    .select({
      categoryId: categories.id,
      categoryName: categories.name,
      parentCategory: categories.parentId,
      totalAmount: sql<string>`SUM(${movements.amount})`,
      movementCount: sql<number>`COUNT(*)`,
      color: categories.color,
    })
    .from(movements)
    .innerJoin(categories, sql`${movements.categoryId} = ${categories.id}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(categories.id, categories.name, categories.parentId, categories.color)
    .orderBy(desc(sql`SUM(${movements.amount})`));

  return result;
}

/**
 * Count uncategorized movements
 */
export async function countUncategorized() {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(movements)
    .where(sql`${movements.categoryId} IS NULL OR ${movements.categoryId} = ''`);

  return result[0]?.count || 0;
}
