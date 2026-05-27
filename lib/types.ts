/**
 * Type definitions for the application
 */

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T> {
  total: number;
  limit: number;
  offset: number;
  items: T[];
}

// Document Types
export interface DocumentWithStatus {
  id: string;
  filename: string;
  fileSize: number;
  mimeType: string;
  uploadStatus: "uploaded" | "processing" | "completed" | "failed";
  processingStatus:
    | "pending"
    | "extracting"
    | "categorizing"
    | "done"
    | "error";
  uploadedAt: string;
  processedAt?: string;
  errorMessage?: string;
}

// Extraction Types
export interface ExtractionResult {
  id: string;
  documentId: string;
  extractedDate?: string;
  extractedAmount?: number;
  extractedCurrency?: string;
  extractedVendor?: string;
  extractedDocumentType?:
    | "receipt"
    | "invoice"
    | "statement"
    | "ticket"
    | "other";
  extractedDescription?: string;
  confidenceScores: Record<string, number>;
  overallConfidence: number;
  extractionMethod: "ocr" | "manual" | "api";
  extractedAt: string;
}

// Movement Types
export interface MovementWithCategory {
  id: string;
  transactionDate: string;
  vendor?: string;
  amount: number;
  currency: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  movementType: "income" | "expense";
  confidence?: number;
  isReviewed: boolean;
  description?: string;
}

// Category Types
export interface Category {
  id: string;
  name: string;
  description?: string;
  parentId?: string;
  color?: string;
  icon?: string;
  isActive: boolean;
  movementCount?: number;
}

// Dashboard Types
export interface DashboardMetrics {
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  movementCount: number;
  documentCount: number;
  categorizedPercent: number;
  averageConfidence: number;
}

export interface MonthlySummary {
  yearMonth: string;
  month: number;
  year: number;
  totalIncome: number;
  totalExpenses: number;
  balance: number;
  movementCount: number;
  changePercent?: number;
}

export interface CategoryBreakdown {
  categoryId: string;
  categoryName: string;
  parentCategory?: string;
  totalAmount: number;
  percentageOfTotal: number;
  movementCount: number;
  color?: string;
}

// Error Types
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public code?: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const ErrorCodes = {
  // File upload errors
  INVALID_FILE_TYPE: "INVALID_FILE_TYPE",
  FILE_TOO_LARGE: "FILE_TOO_LARGE",
  FILE_UPLOAD_FAILED: "FILE_UPLOAD_FAILED",

  // Extraction errors
  EXTRACTION_FAILED: "EXTRACTION_FAILED",
  OCR_FAILED: "OCR_FAILED",
  PARSING_FAILED: "PARSING_FAILED",

  // Categorization errors
  CATEGORIZATION_FAILED: "CATEGORIZATION_FAILED",
  AI_UNAVAILABLE: "AI_UNAVAILABLE",

  // Database errors
  NOT_FOUND: "NOT_FOUND",
  DUPLICATE_ENTRY: "DUPLICATE_ENTRY",
  DATABASE_ERROR: "DATABASE_ERROR",

  // Validation errors
  VALIDATION_ERROR: "VALIDATION_ERROR",
  INVALID_REQUEST: "INVALID_REQUEST",

  // Server errors
  INTERNAL_ERROR: "INTERNAL_ERROR",
  SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
};

// Request/Response Schemas (for Zod validation)
import { z } from "zod";

export const DocumentUploadSchema = z.object({
  files: z.array(z.instanceof(File)).min(1).max(5),
});

export const UpdateExtractionSchema = z.object({
  extractedDate: z.string().date(),
  extractedAmount: z.number().positive(),
  extractedCurrency: z.string().length(3).toUpperCase(),
  extractedVendor: z.string().min(1).max(255),
  extractedDocumentType: z
    .enum(["receipt", "invoice", "statement", "ticket", "other"])
    .optional(),
  extractedDescription: z.string().optional(),
});

export const UpdateCategorySchema = z.object({
  categoryId: z.string().uuid(),
  reason: z.string().optional(),
});

export const DashboardFilterSchema = z.object({
  startDate: z.string().date().optional(),
  endDate: z.string().date().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
  vendorSearch: z.string().max(255).optional(),
  minAmount: z.number().min(0).optional(),
  maxAmount: z.number().min(0).optional(),
  movementType: z.enum(["income", "expense", "all"]).optional(),
  sortBy: z.enum(["date", "amount", "vendor", "category"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

export type DocumentUpload = z.infer<typeof DocumentUploadSchema>;
export type UpdateExtraction = z.infer<typeof UpdateExtractionSchema>;
export type UpdateCategory = z.infer<typeof UpdateCategorySchema>;
export type DashboardFilter = z.infer<typeof DashboardFilterSchema>;
