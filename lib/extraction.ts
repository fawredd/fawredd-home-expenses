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
  extractionMethod?: string;
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

  // Clean text while preserving line breaks for vendor extraction
  const cleanText = rawText
    .replace(/[ \t\v\f\r]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim()
    .substring(0, 10000); // Limit to 10k chars

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
 * Call Ollama to infer structured fields from extracted text
 */
async function extractFieldsFromAI(
  text: string,
): Promise<Partial<ExtractionData>> {
  try {
    const ollamaUrl = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
    const trimmedText = text.trim().substring(0, 4500);
    const prompt = `Eres un extractor financiero experto. Extrae solo JSON válido con las siguientes claves: extractedDate, extractedAmount, extractedCurrency, extractedVendor, extractedDocumentType, extractedDescription.\n\nTexto del documento:\n${trimmedText}\n\nDevuelve solo JSON.`;

    const response = await fetch(`${ollamaUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "mistral",
        prompt,
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama AI field extraction failed: ${response.status}`);
    }

    const data = await response.json();
    const aiText = (data.response || "")
      .trim()
      .replace(/^```(?:json)?/, "")
      .replace(/```$/, "");
    const parsed = JSON.parse(aiText);

    return {
      extractedDate:
        typeof parsed.extractedDate === "string"
          ? parsed.extractedDate
          : undefined,
      extractedAmount:
        typeof parsed.extractedAmount === "number"
          ? parsed.extractedAmount
          : parseAmount(String(parsed.extractedAmount || "")) || undefined,
      extractedCurrency:
        typeof parsed.extractedCurrency === "string" &&
        parsed.extractedCurrency.length > 0
          ? parsed.extractedCurrency.toUpperCase()
          : undefined,
      extractedVendor:
        typeof parsed.extractedVendor === "string"
          ? parsed.extractedVendor
          : undefined,
      extractedDocumentType:
        typeof parsed.extractedDocumentType === "string"
          ? (parsed.extractedDocumentType as
              | "receipt"
              | "invoice"
              | "statement"
              | "ticket"
              | "other")
          : undefined,
      extractedDescription:
        typeof parsed.extractedDescription === "string"
          ? parsed.extractedDescription
          : undefined,
    };
  } catch (error) {
    console.warn("AI field extraction failed:", error);
    return {};
  }
}

/**
 * Parse PDF file text using pdf-parse
 */
async function extractTextFromPdf(fileBuffer: Buffer): Promise<string> {
  try {
    const pdfParse = await import("pdf-parse");
    const data = await pdfParse.default(fileBuffer);
    return data.text || "";
  } catch (error) {
    console.warn("PDF text extraction failed:", error);
    return "";
  }
}

/**
 * Main extraction function - tries PDF parsing or OCR first, then AI can enhance missing fields
 */
export async function extractDocumentData(
  fileBuffer: Buffer,
  mimeType: string,
): Promise<ExtractionData> {
  let rawText = "";
  let extractionMethod = "ocr";

  if (mimeType === "application/pdf") {
    extractionMethod = "pdf-parse";
    rawText = await extractTextFromPdf(fileBuffer);
    if (!rawText) {
      rawText = "[PDF extraction failed: no text content found]";
    }
  } else if (mimeType.startsWith("image/")) {
    extractionMethod = "ocr";
    try {
      const imageBase64 = fileBuffer.toString("base64");
      rawText = await extractViaOllama(imageBase64);
    } catch {
      rawText = "";
    }
  }

  if (!rawText) {
    rawText = "[No text was extracted from the document.]";
  }

  let extraction = extractFromText(rawText);
  extraction.extractionMethod = extractionMethod;

  const needsAiEnhancement =
    extraction.overallConfidence < 0.75 ||
    !extraction.extractedVendor ||
    !extraction.extractedAmount ||
    !extraction.extractedDate;

  if (needsAiEnhancement) {
    const aiFields = await extractFieldsFromAI(rawText);
    extraction = {
      ...extraction,
      extractedDate: aiFields.extractedDate || extraction.extractedDate,
      extractedAmount: aiFields.extractedAmount || extraction.extractedAmount,
      extractedCurrency:
        aiFields.extractedCurrency || extraction.extractedCurrency,
      extractedVendor: aiFields.extractedVendor || extraction.extractedVendor,
      extractedDocumentType:
        aiFields.extractedDocumentType || extraction.extractedDocumentType,
      extractedDescription:
        aiFields.extractedDescription || extraction.extractedDescription,
      confidenceScores: {
        ...extraction.confidenceScores,
        ...(aiFields.extractedDate ? { date: 0.8 } : {}),
        ...(aiFields.extractedAmount ? { amount: 0.8 } : {}),
        ...(aiFields.extractedVendor ? { vendor: 0.75 } : {}),
      },
    };

    const mergedScores = Object.values(extraction.confidenceScores);
    extraction.overallConfidence =
      mergedScores.length > 0
        ? Math.round(
            (mergedScores.reduce((a, b) => a + b, 0) / mergedScores.length) *
              100,
          ) / 100
        : extraction.overallConfidence;
    extraction.extractionMethod = `${extractionMethod}-ai-enhanced`;
  }

  return extraction;
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
