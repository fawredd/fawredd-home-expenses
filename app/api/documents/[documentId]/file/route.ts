import { NextRequest, NextResponse } from "next/server";
import { Logger, HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { documents } from "@/db/schema";
import { eq } from "drizzle-orm";
import { getFile } from "@/lib/file-utils";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const { documentId } = await params;
    Logger.info(`Streaming file for document: ${documentId}`);

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      return new NextResponse("Document not found", { status: 404 });
    }

    if (!doc.filePath) {
      return new NextResponse("File path not set", { status: 400 });
    }

    const fileBuffer = await getFile(doc.filePath);
    
    return new NextResponse(fileBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": doc.mimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${doc.filename}"`,
      },
    });
  } catch (error) {
    Logger.error("Failed to stream document file", error);
    return new NextResponse("Internal server error", { status: 500 });
  }
}
