import {
  pgSchema,
  AnyPgColumn,
  uuid,
  varchar,
  integer,
  decimal,
  text,
  timestamp,
  boolean,
  date,
  jsonb,
  index,
  uniqueIndex,
  foreignKey,
  customType,
} from "drizzle-orm/pg-core";

import { sql } from "drizzle-orm";

// Enum values as constants (using varchar instead of native enums for MVP)
const uploadStatusEnum = [
  "uploaded",
  "processing",
  "completed",
  "failed",
] as const;
const processingStatusEnum = [
  "pending",
  "extracting",
  "categorizing",
  "done",
  "error",
] as const;
const movementTypeEnum = ["income", "expense"] as const;
const jobStatusEnum = [
  "pending",
  "processing",
  "completed",
  "failed",
  "retry",
] as const;
const categorizationMethodEnum = ["rule", "rag", "ai", "manual"] as const;

// Custom pgvector type for embeddings
const vector = (name: string, dimensions: number) =>
  customType<{ data: number[]; driverData: string }>({
    dataType() {
      return `vector(${dimensions})`;
    },
    toDriver(value: number[]): string {
      return `[${value.join(",")}]`;
    },
    fromDriver(value: string): number[] {
      return value
        .replace(/[\[\]]/g, "")
        .split(",")
        .map(Number);
    },
  })(name);

export const appSchema = pgSchema(
  process.env.DB_SCHEMA || "fawredd_home_expenses",
);

// Tables

/**
 * Documents table - Stores metadata about uploaded files
 */
export const documents = appSchema.table(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    filename: varchar("filename", { length: 255 }).notNull(),
    fileSize: integer("file_size").notNull(),
    mimeType: varchar("mime_type", { length: 50 }).notNull(),
    filePath: text("file_path").notNull(),
    uploadStatus: varchar("upload_status", { length: 50 })
      .notNull()
      .default("uploaded"),
    processingStatus: varchar("processing_status", { length: 50 })
      .notNull()
      .default("pending"),
    uploadedAt: timestamp("uploaded_at").notNull().defaultNow(),
    processedAt: timestamp("processed_at"),
    errorMessage: text("error_message"),
    userId: varchar("user_id", { length: 255 }), // Clerk user IDs are string-based
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => {
    return {
      uploadedAtIdx: index("idx_documents_uploaded_at").on(
        sql`${table.uploadedAt} DESC`,
      ),
      uploadStatusIdx: index("idx_documents_upload_status").on(
        table.uploadStatus,
      ),
      userIdIdx: index("idx_documents_user_id").on(table.userId),
    };
  },
);

/**
 * Extractions table - Stores OCR and parsing results
 */
export const extractions = appSchema.table(
  "extractions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    rawOcrText: text("raw_ocr_text"),
    extractedDate: date("extracted_date"),
    extractedAmount: decimal("extracted_amount", { precision: 15, scale: 2 }),
    extractedCurrency: varchar("extracted_currency", { length: 3 }),
    extractedVendor: varchar("extracted_vendor", { length: 255 }),
    extractedCuit: varchar("extracted_cuit", { length: 20 }),
    extractedDocumentType: varchar("extracted_document_type", { length: 50 }),
    extractedDescription: text("extracted_description"),
    confidenceScores: jsonb("confidence_scores")
      .notNull()
      .default(sql`'{}'`),
    overallConfidence: decimal("overall_confidence", {
      precision: 3,
      scale: 2,
    }).notNull(),
    extractionErrors: jsonb("extraction_errors"),
    extractionMethod: varchar("extraction_method", { length: 50 })
      .notNull()
      .default("ocr"),
    extractedAt: timestamp("extracted_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      documentIdIdx: index("idx_extractions_document_id").on(table.documentId),
      overallConfidenceIdx: index("idx_extractions_overall_confidence").on(
        sql`${table.overallConfidence} DESC`,
      ),
    };
  },
);

/**
 * Categories table - Hierarchical taxonomy of expense/income categories
 */
export const categories = appSchema.table(
  "categories",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 100 }).notNull().unique(),
    description: text("description"),
    parentId: uuid("parent_id").references((): AnyPgColumn => categories.id, {
      onDelete: "set null",
    }),
    color: varchar("color", { length: 7 }),
    icon: varchar("icon", { length: 50 }),
    isActive: boolean("is_active").notNull().default(true),
    sortOrder: integer("sort_order"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => {
    return {
      parentIdIdx: index("idx_categories_parent_id").on(table.parentId),
      isActiveIdx: index("idx_categories_is_active").on(table.isActive),
    };
  },
);

/**
 * Movements table - Core financial transactions (extracted and categorized)
 */
export const movements = appSchema.table(
  "movements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    extractionId: uuid("extraction_id")
      .notNull()
      .references(() => extractions.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    transactionDate: date("transaction_date").notNull(),
    vendorName: varchar("vendor_name", { length: 255 }),
    amount: decimal("amount", { precision: 15, scale: 2 }).notNull(),
    currency: varchar("currency", { length: 3 }).notNull().default("ARS"),
    movementType: varchar("movement_type", { length: 50 }).notNull(),
    description: text("description"),
    confidenceScore: decimal("confidence_score", {
      precision: 3,
      scale: 2,
    }),
    categorizationMethod: varchar("categorization_method", { length: 50 }),
    isReviewed: boolean("is_reviewed").notNull().default(false),
    isManualCorrection: boolean("is_manual_correction")
      .notNull()
      .default(false),
    correctedAt: timestamp("corrected_at"),
    correctedCategoryId: uuid("corrected_category_id").references(
      () => categories.id,
      { onDelete: "set null" },
    ),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => {
    return {
      transactionDateIdx: index("idx_movements_transaction_date").on(
        sql`${table.transactionDate} DESC`,
      ),
      categoryIdIdx: index("idx_movements_category_id").on(table.categoryId),
      vendorNameIdx: index("idx_movements_vendor_name").on(table.vendorName),
      movementTypeIdx: index("idx_movements_movement_type").on(
        table.movementType,
      ),
      isReviewedIdx: index("idx_movements_is_reviewed").on(table.isReviewed),
    };
  },
);

/**
 * RAG Embeddings table - Vector store for categorization memory
 * Requires pgvector extension
 */
export const ragEmbeddings = appSchema.table(
  "rag_embeddings",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    movementId: uuid("movement_id")
      .notNull()
      .references(() => movements.id, { onDelete: "cascade" }),
    vendorName: varchar("vendor_name", { length: 255 }).notNull(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    embedding: vector("embedding", 384).notNull(), // pgvector column
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      vendorNameIdx: index("idx_rag_embeddings_vendor").on(table.vendorName),
    };
  },
);

/**
 * Extraction Memory table - RAG-guided extraction hints per vendor/cuit/doc-type
 * Stores HOW to extract data from a specific document profile so the app learns
 */
export const extractionMemory = appSchema.table(
  "extraction_memory",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    vendorName: varchar("vendor_name", { length: 255 }).notNull(),
    cuit: varchar("cuit", { length: 20 }),
    documentType: varchar("document_type", { length: 50 }).notNull(),
    embedding: vector("embedding", 384).notNull(),
    extractionHints: jsonb("extraction_hints").notNull().default(sql`'{}'`),
    sampleRawText: text("sample_raw_text"),
    usageCount: integer("usage_count").notNull().default(0),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => {
    return {
      vendorNameIdx: index("idx_extraction_memory_vendor").on(table.vendorName),
      cuitIdx: index("idx_extraction_memory_cuit").on(table.cuit),
      documentTypeIdx: index("idx_extraction_memory_doc_type").on(table.documentType),
    };
  },
);

/**
 * User Corrections table - Track user feedback for learning and audit
 */
export const userCorrections = appSchema.table(
  "user_corrections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    movementId: uuid("movement_id")
      .notNull()
      .references(() => movements.id, { onDelete: "cascade" }),
    oldCategoryId: uuid("old_category_id").references(() => categories.id, {
      onDelete: "set null",
    }),
    newCategoryId: uuid("new_category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    reason: text("reason"),
    correctedAt: timestamp("corrected_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => {
    return {
      movementIdIdx: index("idx_user_corrections_movement_id").on(
        table.movementId,
      ),
      correctedAtIdx: index("idx_user_corrections_corrected_at").on(
        table.correctedAt,
      ),
    };
  },
);

/**
 * Processing Jobs table - Background job tracking (pg-boss integration)
 */
export const processingJobs = appSchema.table(
  "processing_jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id").references(() => documents.id, {
      onDelete: "set null",
    }),
    movementId: uuid("movement_id").references(() => movements.id, {
      onDelete: "set null",
    }),
    jobType: varchar("job_type", { length: 50 }).notNull(),
    jobStatus: varchar("job_status", { length: 50 })
      .notNull()
      .default("pending"),
    priority: integer("priority").default(0),
    retryCount: integer("retry_count").default(0),
    errorDetails: jsonb("error_details"),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at")
      .notNull()
      .defaultNow()
      .$onUpdateFn(() => new Date()),
  },
  (table) => {
    return {
      jobStatusIdx: index("idx_processing_jobs_status").on(table.jobStatus),
      documentIdIdx: index("idx_processing_jobs_document_id").on(
        table.documentId,
      ),
      createdAtIdx: index("idx_processing_jobs_created_at").on(
        sql`${table.createdAt} DESC`,
      ),
    };
  },
);

/**
 * Sessions table - For future authentication support (Phase 2)
 */
export const sessions = appSchema.table("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: varchar("user_id", { length: 255 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});
