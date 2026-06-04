/**
 * POST /api/documents/upload
 * Upload one or multiple financial documents
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger, getCurrentUserId } from "@/lib/api-utils";
import { HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { documents, extractions, movements } from "@/db/schema";
import { eq } from "drizzle-orm";
import { jobQueue } from "@/lib/job-queue";
import {
  validateFile,
  validateMagicBytes,
  saveFile,
  getFile,
} from "@/lib/file-utils";
import { extractDocumentData } from "@/lib/extraction";
import { categorizeMovement } from "@/lib/categorization";

// Register extraction job handler
jobQueue.registerHandler("extract", async (job) => {
  const { documentId } = job;
  if (!documentId) throw new Error("No documentId in job payload");

  try {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) throw new Error(`Document ${documentId} not found`);

    await db
      .update(documents)
      .set({ processingStatus: "extracting" })
      .where(eq(documents.id, documentId));

    const fileBuffer = await getFile(doc.filePath);
    const extractionData = await extractDocumentData(fileBuffer, doc.mimeType);

    const extractionRecord = await db
      .insert(extractions)
      .values({
        documentId,
        rawOcrText: extractionData.rawText,
        extractedDate: extractionData.extractedDate,
        extractedAmount: extractionData.extractedAmount
          ? extractionData.extractedAmount.toString()
          : null,
        extractedCurrency: extractionData.extractedCurrency,
        extractedVendor: extractionData.extractedVendor,
        extractedDocumentType: extractionData.extractedDocumentType,
        confidenceScores: extractionData.confidenceScores,
        overallConfidence: extractionData.overallConfidence.toString(),
        extractionErrors: extractionData.errors,
        extractionMethod: extractionData.extractionMethod,
      })
      .returning();

    if (extractionData.extractedDate && extractionData.extractedAmount) {
      const categorization = await categorizeMovement(
        extractionData.extractedVendor,
        extractionData.extractedAmount,
        extractionData.extractedDate,
        extractionData.rawText,
      );

      await db.insert(movements).values({
        documentId,
        extractionId: extractionRecord[0].id,
        categoryId: categorization.categoryId,
        vendorName: extractionData.extractedVendor,
        amount: extractionData.extractedAmount.toString(),
        currency: extractionData.extractedCurrency,
        transactionDate: extractionData.extractedDate,
        movementType: extractionData.extractedAmount > 0 ? "expense" : "income",
        description: `Auto-categorized via ${categorization.method}`,
        categorizationMethod: categorization.method,
        confidenceScore: categorization.confidence.toString(),
      });

      Logger.info(`Movement created from extraction`, {
        documentId,
        categoryId: categorization.categoryId,
        confidence: categorization.confidence,
      });
    }

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

    const userId = getCurrentUserId(request);
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
          userId,
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
