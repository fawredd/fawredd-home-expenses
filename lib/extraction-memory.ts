/**
 * Extraction Memory — RAG-guided extraction hints
 *
 * The app learns HOW to extract fields (date, amount, vendor, cuit) from
 * specific vendors by storing successful extractions as "hints" in the
 * extraction_memory table. On the next document from the same vendor the
 * hints are injected into the AI prompt so extraction improves over time.
 *
 * Match key: CUIT + document_type, both ≥ 85% confidence required.
 */

import { db } from "@/db";
import { extractionMemory } from "@/db/schema";
import { eq, and, sql } from "drizzle-orm";

/** Minimum combined confidence to skip user review (0-1) */
const REVIEW_CONFIDENCE_THRESHOLD = 0.85;

export interface ExtractionMemoryHint {
  id: string;
  vendorName: string;
  cuit: string | null;
  documentType: string;
  hints: Record<string, unknown>;
  usageCount: number;
  /** Similarity score: 0 = identical, higher = more distant */
  similarity: number;
}

export interface ExtractionFields {
  vendor?: string;
  cuit?: string;
  date?: string;
  amount?: number;
  currency?: string;
  documentType?: string;
  rawText: string;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Deterministic vector embedding for a text string (384 dimensions).
 * Same algorithm used in lib/categorization.ts for consistency.
 */
function generateTextEmbedding(text: string | null, length = 384): number[] {
  const normalizedText = text ? text.trim().toLowerCase() : "";
  const embedding: number[] = [];
  let hash = 2166136261;

  for (let i = 0; i < normalizedText.length; i++) {
    hash ^= normalizedText.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  for (let index = 0; index < length; index++) {
    hash ^= index;
    hash = Math.imul(hash, 16777619);
    embedding.push(((hash >>> 0) / 0xffffffff) * 2 - 1);
  }

  return embedding;
}

/**
 * Build the query key used for embedding + lookup.
 * We combine cuit + documentType so two vendors with the same CUIT but
 * different document types get distinct memory slots.
 */
function buildMemoryKey(
  cuit: string | undefined,
  documentType: string | undefined,
): string {
  return `${(cuit || "unknown").trim().toLowerCase()}|${(documentType || "other").trim().toLowerCase()}`;
}

/**
 * Compute a 0–1 confidence score from a pgvector cosine distance (0 = same, 2 = opposite).
 * We treat distance < 0.15 as very high confidence.
 */
function distanceToConfidence(distance: number): number {
  // pgvector <-> returns L2 distance; map [0, 2] → [1, 0] with a soft curve
  return Math.max(0, Math.min(1, 1 - distance / 2));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Query extraction_memory for a previously-seen CUIT + document-type pair.
 *
 * Returns a hint object if confidence ≥ REVIEW_CONFIDENCE_THRESHOLD, or null
 * if no match was found / confidence is too low (routes to user review).
 */
export async function queryExtractionMemory(
  cuit: string | undefined,
  documentType: string | undefined,
): Promise<ExtractionMemoryHint | null> {
  if (!cuit && !documentType) return null;

  const key = buildMemoryKey(cuit, documentType);
  const embedding = generateTextEmbedding(key);
  const queryVector = `[${embedding.join(",")}]`;

  try {
    const results = await db
      .select({
        id: extractionMemory.id,
        vendorName: extractionMemory.vendorName,
        cuit: extractionMemory.cuit,
        documentType: extractionMemory.documentType,
        extractionHints: extractionMemory.extractionHints,
        usageCount: extractionMemory.usageCount,
        similarity: sql<number>`(${extractionMemory.embedding} <-> ${queryVector}::vector)`,
      })
      .from(extractionMemory)
      .orderBy(sql`(${extractionMemory.embedding} <-> ${queryVector}::vector)`)
      .limit(1);

    if (results.length === 0) return null;

    const top = results[0];
    const confidence = distanceToConfidence(top.similarity);

    if (confidence < REVIEW_CONFIDENCE_THRESHOLD) {
      console.log(
        `[ExtractionMemory] Match found but confidence ${confidence.toFixed(2)} < threshold ${REVIEW_CONFIDENCE_THRESHOLD} — routing to review`,
      );
      return null;
    }

    console.log(
      `[ExtractionMemory] Match: ${top.vendorName} (cuit=${top.cuit}, docType=${top.documentType}) confidence=${confidence.toFixed(2)} usageCount=${top.usageCount}`,
    );

    return {
      id: top.id,
      vendorName: top.vendorName,
      cuit: top.cuit,
      documentType: top.documentType,
      hints: (top.extractionHints as Record<string, unknown>) ?? {},
      usageCount: top.usageCount,
      similarity: top.similarity,
    };
  } catch (error) {
    console.warn("[ExtractionMemory] Query failed:", error);
    return null;
  }
}

/**
 * Record a new extraction into memory so future documents from the same
 * vendor can be auto-extracted.
 *
 * Builds extraction hints by inspecting the raw text to locate the positions
 * of key fields so future prompts can be guided accordingly.
 */
export async function recordExtractionMemory(
  fields: ExtractionFields,
): Promise<void> {
  const {
    vendor = "unknown",
    cuit,
    documentType = "other",
    rawText,
    date,
    amount,
    currency,
  } = fields;

  const key = buildMemoryKey(cuit, documentType);
  const embedding = generateTextEmbedding(key);

  // Build hints by scanning rawText for where the confirmed values appear
  const hints = buildHintsFromRawText(rawText, {
    date,
    amount: amount?.toString(),
    vendor,
    cuit,
    currency,
  });

  try {
    // Check if a record for this key already exists (upsert-like)
    const key384 = `[${embedding.join(",")}]`;
    const existing = await db
      .select({ id: extractionMemory.id })
      .from(extractionMemory)
      .where(
        and(
          eq(extractionMemory.cuit, cuit ?? ""),
          eq(extractionMemory.documentType, documentType),
        ),
      )
      .limit(1);

    if (existing.length > 0) {
      // Reinforce existing memory
      await reinforceExtractionMemory(existing[0].id, hints, rawText);
      return;
    }

    await db.insert(extractionMemory).values({
      vendorName: vendor,
      cuit: cuit ?? null,
      documentType,
      embedding,
      extractionHints: hints,
      sampleRawText: rawText.substring(0, 2000),
      usageCount: 1,
      lastUsedAt: new Date(),
    });

    console.log(
      `[ExtractionMemory] Recorded new memory: vendor=${vendor} cuit=${cuit} docType=${documentType}`,
    );
  } catch (error) {
    console.warn("[ExtractionMemory] Failed to record memory:", error);
  }
}

/**
 * Reinforce an existing memory entry: increment usage count and merge new hints.
 */
export async function reinforceExtractionMemory(
  memoryId: string,
  newHints: Record<string, unknown>,
  rawText?: string,
): Promise<void> {
  try {
    const existing = await db
      .select({
        extractionHints: extractionMemory.extractionHints,
        usageCount: extractionMemory.usageCount,
      })
      .from(extractionMemory)
      .where(eq(extractionMemory.id, memoryId))
      .limit(1);

    if (existing.length === 0) return;

    const mergedHints = {
      ...((existing[0].extractionHints as Record<string, unknown>) ?? {}),
      ...newHints,
    };

    await db
      .update(extractionMemory)
      .set({
        extractionHints: mergedHints,
        usageCount: (existing[0].usageCount ?? 0) + 1,
        lastUsedAt: new Date(),
        ...(rawText
          ? { sampleRawText: rawText.substring(0, 2000) }
          : {}),
      })
      .where(eq(extractionMemory.id, memoryId));

    console.log(
      `[ExtractionMemory] Reinforced memory ${memoryId} (usageCount=${(existing[0].usageCount ?? 0) + 1})`,
    );
  } catch (error) {
    console.warn("[ExtractionMemory] Failed to reinforce memory:", error);
  }
}

// ---------------------------------------------------------------------------
// Hint builder
// ---------------------------------------------------------------------------

interface KnownValues {
  date?: string;
  amount?: string;
  vendor?: string;
  cuit?: string;
  currency?: string;
}

/**
 * Scan rawText to find which label appears near each confirmed field value.
 * The resulting hints dict is stored in extraction_memory.extraction_hints.
 */
function buildHintsFromRawText(
  rawText: string,
  values: KnownValues,
): Record<string, unknown> {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const hints: Record<string, unknown> = {};

  // Find which line a given value appears on
  function findLineIndex(value: string | undefined): number {
    if (!value) return -1;
    return lines.findIndex((l) => l.includes(value));
  }

  // Vendor line position
  if (values.vendor && values.vendor !== "unknown") {
    const idx = findLineIndex(values.vendor);
    if (idx >= 0) hints.vendorLine = idx;
  }

  // Date label: find a label keyword on the same or adjacent line as the date
  if (values.date) {
    const dateLineIdx = findLineIndex(values.date);
    if (dateLineIdx >= 0) {
      const surrounding = lines
        .slice(Math.max(0, dateLineIdx - 1), dateLineIdx + 2)
        .join(" ");
      const labelMatch = surrounding.match(
        /fecha|vencimiento|emisi[oó]n|expedido/i,
      );
      if (labelMatch) hints.dateLabel = labelMatch[0];
    }
  }

  // Amount label
  if (values.amount) {
    const amtLineIdx = findLineIndex(values.amount);
    if (amtLineIdx >= 0) {
      const surrounding = lines
        .slice(Math.max(0, amtLineIdx - 1), amtLineIdx + 2)
        .join(" ");
      const labelMatch = surrounding.match(
        /total|importe|monto|saldo|neto|subtotal/i,
      );
      if (labelMatch) hints.amountLabel = labelMatch[0];
    }
  }

  // Currency hint
  if (values.currency) {
    hints.currencyHint = values.currency;
  }

  return hints;
}
