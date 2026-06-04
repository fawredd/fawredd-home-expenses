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
  date: /(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})/g,
  amountSymbol:
    /(?:[$€¥₹₽]|ARS|USD|EUR|UYU|US\$|U\$S)\s*[0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?/gi,
  amount: /[0-9]{1,3}(?:[.,][0-9]{3})*(?:[.,][0-9]{2})?/g,
  vendor: /^([A-ZÁÉÍÓÚÑ][A-Za-zÁÉÍÓÚÑáéíóúñ\s&]{3,60})$/gm,
  invoice: /invoice|recibo|factura|comprobante/i,
  receipt: /receipt|ticket|recibo|boleta/i,
  statement: /statement|estado de cuenta|extracto/i,
  ticket: /ticket|boleta|tique/i,
};

const LABELS = {
  amount: /total|importe|monto|saldo|neto|subtotal|pagado|debe|haber/i,
  date: /fecha|vencimiento|emisión|emision|expedido|emitido/i,
  vendor: /raz[oó]n social|proveedor|emisor|empresa|comercio|sucursal/i,
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
  let cleaned = amountStr.replace(/[\$€¥₹₽\s]/g, "");
  if (cleaned.includes(",")) {
    cleaned = cleaned.replace(/\.(?=.*?,)/g, "").replace(/,/g, ".");
  }

  const amount = parseFloat(cleaned);
  return !isNaN(amount) && amount > 0 ? amount : null;
}

function extractCurrency(line: string): string | undefined {
  const normalized = line.toUpperCase();
  if (normalized.includes("USD") || normalized.includes("US$")) return "USD";
  if (normalized.includes("EUR") || normalized.includes("€")) return "EUR";
  if (normalized.includes("UYU")) return "UYU";
  if (normalized.includes("ARS") || normalized.includes("$")) return "ARS";
  return undefined;
}

function extractAmountFromLine(line: string): number | undefined {
  const symbolMatch = line.match(PATTERNS.amountSymbol);
  if (symbolMatch) {
    for (const match of symbolMatch) {
      const parsed = parseAmount(match);
      if (parsed) return parsed;
    }
  }

  const amountMatch = line.match(PATTERNS.amount);
  if (amountMatch) {
    for (const match of amountMatch.reverse()) {
      const parsed = parseAmount(match);
      if (parsed) return parsed;
    }
  }

  return undefined;
}

function findBestDate(lines: string[]): string | undefined {
  for (const line of lines) {
    if (LABELS.date.test(line)) {
      const match = line.match(PATTERNS.date);
      if (match) {
        return parseDate(match[0]) || undefined;
      }
    }
  }

  for (const line of lines) {
    const match = line.match(PATTERNS.date);
    if (match) {
      return parseDate(match[0]) || undefined;
    }
  }

  return undefined;
}

function findBestVendor(lines: string[]): string | undefined {
  const candidate = lines.find((line) => LABELS.vendor.test(line));
  if (candidate) {
    const parts = candidate.split(/[:\-–]/);
    return parts.length > 1
      ? parts.slice(1).join(" ").trim()
      : candidate.trim();
  }

  const topLines = lines.slice(0, 8).filter(Boolean);
  const vendorLine = topLines.find(
    (line) =>
      /^[A-ZÁÉÍÓÚÑ]/.test(line) &&
      !LABELS.date.test(line) &&
      !LABELS.amount.test(line) &&
      !/cuit|cuil|telefono|tel\.|nro\.|direcci[oó]n|domicilio/i.test(line),
  );
  if (vendorLine) return vendorLine.trim();

  return topLines[0]?.trim();
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

  const cleanText = rawText
    .replace(/[ \t\v\f\r]+/g, " ")
    .replace(/\n+/g, "\n")
    .trim()
    .substring(0, 10000);

  const lines = cleanText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  let extractedDate = findBestDate(lines);
  if (!extractedDate) {
    const dateMatches = cleanText.match(PATTERNS.date);
    extractedDate = dateMatches
      ? parseDate(dateMatches[0]) || undefined
      : undefined;
  }
  if (extractedDate) {
    confidenceScores.date = 0.9;
  } else {
    errors.push("No date found");
    confidenceScores.date = 0;
  }

  let extractedAmount = extractAmountFromLine(
    lines.find((line) => LABELS.amount.test(line)) || "",
  );

  if (!extractedAmount) {
    for (const line of lines) {
      if (/\d/.test(line)) {
        const value = extractAmountFromLine(line);
        if (value) {
          extractedAmount = value;
          break;
        }
      }
    }
  }

  if (extractedAmount) {
    confidenceScores.amount = 0.92;
  } else {
    errors.push("No amount found");
    confidenceScores.amount = 0;
  }

  const extractedVendor = findBestVendor(lines);
  if (extractedVendor) {
    confidenceScores.vendor = 0.8;
  } else {
    errors.push("No vendor found");
    confidenceScores.vendor = 0;
  }

  const extractedDocumentType = detectDocumentType(cleanText);
  confidenceScores.documentType = 0.75;

  if (extractedAmount && extractedDate && !extractCurrency(cleanText)) {
    confidenceScores.currency = 0.7;
  }

  const scores = Object.values(confidenceScores);
  overallConfidence =
    scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;

  const vendorDescription = extractedVendor ? `Vendor: ${extractedVendor}` : "";

  return {
    rawText: cleanText,
    extractedDate,
    extractedAmount,
    extractedCurrency: extractCurrency(cleanText) || "ARS",
    extractedVendor,
    extractedDocumentType,
    extractedDescription: `Extracted from document. ${vendorDescription}`,
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
    const prompt = `Eres un extractor financiero experto. Extrae solo JSON válido con las siguientes claves: extractedDate, extractedAmount, extractedCurrency, extractedVendor, extractedDocumentType, extractedDescription.\n\nTexto del documento (preserva saltos de línea y páginas si existen):\n${trimmedText}\n\nDevuelve solo JSON.`;

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
 * Parse PDF file text using pdf-parse while preserving relative layout.
 */
async function extractTextFromPdf(fileBuffer: Buffer): Promise<string> {
  try {
    const pdfModule = await import("pdf-parse");
    const pdfParse: (
      buffer: Buffer,
      options?: Record<string, unknown>,
    ) => Promise<{ text: string }> = pdfModule.default ?? pdfModule;

    type PdfPageData = {
      getTextContent: (options: { normalizeWhitespace: boolean }) => Promise<{
        items: Array<{
          str: string;
          transform?: [number, number, number, number, number, number];
        }>;
      }>;
    };

    const options = {
      pagerender: async (pageData: PdfPageData) => {
        const textContent = await pageData.getTextContent({
          normalizeWhitespace: true,
        });
        const items = textContent.items;

        const lines: Array<{ y: number; items: typeof items }> = [];
        for (const item of items) {
          const y = item.transform?.[5] ?? 0;
          const line = lines.find((entry) => Math.abs(entry.y - y) < 5);
          if (line) {
            line.items.push(item);
          } else {
            lines.push({ y, items: [item] });
          }
        }

        return lines
          .sort((a, b) => b.y - a.y)
          .map((line) =>
            line.items
              .sort((a, b) => (a.transform?.[4] ?? 0) - (b.transform?.[4] ?? 0))
              .map((item) => item.str)
              .join(" ")
              .trim(),
          )
          .filter(Boolean)
          .join("\n");
      },
    };

    const data = await pdfParse(fileBuffer, options);
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
      rawText = "[PDF appears to be image-only or text extraction failed]";
      extractionMethod = "pdf-parse-no-text";
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
