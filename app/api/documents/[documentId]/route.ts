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
import { deleteFile } from "@/lib/file-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
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
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
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
  { params }: { params: Promise<{ documentId: string }> },
) {
  try {
    const { documentId } = await params;
    Logger.info(`Deleting document: ${documentId}`);

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw HttpErrors.notFound("Documento");
    }

    // Prevent deletion of documents in processing state
    if (
      doc.processingStatus === "processing" ||
      doc.processingStatus === "extracting" ||
      doc.processingStatus === "categorizing"
    ) {
      throw HttpErrors.badRequest(
        "No se puede eliminar un documento en procesamiento",
      );
    }

    // Delete file from filesystem (non-fatal if it fails)
    if (doc.filePath) {
      try {
        await deleteFile(doc.filePath);
        Logger.info(`File deleted from disk: ${doc.filePath}`);
      } catch (error) {
        Logger.warn(`Failed to delete file from disk: ${doc.filePath}`, error);
      }
    }

    // Delete document record (cascades to movements, extractions via ON DELETE CASCADE)
    await db.delete(documents).where(eq(documents.id, documentId));

    Logger.info(`Document deleted: ${documentId}`);

    return successResponse(null, 204, "Documento eliminado correctamente");
  } catch (error) {
    Logger.error("Failed to delete document", error);
    return errorResponse(error);
  }
}
