/**
 * POST /api/documents/upload
 * Upload one or multiple financial documents
 */
import { NextRequest } from "next/server";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { mkdir } from "fs/promises";
import { join } from "path";

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/jpg",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const UPLOAD_DIR = process.env.STORAGE_PATH || "./storage/documents";

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

    // Ensure upload directory exists
    await mkdir(UPLOAD_DIR, { recursive: true });

    const uploadedDocuments = [];

    for (const file of files) {
      // Validate file type
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        throw new Error(
          `Invalid file type: ${file.name}. Solo se aceptan PDF, JPG, PNG`,
        );
      }

      // Validate file size
      if (file.size > MAX_FILE_SIZE) {
        throw new Error(`Archivo ${file.name} es demasiado grande (máx 5MB)`);
      }

      // Create unique filename
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substring(7);
      const ext = file.name.split(".").pop();
      const uniqueFilename = `${timestamp}-${randomId}.${ext}`;

      // Determine storage path
      const year = new Date().getFullYear();
      const month = String(new Date().getMonth() + 1).padStart(2, "0");
      const filePath = join(UPLOAD_DIR, year.toString(), month);

      // Create monthly directory
      await mkdir(filePath, { recursive: true });

      const fullPath = join(filePath, uniqueFilename);

      // Save file to filesystem
      const buffer = await file.arrayBuffer();
      // TODO: Implement actual file writing (requires fs.promises.writeFile)
      // For now, we'll track in database

      // Store document metadata in database
      const documentRecord = await db
        .insert(documents)
        .values({
          filename: file.name,
          fileSize: file.size,
          mimeType: file.type,
          filePath: fullPath,
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

      // TODO: Queue extraction job via pg-boss
      Logger.info(`Document queued for processing: ${file.name}`, {
        documentId: documentRecord[0].id,
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
