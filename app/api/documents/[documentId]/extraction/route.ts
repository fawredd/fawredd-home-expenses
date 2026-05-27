/**
 * GET /api/documents/[documentId]/extraction
 * Get extraction results for a document
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { extractions } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    const { documentId } = params;
    Logger.info(`Fetching extraction for document: ${documentId}`);

    const extraction = await db.query.extractions.findFirst({
      where: eq(extractions.documentId, documentId),
    });

    if (!extraction) {
      throw HttpErrors.notFound("Extraction");
    }

    return successResponse({
      id: extraction.id,
      documentId: extraction.documentId,
      rawOcrText: extraction.rawOcrText,
      extractedDate: extraction.extractedDate,
      extractedAmount: extraction.extractedAmount,
      extractedCurrency: extraction.extractedCurrency,
      extractedVendor: extraction.extractedVendor,
      extractedDocumentType: extraction.extractedDocumentType,
      extractedDescription: extraction.extractedDescription,
      confidenceScores: extraction.confidenceScores,
      overallConfidence: extraction.overallConfidence,
      extractionMethod: extraction.extractionMethod,
      extractedAt: extraction.extractedAt,
    });
  } catch (error) {
    Logger.error("Failed to fetch extraction", error);
    return errorResponse(error);
  }
}

/**
 * PUT /api/documents/[documentId]/extraction
 * Manually update extraction results
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    const { documentId } = params;
    const body = await request.json();

    Logger.info(`Updating extraction for document: ${documentId}`);

    // TODO: Validate with UpdateExtractionSchema

    const extraction = await db.query.extractions.findFirst({
      where: eq(extractions.documentId, documentId),
    });

    if (!extraction) {
      throw HttpErrors.notFound("Extraction");
    }

    // TODO: Update extraction in database
    // TODO: Create/update associated movement record

    return successResponse({
      message: "Extraction updated successfully",
    });
  } catch (error) {
    Logger.error("Failed to update extraction", error);
    return errorResponse(error);
  }
}

/**
 * POST /api/documents/[documentId]/reprocess
 * Rerun extraction pipeline on a document
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    const { documentId } = params;
    const body = await request.json();
    const { forceOCR } = body;

    Logger.info(`Reprocessing document: ${documentId}`, { forceOCR });

    // TODO: Queue reprocessing job via pg-boss
    // TODO: Return job ID for status polling

    return successResponse(
      { jobId: "todo-job-id", status: "processing" },
      202,
      "Document queued for reprocessing",
    );
  } catch (error) {
    Logger.error("Failed to reprocess document", error);
    return errorResponse(error);
  }
}
