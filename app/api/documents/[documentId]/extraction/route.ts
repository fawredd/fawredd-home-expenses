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
import { jobQueue } from "@/lib/job-queue";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    Logger.info(`Fetching extraction for document: ${documentId}`);

    const extraction = await db.query.extractions.findFirst({
      where: eq(extractions.documentId, documentId),
    });

    if (!extraction) {
      return successResponse({
        extraction: null,
        message: "No extraction available yet",
      });
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
 * Manually update extraction results (for user corrections)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    const body = await request.json();

    Logger.info(`Updating extraction for document: ${documentId}`);

    const extraction = await db.query.extractions.findFirst({
      where: eq(extractions.documentId, documentId),
    });

    if (!extraction) {
      throw HttpErrors.notFound("Extraction");
    }

    // Update extraction with validated fields
    const updatedExtraction = await db
      .update(extractions)
      .set({
        extractedDate: body.extractedDate || extraction.extractedDate,
        extractedAmount: body.extractedAmount || extraction.extractedAmount,
        extractedCurrency:
          body.extractedCurrency || extraction.extractedCurrency,
        extractedVendor: body.extractedVendor || extraction.extractedVendor,
        extractedDocumentType:
          body.extractedDocumentType || extraction.extractedDocumentType,
        extractedDescription:
          body.extractedDescription || extraction.extractedDescription,
      })
      .where(eq(extractions.id, extraction.id))
      .returning();

    Logger.info(`Extraction updated for document: ${documentId}`);

    return successResponse(
      { extraction: updatedExtraction[0] },
      200,
      "Extraction updated successfully",
    );
  } catch (error) {
    Logger.error("Failed to update extraction", error);
    return errorResponse(error);
  }
}
