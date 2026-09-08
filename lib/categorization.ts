/**
 * Categorization engine for financial movements
 * Strategy: Rules → RAG → AI Fallback
 */

import { db } from "@/db";
import { categories, ragEmbeddings } from "@/db/schema";
import { eq, ilike, sql } from "drizzle-orm";
import { sanitizeVendorName } from "./extraction";

export type CategorizationMethod = "rule" | "rag" | "ai" | "manual";

export interface CategorizationResult {
  categoryId?: string;
  categoryName?: string;
  confidence: number;
  method: CategorizationMethod;
  explanation?: string;
}

/**
 * Categorization rules based on vendor name patterns
 * These are curated rules that improve over time
 */
const CATEGORIZATION_RULES: Array<{
  keywords: string[];
  categoryName: string;
  confidence: number;
}> = [
  {
    keywords: [
      "carrefour",
      "walmart",
      "disco",
      "freddo",
      "supermercado",
      "almacén",
    ],
    categoryName: "Alimentos",
    confidence: 0.95,
  },
  {
    keywords: [
      "edesur",
      "edenor",
      "gas",
      "agua",
      "claro",
      "movistar",
      "personal",
    ],
    categoryName: "Servicios",
    confidence: 0.98,
  },
  {
    keywords: [
      "uber",
      "taxi",
      "gasolinera",
      "ypf",
      "shell",
      "axion",
      "transporte",
    ],
    categoryName: "Transporte",
    confidence: 0.92,
  },
  {
    keywords: [
      "farmacia",
      "droguería",
      "hospital",
      "médico",
      "doctor",
      "salud",
    ],
    categoryName: "Salud",
    confidence: 0.9,
  },
  {
    keywords: [
      "cine",
      "spotify",
      "netflix",
      "steam",
      "juego",
      "película",
      "concierto",
    ],
    categoryName: "Entretenimiento",
    confidence: 0.85,
  },
  {
    keywords: ["salario", "sueldo", "ingreso", "bono", "comisión", "pago"],
    categoryName: "Ingresos",
    confidence: 0.95,
  },
];

/**
 * Strategy 1: Rule-based categorization
 */
export async function categorizeByRules(
  vendorName: string,
): Promise<CategorizationResult | null> {
  if (!vendorName) return null;

  const vendorLower = vendorName.toLowerCase();

  for (const rule of CATEGORIZATION_RULES) {
    // Check if any keyword matches
    const matches = rule.keywords.some((keyword) =>
      vendorLower.includes(keyword),
    );

    if (matches) {
      // Get category ID
      const category = await db.query.categories.findFirst({
        where: eq(categories.name, rule.categoryName),
      });

      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          confidence: rule.confidence,
          method: "rule",
          explanation: `Matched rule for vendor: ${vendorName}`,
        };
      }
    }
  }

  return null;
}

/**
 * Strategy 2: RAG-based categorization using past embeddings
 */
export async function categorizeByRAG(
  vendorName?: string,
  rawText?: string,
  limit: number = 3,
): Promise<CategorizationResult | null> {
  const queryText = (vendorName || rawText || "").trim();
  if (!queryText) return null;

  try {
    const queryEmbedding = generateTextEmbedding(queryText);
    const queryVector = `[${queryEmbedding.join(",")}]`;

    const results = await db
      .select({
        embeddingId: ragEmbeddings.id,
        categoryId: ragEmbeddings.categoryId,
        categoryName: categories.name,
        vendorName: ragEmbeddings.vendorName,
        similarity: sql<number>`(${ragEmbeddings.embedding} <-> ${queryVector}::vector)`,
      })
      .from(ragEmbeddings)
      .leftJoin(categories, eq(ragEmbeddings.categoryId, categories.id))
      .orderBy(sql`(${ragEmbeddings.embedding} <-> ${queryVector}::vector)`)
      .limit(limit);

    if (results.length > 0) {
      const topMatch = results[0];
      if (topMatch.categoryId) {
        return {
          categoryId: topMatch.categoryId,
          categoryName: topMatch.categoryName || undefined,
          confidence: Math.min(0.7 + (limit - 1) * 0.02, 0.92),
          method: "rag",
          explanation: `Matched similar vendor memory: ${topMatch.vendorName}`,
        };
      }
    }

    return null;
  } catch (error) {
    console.warn("RAG categorization failed:", error);
    return null;
  }
}

/**
 * Strategy 3: AI-based categorization using Ollama
 */
export async function categorizeByAI(
  vendorName?: string,
  amount?: number,
  date?: string,
  rawText?: string,
): Promise<CategorizationResult | null> {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const safeName = vendorName ? sanitizeVendorName(vendorName) : "";
    const promptParts = [
      "Eres un clasificador de movimientos financieros para una aplicación de gastos.",
    ];

    if (safeName) {
      promptParts.push(`Vendor: ${safeName}`);
    }
    if (amount !== undefined && amount !== null) {
      promptParts.push(`Amount: ${amount} ARS`);
    }
    if (date) {
      promptParts.push(`Date: ${date}`);
    }
    if (rawText) {
      promptParts.push(`Context:
${rawText.trim().substring(0, 500)}`);
    }

    promptParts.push(
      "Available categories: Alimentos, Servicios, Transporte, Salud, Entretenimiento, Ingresos, Gastos, Otros, Sin Categorizar.",
      "Responde con SOLO el nombre de la categoría más probable, sin explicaciones.",
    );

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: promptParts.join("\n"),
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    const categoryName = data.response?.trim();

    if (categoryName) {
      const category = await db.query.categories.findFirst({
        where: ilike(categories.name, categoryName),
      });

      if (category) {
        return {
          categoryId: category.id,
          categoryName: category.name,
          confidence: 0.65,
          method: "ai",
          explanation: `Categorized by AI based on ${vendorName ? "vendor" : "document text"}`,
        };
      }
    }

    return null;
  } catch (error) {
    console.warn("AI categorization failed:", error);
    return null;
  }
}

/**
 * Get default "Sin Categorizar" category
 */
export async function getDefaultCategory(): Promise<CategorizationResult | null> {
  const defaultCat = await db.query.categories.findFirst({
    where: eq(categories.name, "Sin Categorizar"),
  });

  if (defaultCat) {
    return {
      categoryId: defaultCat.id,
      categoryName: defaultCat.name,
      confidence: 0,
      method: "rule",
      explanation: "Using default uncategorized",
    };
  }

  return null;
}

/**
 * Main categorization function - tries strategies in order
 */
export async function categorizeMovement(
  vendorName?: string,
  amount?: number,
  date?: string,
  rawText?: string,
): Promise<CategorizationResult> {
  // Try strategies in order: Rules → RAG → AI → Default

  if (vendorName) {
    const ruleResult = await categorizeByRules(vendorName);
    if (ruleResult && ruleResult.confidence >= 0.85) {
      return ruleResult;
    }
  }

  const ragResult = await categorizeByRAG(vendorName, rawText);
  if (ragResult) {
    return ragResult;
  }

  const aiResult = await categorizeByAI(vendorName, amount, date, rawText);
  if (aiResult) {
    return aiResult;
  }

  const defaultResult = await getDefaultCategory();
  if (defaultResult) {
    return defaultResult;
  }

  return {
    confidence: 0,
    method: "rule",
    explanation: "No category available",
  };
}

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
 * Learn from user corrections to improve RAG
 * This function updates the categorization database with successful categorizations
 */
export async function recordSuccessfulCategorization(
  vendorName: string | null,
  categoryId: string,
  movementId: string,
): Promise<void> {
  try {
    const embedding = generateTextEmbedding(vendorName);

    await db
      .insert(ragEmbeddings)
      .values({
        movementId,
        vendorName: vendorName ?? "",
        categoryId,
        embedding,
      })
      .onConflictDoNothing({
        target: [ragEmbeddings.movementId, ragEmbeddings.categoryId],
      });

    console.log(
      `[Learning] Recorded successful categorization: ${vendorName} → ${categoryId}`,
    );
  } catch (error) {
    console.warn("Failed to record successful categorization:", error);
  }
}
