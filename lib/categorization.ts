/**
 * Categorization engine for financial movements
 * Strategy: Rules → RAG → AI Fallback
 */

import { db } from "@/db";
import { categories, movements, ragEmbeddings } from "@/db/schema";
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
 * Strategy 2: RAG-based categorization using past movements
 */
export async function categorizeByRAG(
  vendorName: string,
  limit: number = 3,
): Promise<CategorizationResult | null> {
  if (!vendorName) return null;

  try {
    // Look for exact or similar vendor names in past movements
    const pastMovements = await db
      .select({
        vendorName: movements.vendorName,
        categoryId: movements.categoryId,
        categoryName: categories.name,
        count: sql<number>`COUNT(*)`,
      })
      .from(movements)
      .leftJoin(categories, eq(movements.categoryId, categories.id))
      .where(ilike(movements.vendorName, `%${vendorName.substring(0, 20)}%`))
      .groupBy(movements.vendorName, movements.categoryId, categories.name)
      .orderBy(sql`COUNT(*) DESC`)
      .limit(limit);

    if (pastMovements.length > 0) {
      // Use the most common category for this vendor
      const topMatch = pastMovements[0];
      if (topMatch.categoryId) {
        return {
          categoryId: topMatch.categoryId,
          categoryName: topMatch.categoryName || undefined,
          confidence: Math.min(0.7 + (pastMovements.length || 0) * 0.05, 0.95),
          method: "rag",
          explanation: `Found ${pastMovements.length} similar movements`,
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
  vendorName: string,
  amount: number,
  date: string,
): Promise<CategorizationResult | null> {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

    // Sanitize vendor name to prevent injection
    const safeName = sanitizeVendorName(vendorName);

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: `Categorize this financial transaction. 
        Vendor: ${safeName}
        Amount: ${amount} ARS
        Date: ${date}
        
        Available categories: Alimentos, Servicios, Transporte, Salud, Entretenimiento, Ingresos, Gastos, Otros, Sin Categorizar
        
        Respond with ONLY the category name, nothing else.`,
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
          confidence: 0.65, // AI confidence is lower than rules
          method: "ai",
          explanation: `Categorized by AI: ${categoryName}`,
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
): Promise<CategorizationResult> {
  // Try strategies in order: Rules → RAG → AI → Default

  // Strategy 1: Rules
  if (vendorName) {
    const ruleResult = await categorizeByRules(vendorName);
    if (ruleResult && ruleResult.confidence >= 0.85) {
      return ruleResult;
    }
  }

  // Strategy 2: RAG
  if (vendorName) {
    const ragResult = await categorizeByRAG(vendorName);
    if (ragResult) {
      return ragResult;
    }
  }

  // Strategy 3: AI Fallback
  if (vendorName && amount && date) {
    const aiResult = await categorizeByAI(vendorName, amount, date);
    if (aiResult) {
      return aiResult;
    }
  }

  // Strategy 4: Default
  const defaultResult = await getDefaultCategory();
  if (defaultResult) {
    return defaultResult;
  }

  // Fallback (should never reach here)
  return {
    confidence: 0,
    method: "rule",
    explanation: "No category available",
  };
}

/**
 * Learn from user corrections to improve RAG
 * This function updates the categorization database with successful categorizations
 */
export async function recordSuccessfulCategorization(
  vendorName: string,
  categoryId: string,
): Promise<void> {
  try {
    // This could be extended to update RAG embeddings
    // For now, just log for audit purposes
    console.log(
      `[Learning] Recorded successful categorization: ${vendorName} → ${categoryId}`,
    );

    // TODO: Generate embedding for this vendor-category pair
    // TODO: Store in ragEmbeddings table
  } catch (error) {
    console.warn("Failed to record successful categorization:", error);
  }
}
