/**
 * POST /api/documents/upload
 * Upload one or multiple financial documents
 *
 * NEW FLOW (TASK-046):
 *  1. Extract raw text + initial field inference
 *  2. Query extraction_memory by CUIT + document_type
 *  3a. Memory found (≥ 85% confidence) → hinted AI extraction → create movement → reinforce memory
 *  3b. No memory → save partial extraction → set processingStatus = "awaiting_review"
 *  4. User review endpoint (PUT /api/documents/[id]/review) completes movement creation + records memory
 */
import { NextRequest } from "next/server";
import { createHash } from "node:crypto";
import {
  successResponse,
  errorResponse,
  Logger,
  getCurrentUserId,
} from "@/lib/api-utils";
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
  deleteFile,
} from "@/lib/file-utils";
import {
  extractDocumentData,
  buildHintedExtractionPrompt,
  ExtractionData,
} from "@/lib/extraction";
import { categorizeMovement } from "@/lib/categorization";
import {
  queryExtractionMemory,
  reinforceExtractionMemory,
} from "@/lib/extraction-memory";

// ---------------------------------------------------------------------------
// Helper: call Ollama with a memory-hinted prompt
// ---------------------------------------------------------------------------
async function extractFieldsWithHintedPrompt(
  rawText: string,
  hints: Record<string, unknown>,
): Promise<Partial<ExtractionData> | null> {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const prompt = buildHintedExtractionPrompt(rawText, hints);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: "qwen3.5:4b", prompt, stream: false }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const aiText = (data.response || "")
      .trim()
      .replace(/^```(?:json)?/, "")
      .replace(/```$/, "");

    const parsed = JSON.parse(aiText) as Record<string, unknown>;
    return {
      extractedDate:
        typeof parsed.extractedDate === "string"
          ? parsed.extractedDate
          : undefined,
      extractedAmount:
        typeof parsed.extractedAmount === "number"
          ? parsed.extractedAmount
          : undefined,
      extractedCurrency:
        typeof parsed.extractedCurrency === "string"
          ? (parsed.extractedCurrency as string).toUpperCase()
          : undefined,
      extractedVendor:
        typeof parsed.extractedVendor === "string"
          ? parsed.extractedVendor
          : undefined,
      extractedCuit:
        typeof parsed.extractedCuit === "string"
          ? parsed.extractedCuit
          : undefined,
      extractedDocumentType:
        typeof parsed.extractedDocumentType === "string"
          ? (parsed.extractedDocumentType as ExtractionData["extractedDocumentType"])
          : undefined,
      extractedDescription:
        typeof parsed.extractedDescription === "string"
          ? parsed.extractedDescription
          : undefined,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Helper: insert extraction record
// ---------------------------------------------------------------------------
async function insertExtraction(
  documentId: string,
  data: ExtractionData,
  method: string,
  sourceItemKey: string,
) {
  return db
    .insert(extractions)
    .values({
      documentId,
      sourceItemKey,
      rawOcrText: data.rawText,
      extractedDate: data.extractedDate,
      extractedAmount: data.extractedAmount?.toString() ?? null,
      extractedCurrency: data.extractedCurrency,
      extractedVendor: data.extractedVendor,
      extractedCuit: data.extractedCuit,
      extractedDocumentType: data.extractedDocumentType,
      confidenceScores: data.confidenceScores,
      overallConfidence: data.overallConfidence.toString(),
      extractionErrors: data.errors,
      extractionMethod: method,
    })
    .onConflictDoNothing({ target: extractions.sourceItemKey })
    .returning();
}

// ---------------------------------------------------------------------------
// Extraction job handler
// ---------------------------------------------------------------------------
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

    // ── Step 1: Extract raw text + initial field inference ─────────────────
    const fileBuffer = await getFile(doc.filePath);
    const extractedDocument = await extractDocumentData(
      fileBuffer,
      doc.mimeType,
    );

    for (const [
      itemIndex,
      extractionData,
    ] of extractedDocument.items.entries()) {
      const sourceItemKey = `${documentId}:${itemIndex}`;
      const existingExtraction = await db.query.extractions.findFirst({
        where: eq(extractions.sourceItemKey, sourceItemKey),
      });

      if (existingExtraction) continue;

      const cuit = extractionData.extractedCuit;
      const documentType = extractionData.extractedDocumentType ?? "other";

      // ── Step 2: Query extraction memory (CUIT + doc_type ≥ 85%) ───────────
      const memoryHint = await queryExtractionMemory(cuit, documentType);

      if (memoryHint) {
        // ── Step 3a: MEMORY FOUND — hinted extraction ─────────────────────
        Logger.info(`[ExtractionMemory] Memory match — hinted extraction`, {
          documentId,
          memoryId: memoryHint.id,
          vendor: memoryHint.vendorName,
          cuit,
          documentType,
        });

        const hintedFields = await extractFieldsWithHintedPrompt(
          extractionData.rawText,
          memoryHint.hints,
        );

        // Merge hinted fields over initial extraction (non-destructive)
        const merged: ExtractionData = { ...extractionData };
        if (hintedFields) {
          if (hintedFields.extractedDate)
            merged.extractedDate = hintedFields.extractedDate;
          if (hintedFields.extractedAmount)
            merged.extractedAmount = hintedFields.extractedAmount;
          if (hintedFields.extractedCurrency)
            merged.extractedCurrency = hintedFields.extractedCurrency;
          if (hintedFields.extractedVendor)
            merged.extractedVendor = hintedFields.extractedVendor;
          if (hintedFields.extractedCuit)
            merged.extractedCuit = hintedFields.extractedCuit;
          if (hintedFields.extractedDocumentType)
            merged.extractedDocumentType = hintedFields.extractedDocumentType;
          if (hintedFields.extractedDescription)
            merged.extractedDescription = hintedFields.extractedDescription;
        }

        const extractionRecord = await insertExtraction(
          documentId,
          merged,
          "memory-hinted",
          sourceItemKey,
        );

        if (extractionRecord.length === 0) continue;

        if (merged.extractedDate && merged.extractedAmount) {
          const categorization = await categorizeMovement(
            merged.extractedVendor,
            merged.extractedAmount,
            merged.extractedDate,
            merged.rawText,
          );

          await db.insert(movements).values({
            documentId,
            extractionId: extractionRecord[0].id,
            categoryId: categorization.categoryId,
            vendorName: merged.extractedVendor,
            amount: merged.extractedAmount.toString(),
            currency: merged.extractedCurrency,
            transactionDate: merged.extractedDate,
            movementType: merged.extractedDescription
              ?.toLowerCase()
              .includes("ingreso")
              ? "income"
              : "expense",
            description: `Auto-extraído via memory. Categorizado: ${categorization.method}`,
            categorizationMethod: categorization.method,
            confidenceScore: categorization.confidence.toString(),
          });

          Logger.info(`Movement created via memory hint`, {
            documentId,
            categoryId: categorization.categoryId,
            vendor: merged.extractedVendor,
          });
        }

        // Reinforce memory (increment usage_count)
        await reinforceExtractionMemory(memoryHint.id, {}, merged.rawText);

        await db
          .update(documents)
          .set({ processingStatus: "completed" })
          .where(eq(documents.id, documentId));

        Logger.info(`Extraction completed via memory hint`, { documentId });
      } else {
        // ── Step 3b: NO MEMORY — store partial extraction, await review ──────
        Logger.info(
          `[ExtractionMemory] No match — document awaiting user review`,
          { documentId, cuit, documentType },
        );

        const extractionRecord = await insertExtraction(
          documentId,
          extractionData,
          extractionData.extractionMethod ?? "ocr",
          sourceItemKey,
        );

        if (extractionRecord.length === 0) continue;

        // DO NOT create movement — user must confirm data first
        await db
          .update(documents)
          .set({ processingStatus: "awaiting_review" })
          .where(eq(documents.id, documentId));

        Logger.info(`Document set to awaiting_review`, { documentId });
      }
    }
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

void jobQueue.recoverPendingJobs().catch((error) => {
  Logger.error("Failed to recover pending extraction jobs", error);
});

// ---------------------------------------------------------------------------
// POST /api/documents/upload
// ---------------------------------------------------------------------------
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
      const validation = validateFile(file);
      if (!validation.valid) {
        throw HttpErrors.badRequest(validation.error || "Invalid file");
      }

      const buffer = await file.arrayBuffer();
      const uint8Array = new Uint8Array(buffer);
      const buf = Buffer.from(uint8Array);

      const magicBytesValid = await validateMagicBytes(buf);
      if (!magicBytesValid) {
        throw HttpErrors.badRequest(
          `El contenido del archivo no coincide con su extensión: ${file.name}`,
        );
      }

      const fingerprint = `${userId}:${createHash("sha256").update(buf).digest("hex")}`;
      const storagePath = await saveFile(buf, file.name);
      Logger.info(`File saved`, { path: storagePath, name: file.name });

      const insertedDocument = await db
        .insert(documents)
        .values({
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          filePath: storagePath,
          uploadStatus: "uploaded",
          processingStatus: "pending",
          userId,
          uploadFingerprint: fingerprint,
        })
        .onConflictDoNothing({ target: documents.uploadFingerprint })
        .returning();

      let documentRecord = insertedDocument;
      if (documentRecord.length === 0) {
        await deleteFile(storagePath).catch((error) =>
          Logger.warn("Failed to remove duplicate uploaded file", error),
        );

        const existingDocument = await db.query.documents.findFirst({
          where: eq(documents.uploadFingerprint, fingerprint),
        });

        if (!existingDocument) {
          throw new Error(
            "Document fingerprint conflict without existing document",
          );
        }

        documentRecord = [existingDocument];
      }

      uploadedDocuments.push({
        id: documentRecord[0].id,
        filename: documentRecord[0].filename,
        fileSize: documentRecord[0].fileSize,
        mimeType: documentRecord[0].mimeType,
        uploadStatus: documentRecord[0].uploadStatus,
        uploadedAt: documentRecord[0].uploadedAt,
      });

      const jobId = await jobQueue.enqueue(
        "extract",
        { documentId: documentRecord[0].id },
        { documentId: documentRecord[0].id, priority: 10, maxRetries: 3 },
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
