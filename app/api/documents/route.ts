import { NextRequest } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documents } from "@/db/schema";
import {
  errorResponse,
  getCurrentUserId,
  successResponse,
} from "@/lib/api-utils";

export async function GET(request: NextRequest) {
  try {
    const userId = getCurrentUserId(request);
    const status = request.nextUrl.searchParams.get("status");
    const requestedLimit = Number(
      request.nextUrl.searchParams.get("limit") ?? "20",
    );
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(Math.max(Math.floor(requestedLimit), 1), 100)
      : 20;

    const conditions = [eq(documents.userId, userId)];
    if (status) conditions.push(eq(documents.processingStatus, status));

    const result = await db
      .select({
        id: documents.id,
        filename: documents.filename,
        mimeType: documents.mimeType,
        fileSize: documents.fileSize,
        processingStatus: documents.processingStatus,
        uploadStatus: documents.uploadStatus,
        uploadedAt: documents.uploadedAt,
        processedAt: documents.processedAt,
      })
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.uploadedAt))
      .limit(limit);

    return successResponse({ documents: result });
  } catch (error) {
    return errorResponse(error);
  }
}
