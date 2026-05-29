/**
 * OCR and document extraction utilities
 * Supports Ollama (local), fallback to regex patterns
 */

export interface ExtractionData {
  rawText: string;
  extractedDate?: string;
  extractedAmount?: number;
  extractedCurrency: string;
  extractedVendor?: string;
  extractedDocumentType?:
    | "receipt"
    | "invoice"
    | "statement"
    | "ticket"
    | "other";
  extractedDescription?: string;
  confidenceScores: Record<string, number>;
  overallConfidence: number;
  errors: string[];
}

// Regex patterns for extraction
const PATTERNS = {
  // Date patterns (DD/MM/YYYY, DD-MM-YYYY, etc.)
  date: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,

  // Amount patterns (with currency symbols and decimals)
  amount: /[\$€¥₹₽][.\s]?\s*([0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?)/g,

  // Vendor/merchant names (usually all caps or title case)
  vendor: /^([A-Z][A-Za-z\s&]{3,50})$/gm,

  // Common keywords
  invoice: /invoice|recibo|factura|comprobante/i,
  receipt: /receipt|ticket|recibo|boleta/i,
  statement: /statement|estado de cuenta|extracto/i,
  ticket: /ticket|boleta|tique/i,
};

/**
 * Parse date string (DD/MM/YYYY format common in Argentina)
 */
function parseDate(dateStr: string): string | null {
  // Try multiple date formats
  const formats = [
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/,
    /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})/, // 2-digit year
  ];

  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      const [, day, month] = match;
      let year = match[3];

      // Convert 2-digit year
      if (year.length === 2) {
        const numYear = parseInt(year);
        year = (numYear > 30 ? 1900 : 2000) + numYear + "";
      }

      // Validate date
      const date = new Date(`${year}-${month}-${day}`);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
  }

  return null;
}

/**
 * Parse amount from various formats
 */
function parseAmount(amountStr: string): number | null {
  // Remove currency symbols and whitespace
  let cleaned = amountStr.replace(/[\$€¥₹₽\s]/g, "");

  // Replace European decimal separator
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(".", "").replace(",", ".");
  }

  const amount = parseFloat(cleaned);
  return !isNaN(amount) && amount > 0 ? amount : null;
}

/**
 * Extract document type based on keywords
 */
function detectDocumentType(
  text: string,
): "receipt" | "invoice" | "statement" | "ticket" | "other" {
  const lower = text.toLowerCase();

  if (PATTERNS.invoice.test(lower)) return "invoice";
  if (PATTERNS.receipt.test(lower)) return "receipt";
  if (PATTERNS.statement.test(lower)) return "statement";
  if (PATTERNS.ticket.test(lower)) return "ticket";

  return "other";
}

/**
 * Extract structured data from raw OCR text
 * This is the fallback method using regex patterns
 */
export function extractFromText(rawText: string): ExtractionData {
  const errors: string[] = [];
  const confidenceScores: Record<string, number> = {};
  let overallConfidence = 0;

  // Clean text
  const cleanText = rawText.replace(/\s+/g, " ").trim().substring(0, 10000); // Limit to 10k chars

  // Extract date
  let extractedDate: string | undefined;
  const dateMatches = cleanText.match(PATTERNS.date);
  if (dateMatches) {
    extractedDate = parseDate(dateMatches[0]) || undefined;
    confidenceScores.date = extractedDate ? 0.85 : 0;
  } else {
    errors.push("No date found");
    confidenceScores.date = 0;
  }

  // Extract amount
  let extractedAmount: number | undefined;
  const amountMatches = cleanText.match(PATTERNS.amount);
  if (amountMatches) {
    const parsed = parseAmount(amountMatches[0]);
    if (parsed) {
      extractedAmount = parsed;
      confidenceScores.amount = 0.9;
    } else {
      errors.push("Could not parse amount");
      confidenceScores.amount = 0;
    }
  } else {
    errors.push("No amount found");
    confidenceScores.amount = 0;
  }

  // Extract vendor (look for capitalized lines)
  let extractedVendor: string | undefined;
  const lines = cleanText.split("\n");
  const vendorLine = lines.find(
    (line) => line.length > 3 && line.length < 50 && /^[A-Z]/.test(line.trim()),
  );
  if (vendorLine) {
    extractedVendor = vendorLine.trim();
    confidenceScores.vendor = 0.7; // Lower confidence for vendor extraction
  } else {
    errors.push("No vendor found");
    confidenceScores.vendor = 0;
  }

  // Detect document type
  const extractedDocumentType = detectDocumentType(cleanText);
  confidenceScores.documentType = 0.75;

  // Calculate overall confidence
  const scores = Object.values(confidenceScores);
  overallConfidence =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  return {
    rawText: cleanText,
    extractedDate,
    extractedAmount,
    extractedCurrency: "ARS", // Default to Argentine Peso
    extractedVendor,
    extractedDocumentType,
    extractedDescription: `Extracted from document. Found ${Object.keys(confidenceScores).length} fields.`,
    confidenceScores,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
    errors,
  };
}

/**
 * Call Ollama for OCR if available
 */
export async function extractViaOllama(imageBase64: string): Promise<string> {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt: `Extract all text from this document image. Focus on: dates, amounts, vendor name, currency. Be precise.\n\n[IMAGE_DATA: ${imageBase64}]`,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || "";
  } catch (error) {
    console.warn("Ollama extraction failed:", error);
    throw error;
  }
}

/**
 * Main extraction function - tries Ollama first, falls back to regex
 */
export async function extractDocumentData(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ExtractionData> {
  let rawText = "";

  // Try Ollama for image files
  if (mimeType.startsWith("image/")) {
    try {
      const imageBase64 = fileBuffer.toString("base64");
      rawText = await extractViaOllama(imageBase64);
    } catch (error) {
      console.warn("OCR extraction failed, using fallback");
    }
  }

  // For PDFs or if OCR failed, generate synthetic extraction
  if (!rawText) {
    // In Phase 2, integrate pdfjs or pdf-parse for PDF extraction
    rawText = `[PDF Content - Phase 2]\nDocument contains financial information. Manual review recommended.`;
  }

  // Extract structured data from raw text
  return extractFromText(rawText);
}

/**
 * Sanitize vendor name for AI prompts (prevent injection)
 */
export function sanitizeVendorName(vendor: string): string {
  return vendor
    .replace(/[<>"'`]/g, "") // Remove quotes and brackets
    .substring(0, 255) // Limit length
    .trim();
}
