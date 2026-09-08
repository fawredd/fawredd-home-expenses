/**
 * Database utilities and query builders
 */
import { db } from "./index";
import { movements, categories, extractions, documents } from "./schema";
import { and, sql, desc, gte, lte, inArray, eq, isNull } from "drizzle-orm";

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
  userId,
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
  userId?: string;
}) {
  const conditions = [];

  if (startDate)
    conditions.push(
      gte(movements.transactionDate, startDate.toISOString().split("T")[0]),
    );
  if (endDate)
    conditions.push(
      lte(movements.transactionDate, endDate.toISOString().split("T")[0]),
    );

  if (categoryIds && categoryIds.length > 0) {
    conditions.push(inArray(movements.categoryId, categoryIds));
  }

  if (vendorSearch) {
    conditions.push(sql`${movements.vendorName} ILIKE ${`%${vendorSearch}%`}`);
  }

  if (minAmount !== undefined)
    conditions.push(sql`${movements.amount} >= ${minAmount}`);
  if (maxAmount !== undefined)
    conditions.push(sql`${movements.amount} <= ${maxAmount}`);

  if (movementType && movementType !== "all") {
    conditions.push(sql`${movements.movementType} = ${movementType}`);
  }

  if (userId) {
    conditions.push(eq(documents.userId, userId));
  }

  let orderBy;
  const orderDir = sortOrder === "asc" ? "asc" : "desc";
  switch (sortBy) {
    case "amount":
      orderBy = sortOrder === "asc" ? movements.amount : desc(movements.amount);
      break;
    case "vendor":
      orderBy =
        sortOrder === "asc" ? movements.vendorName : desc(movements.vendorName);
      break;
    case "category":
      orderBy =
        sortOrder === "asc" ? movements.categoryId : desc(movements.categoryId);
      break;
    case "date":
    default:
      orderBy =
        sortOrder === "asc"
          ? movements.transactionDate
          : desc(movements.transactionDate);
  }

  const query = db
    .select({
      id: movements.id,
      documentId: movements.documentId,
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
    .innerJoin(documents, sql`${movements.documentId} = ${documents.id}`)
    .leftJoin(categories, sql`${movements.categoryId} = ${categories.id}`);

  if (conditions.length > 0) {
    query.where(and(...conditions));
  }

  const total = await db
    .select({ count: sql<number>`count(*)` })
    .from(movements)
    .innerJoin(documents, sql`${movements.documentId} = ${documents.id}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined);

  const result = await query.orderBy(orderBy).limit(limit).offset(offset);

  return {
    movements: result,
    total: total[0]?.count || 0,
  };
}

/**
 * Get monthly summary
 */
export async function getMonthlySummary(year?: number, userId?: string) {
  const conditions = [];
  if (userId) {
    conditions.push(eq(documents.userId, userId));
  }
  if (year) {
    conditions.push(gte(movements.transactionDate, `${year}-01-01`));
    conditions.push(lte(movements.transactionDate, `${year}-12-31`));
  }

  const query = db
    .select({
      yearMonth: sql<string>`DATE_TRUNC('month', ${movements.transactionDate})`,
      totalIncome: sql<string>`SUM(CASE WHEN ${movements.movementType} = 'income' THEN ${movements.amount} ELSE 0 END)`,
      totalExpenses: sql<string>`SUM(CASE WHEN ${movements.movementType} = 'expense' THEN ${movements.amount} ELSE 0 END)`,
      balance: sql<string>`SUM(CASE WHEN ${movements.movementType} = 'income' THEN ${movements.amount} ELSE -${movements.amount} END)`,
      movementCount: sql<number>`COUNT(*)`,
    })
    .from(movements)
    .innerJoin(documents, sql`${movements.documentId} = ${documents.id}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`DATE_TRUNC('month', ${movements.transactionDate})`)
    .orderBy(desc(sql`DATE_TRUNC('month', ${movements.transactionDate})`))
    .limit(24);

  return query;
}

export async function getAnnualSummary(userId?: string) {
  const conditions = [];
  if (userId) {
    conditions.push(eq(documents.userId, userId));
  }

  return db
    .select({
      year: sql<string>`TO_CHAR(${movements.transactionDate}, 'YYYY')`,
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${movements.movementType} = 'income' THEN ${movements.amount} ELSE 0 END)::TEXT, '0')`,
      totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${movements.movementType} = 'expense' THEN ${movements.amount} ELSE 0 END)::TEXT, '0')`,
      movementCount: sql<string>`COUNT(*)::TEXT`,
    })
    .from(movements)
    .innerJoin(documents, sql`${movements.documentId} = ${documents.id}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(sql`TO_CHAR(${movements.transactionDate}, 'YYYY')`)
    .orderBy(sql`TO_CHAR(${movements.transactionDate}, 'YYYY') DESC`);
}

export async function getDashboardMetrics({
  userId,
  startDate,
  endDate,
}: {
  userId?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const movementConditions = [];
  const documentConditions = [];

  if (userId) {
    movementConditions.push(eq(documents.userId, userId));
    documentConditions.push(eq(documents.userId, userId));
  }

  if (startDate) {
    movementConditions.push(
      gte(movements.transactionDate, startDate.toISOString().split("T")[0]),
    );
    documentConditions.push(gte(documents.uploadedAt, startDate));
  }

  if (endDate) {
    movementConditions.push(
      lte(movements.transactionDate, endDate.toISOString().split("T")[0]),
    );
    documentConditions.push(lte(documents.uploadedAt, endDate));
  }

  const financialMetrics = await db
    .select({
      totalIncome: sql<string>`COALESCE(SUM(CASE WHEN ${movements.movementType} = 'income' THEN ${movements.amount} ELSE 0 END)::TEXT, '0')`,
      totalExpenses: sql<string>`COALESCE(SUM(CASE WHEN ${movements.movementType} = 'expense' THEN ${movements.amount} ELSE 0 END)::TEXT, '0')`,
      movementCount: sql<string>`COUNT(*)::TEXT`,
    })
    .from(movements)
    .innerJoin(documents, sql`${movements.documentId} = ${documents.id}`)
    .where(
      movementConditions.length > 0 ? and(...movementConditions) : undefined,
    );

  const documentMetrics = await db
    .select({
      documentCount: sql<string>`COUNT(*)::TEXT`,
      processedCount: sql<string>`COUNT(CASE WHEN processing_status = 'completed' THEN 1 END)::TEXT`,
    })
    .from(documents)
    .where(
      documentConditions.length > 0 ? and(...documentConditions) : undefined,
    );

  const categorizationMetrics = await db
    .select({
      categorizedCount: sql<string>`COUNT(CASE WHEN category_id IS NOT NULL THEN 1 END)::TEXT`,
      averageConfidence: sql<string>`COALESCE(AVG(confidence_score)::TEXT, '0')`,
    })
    .from(movements)
    .innerJoin(documents, sql`${movements.documentId} = ${documents.id}`)
    .where(
      movementConditions.length > 0 ? and(...movementConditions) : undefined,
    );

  return {
    financialMetrics: financialMetrics[0],
    documentMetrics: documentMetrics[0],
    categorizationMetrics: categorizationMetrics[0],
  };
}

/**
 * Get category breakdown
 */
export async function getCategoryBreakdown(
  startDate?: Date,
  endDate?: Date,
  userId?: string,
) {
  const conditions = [];
  if (startDate)
    conditions.push(
      gte(movements.transactionDate, startDate.toISOString().split("T")[0]),
    );
  if (endDate)
    conditions.push(
      lte(movements.transactionDate, endDate.toISOString().split("T")[0]),
    );
  if (userId) {
    conditions.push(eq(documents.userId, userId));
  }

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
    .innerJoin(documents, sql`${movements.documentId} = ${documents.id}`)
    .innerJoin(categories, sql`${movements.categoryId} = ${categories.id}`)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(
      categories.id,
      categories.name,
      categories.parentId,
      categories.color,
    )
    .orderBy(desc(sql`SUM(${movements.amount})`));

  return result;
}

/**
 * Count uncategorized movements
 */
export async function countUncategorized(userId?: string) {
  const conditions = [isNull(movements.categoryId)];
  if (userId) {
    conditions.push(eq(documents.userId, userId));
  }

  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(movements)
    .innerJoin(documents, sql`${movements.documentId} = ${documents.id}`)
    .where(and(...conditions));

  return result[0]?.count || 0;
}
