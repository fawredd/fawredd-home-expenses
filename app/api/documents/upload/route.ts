/**
 * POST /api/documents/upload
 * Upload one or multiple financial documents
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { documents, extractions, movements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jobQueue } from "@/lib/job-queue";
import {
  validateFile,
  validateMagicBytes,
  saveFile,
  generateUniqueFilename,
  getDateSubdirectory,
} from "@/lib/file-utils";
import { extractDocumentData } from "@/lib/extraction";
import { categorizeMovement } from "@/lib/categorization";
import { join } from "path";

// Register extraction job handler
jobQueue.registerHandler("extract", async (job) => {
  const { documentId } = job;
  if (!documentId) throw new Error("No documentId in job payload");

  try {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) throw new Error(`Document ${documentId} not found`);

    // Update status to processing
    await db
      .update(documents)
      .set({ processingStatus: "processing" })
      .where(eq(documents.id, documentId));

    // In Phase 2: implement actual file reading and OCR
    // For now: simulate extraction with sample data
    const sampleExtraction = {
      rawText: "SUPERMERCADO CARREFOUR\n28/05/2026\nCompra: $1,250.50",
      extractedDate: "2026-05-28",
      extractedAmount: 1250.5,
      extractedCurrency: "ARS",
      extractedVendor: "CARREFOUR EXPRESSS",
      extractedDocumentType: "receipt" as const,
      confidenceScores: { date: 0.95, amount: 0.9, vendor: 0.85 },
      overallConfidence: 0.9,
      errors: [],
    };

    // Store extraction
    const extractionRecord = await db
      .insert(extractions)
      .values({
        documentId,
        rawOcrText: sampleExtraction.rawText,
        extractedDate: sampleExtraction.extractedDate,
        extractedAmount: sampleExtraction.extractedAmount
          ? sampleExtraction.extractedAmount.toString()
          : null,
        extractedCurrency: sampleExtraction.extractedCurrency,
        extractedVendor: sampleExtraction.extractedVendor,
        extractedDocumentType: sampleExtraction.extractedDocumentType,
        confidenceScores: sampleExtraction.confidenceScores,
        overallConfidence: sampleExtraction.overallConfidence.toString(),
      })
      .returning();

    // Auto-categorize if we have vendor + date + amount
    if (sampleExtraction.extractedVendor && sampleExtraction.extractedDate) {
      const categorization = await categorizeMovement(
        sampleExtraction.extractedVendor,
        sampleExtraction.extractedAmount,
        sampleExtraction.extractedDate,
      );

      // Create movement
      const movementRecord = await db
        .insert(movements)
        .values({
          documentId,
          extractionId: extractionRecord[0].id,
          categoryId: categorization.categoryId,
          vendorName: sampleExtraction.extractedVendor,
          amount: sampleExtraction.extractedAmount.toString(),
          currency: sampleExtraction.extractedCurrency,
          transactionDate: sampleExtraction.extractedDate,
          movementType:
            sampleExtraction.extractedAmount > 0 ? "expense" : "income",
          description: `Auto-categorized via ${categorization.method}`,
          categorizationMethod: categorization.method,
          confidenceScore: categorization.confidence.toString(),
        })
        .returning();

      Logger.info(`Movement created from extraction`, {
        movementId: movementRecord[0].id,
        categoryId: categorization.categoryId,
        confidence: categorization.confidence,
      });
    }

    // Update document status
    await db
      .update(documents)
      .set({ processingStatus: "completed" })
      .where(eq(documents.id, documentId));

    Logger.info(`Extraction completed for document ${documentId}`);
  } catch (error) {
    Logger.error(`Extraction failed for document ${documentId}`, error);
    await db
      .update(documents)
      .set({
        processingStatus: "failed",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      })
      .where(eq(documents.id, documentId));
    throw error;
  }
});

export async function POST(request: NextRequest) {
  try {
    Logger.info("Document upload request received");

    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      throw HttpErrors.badRequest("No files provided");
    }

    if (files.length > 5) {
      throw HttpErrors.badRequest("Maximum 5 files per upload");
    }

    const uploadedDocuments = [];

    for (const file of files) {
      // Validate file
      const validation = validateFile(file);
      if (!validation.valid) {
        throw HttpErrors.badRequest(validation.error || "Invalid file");
      }

      // Read file buffer
      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      const buf = Buffer.from(uint8Array);

      // Validate magic bytes
      const magicBytesValid = await validateMagicBytes(buf);
      if (!magicBytesValid) {
        throw HttpErrors.badRequest(
          `El contenido del archivo no coincide con su extensión: ${file.name}`,
        );
      }

      // Save file to disk
      const storagePath = await saveFile(buf, file.name);
      Logger.info(`File saved to disk`, { path: storagePath, name: file.name });

      // Store document metadata in database
      const documentRecord = await db
        .insert(documents)
        .values({
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          filePath: storagePath,
          uploadStatus: "uploaded",
          processingStatus: "pending",
        })
        .returning();

      uploadedDocuments.push({
        id: documentRecord[0].id,
        filename: documentRecord[0].filename,
        fileSize: documentRecord[0].fileSize,
        mimeType: documentRecord[0].mimeType,
        uploadStatus: documentRecord[0].uploadStatus,
        uploadedAt: documentRecord[0].uploadedAt,
      });

      // Queue extraction job
      const jobId = jobQueue.enqueue(
        "extract",
        { documentId: documentRecord[0].id },
        {
          documentId: documentRecord[0].id,
          priority: 10,
          maxRetries: 3,
        },
      );

      Logger.info(`Document queued for extraction`, {
        documentId: documentRecord[0].id,
        jobId,
      });
    }

    return successResponse(
      { documents: uploadedDocuments },
      201,
      "Documentos subidos correctamente",
    );
  } catch (error) {
    Logger.error("Document upload failed", error);
    return errorResponse(error, 400);
  }
}
