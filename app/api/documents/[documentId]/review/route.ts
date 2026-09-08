/**
 * PUT /api/documents/[documentId]/review
 *
 * Accepts user-confirmed extraction data for a document in "awaiting_review" state.
 * Actions:
 *  1. Validate input (Zod)
 *  2. Update extraction record with confirmed fields
 *  3. Create movement
 *  4. Record extraction memory so future documents from this vendor are auto-extracted
 *  5. Record categorization in rag_embeddings for improved categorization
 *  6. Set document processingStatus → "completed"
 */
import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { successResponse, errorResponse, Logger } from "@/lib/api-utils";
import { HttpErrors } from "@/lib/api-utils";
import { db } from "@/db";
import { documents, extractions, movements } from "@/db/schema";
import { and, eq, inArray } from "drizzle-orm";
import { recordExtractionMemory } from "@/lib/extraction-memory";
import { recordSuccessfulCategorization } from "@/lib/categorization";

// ---------------------------------------------------------------------------
// Zod validation schema
// ---------------------------------------------------------------------------
const ReviewSchema = z.object({
  vendor: z.string().min(1, "Vendor is required").max(255),
  cuit: z
    .string()
    .regex(/^\d{2}-\d{8}-\d{1}$/)
    .optional()
    .or(z.literal("")),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format"),
  amount: z.number().positive("Amount must be positive"),
  currency: z.enum(["ARS", "USD", "EUR", "UYU"]).default("ARS"),
  documentType: z
    .enum(["invoice", "receipt", "statement", "ticket", "other"])
    .default("other"),
  categoryId: z.string().uuid("categoryId must be a valid UUID"),
  description: z.string().max(500).optional(),
});

type ReviewPayload = z.infer<typeof ReviewSchema>;

// ---------------------------------------------------------------------------
// PUT handler
// ---------------------------------------------------------------------------
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  const { documentId } = await params;
  let reviewProcessing = false;

  try {
    Logger.info(`Review submission for document ${documentId}`);

    // 1. Parse + validate body
    const body = await request.json();
    const parseResult = ReviewSchema.safeParse(body);
    if (!parseResult.success) {
      throw HttpErrors.badRequest(
        parseResult.error.issues.map((i) => i.message).join("; "),
      );
    }
    const payload: ReviewPayload = parseResult.data;

    // 2. Verify document exists and is in awaiting_review state
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw HttpErrors.notFound(`Document ${documentId} not found`);
    }

    const existingReview = await db.query.movements.findFirst({
      where: and(
        eq(movements.documentId, documentId),
        eq(movements.isReviewed, true),
      ),
    });

    if (doc.processingStatus === "completed" && existingReview) {
      return successResponse(
        {
          movementId: existingReview.id,
          documentId,
          status: "completed",
        },
        200,
        "La revisión ya había sido guardada.",
      );
    }

    if (
      doc.processingStatus !== "awaiting_review" &&
      doc.processingStatus !== "failed" &&
      doc.processingStatus !== "reviewing"
    ) {
      throw HttpErrors.badRequest(
        `Document is not awaiting review (current status: ${doc.processingStatus})`,
      );
    }

    if (doc.processingStatus !== "reviewing") {
      const claimed = await db
        .update(documents)
        .set({ processingStatus: "reviewing" })
        .where(
          and(
            eq(documents.id, documentId),
            inArray(documents.processingStatus, ["awaiting_review", "failed"]),
          ),
        )
        .returning({ id: documents.id });

      if (claimed.length === 0) {
        const completedMovement = await db.query.movements.findFirst({
          where: and(
            eq(movements.documentId, documentId),
            eq(movements.isReviewed, true),
          ),
        });

        if (completedMovement) {
          return successResponse({
            movementId: completedMovement.id,
            documentId,
            status: "completed",
          });
        }

        throw HttpErrors.conflict("Document review is already being processed");
      }

      reviewProcessing = true;
    } else {
      reviewProcessing = true;
    }

    // 3. Find the extraction record for this document
    const extraction = await db.query.extractions.findFirst({
      where: eq(extractions.documentId, documentId),
    });

    if (!extraction) {
      throw HttpErrors.notFound(
        `No extraction record found for document ${documentId}`,
      );
    }

    const reviewKey = createHash("sha256")
      .update(`${documentId}:${JSON.stringify(payload)}`)
      .digest("hex");

    const existingMovement = await db.query.movements.findFirst({
      where: eq(movements.reviewKey, reviewKey),
    });

    if (existingMovement) {
      await db
        .update(documents)
        .set({ processingStatus: "completed", processedAt: new Date() })
        .where(eq(documents.id, documentId));

      return successResponse(
        {
          movementId: existingMovement.id,
          documentId,
          status: "completed",
        },
        200,
        "La revisión ya había sido guardada.",
      );
    }

    // 4. Update extraction record with confirmed fields
    await db
      .update(extractions)
      .set({
        extractedVendor: payload.vendor,
        extractedCuit: payload.cuit || null,
        extractedDate: payload.date,
        extractedAmount: payload.amount.toString(),
        extractedCurrency: payload.currency,
        extractedDocumentType: payload.documentType,
        extractedDescription: payload.description ?? null,
        extractionMethod: "user-review",
        overallConfidence: "1.00",
      })
      .where(eq(extractions.id, extraction.id));

    // 5. Create movement
    const [movement] = await db
      .insert(movements)
      .values({
        documentId,
        extractionId: extraction.id,
        categoryId: payload.categoryId,
        vendorName: payload.vendor,
        amount: payload.amount.toString(),
        currency: payload.currency,
        transactionDate: payload.date,
        movementType: "expense", // default; user can correct later via movement edit
        description:
          payload.description ?? `Revisado manualmente — ${payload.vendor}`,
        categorizationMethod: "manual",
        confidenceScore: "1.00",
        isReviewed: true,
        isManualCorrection: true,
        correctedAt: new Date(),
        reviewKey,
      })
      .onConflictDoNothing({ target: movements.reviewKey })
      .returning();

    if (!movement) {
      const duplicateMovement = await db.query.movements.findFirst({
        where: eq(movements.reviewKey, reviewKey),
      });

      if (!duplicateMovement) {
        throw new Error("Review movement conflict without existing movement");
      }

      return successResponse({
        movementId: duplicateMovement.id,
        documentId,
        status: "completed",
      });
    }

    Logger.info(`Movement created from user review`, {
      documentId,
      movementId: movement.id,
      vendor: payload.vendor,
      amount: payload.amount,
    });

    // 6. Record extraction memory so future documents from this vendor are auto-extracted
    const rawText = extraction.rawOcrText ?? "";
    await recordExtractionMemory({
      vendor: payload.vendor,
      cuit: payload.cuit || undefined,
      documentType: payload.documentType,
      date: payload.date,
      amount: payload.amount,
      currency: payload.currency,
      rawText,
    });

    // 7. Record successful categorization into rag_embeddings for categorization learning
    await recordSuccessfulCategorization(
      payload.vendor,
      payload.categoryId,
      movement.id,
    );

    // 8. Mark document as completed
    await db
      .update(documents)
      .set({ processingStatus: "completed", processedAt: new Date() })
      .where(eq(documents.id, documentId));

    Logger.info(`Document ${documentId} review completed successfully`);

    return successResponse(
      {
        movementId: movement.id,
        documentId,
        status: "completed",
      },
      200,
      "Revisión guardada correctamente. El sistema ha aprendido de este documento.",
    );
  } catch (error) {
    Logger.error(`Review submission failed for document ${documentId}`, error);
    if (reviewProcessing) {
      await db
        .update(documents)
        .set({ processingStatus: "failed" })
        .where(eq(documents.id, documentId))
        .catch((statusError) =>
          Logger.error(
            `Failed to update review status for ${documentId}`,
            statusError,
          ),
        );
    }
    return errorResponse(error, 400);
  }
}

// ---------------------------------------------------------------------------
// GET handler — return extraction data for pre-filling the review form
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ documentId: string }> },
): Promise<NextResponse> {
  const { documentId } = await params;

  try {
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, documentId),
    });

    if (!doc) {
      throw HttpErrors.notFound(`Document ${documentId} not found`);
    }

    const extraction = await db.query.extractions.findFirst({
      where: eq(extractions.documentId, documentId),
    });

    return successResponse(
      {
        document: {
          id: doc.id,
          filename: doc.filename,
          mimeType: doc.mimeType,
          processingStatus: doc.processingStatus,
        },
        extraction: extraction
          ? {
              id: extraction.id,
              extractedVendor: extraction.extractedVendor,
              extractedCuit: extraction.extractedCuit,
              extractedDate: extraction.extractedDate,
              extractedAmount: extraction.extractedAmount,
              extractedCurrency: extraction.extractedCurrency,
              extractedDocumentType: extraction.extractedDocumentType,
              rawOcrText: extraction.rawOcrText?.substring(0, 1000), // snippet for display
              overallConfidence: extraction.overallConfidence,
            }
          : null,
      },
      200,
    );
  } catch (error) {
    Logger.error(
      `Failed to fetch review data for document ${documentId}`,
      error,
    );
    return errorResponse(error, 400);
  }
}
