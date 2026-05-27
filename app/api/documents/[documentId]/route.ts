/**
 * GET /api/documents/[documentId]/status
 * Get current upload and processing status
 */
import { NextRequest, NextResponse } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";

export async function GET(
  request: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    const { documentId } = params;
    Logger.info(`Fetching document status: ${documentId}`);

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw HttpErrors.notFound("Documento");
    }

    return successResponse({
      id: doc.id,
      filename: doc.filename,
      uploadStatus: doc.uploadStatus,
      processingStatus: doc.processingStatus,
      uploadedAt: doc.uploadedAt,
      processedAt: doc.processedAt,
      errorMessage: doc.errorMessage,
    });
  } catch (error) {
    Logger.error("Failed to fetch document status", error);
    return errorResponse(error);
  }
}

/**
 * DELETE /api/documents/[documentId]
 * Delete or cancel a document
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { documentId: string } },
) {
  try {
    const { documentId } = params;
    Logger.info(`Deleting document: ${documentId}`);

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw HttpErrors.notFound("Documento");
    }

    // TODO: Verify document is not in processing state
    if (
      doc.processingStatus === "extracting" ||
      doc.processingStatus === "categorizing"
    ) {
      throw new Error("No se puede eliminar un documento en procesamiento");
    }

    // TODO: Delete file from filesystem

    // Delete document record (cascades to movements, extractions, etc.)
    await db.delete(documents).where(eq(documents.id, documentId));

    return successResponse(null, 204, "Documento eliminado correctamente");
  } catch (error) {
    Logger.error("Failed to delete document", error);
    return errorResponse(error);
  }
}
