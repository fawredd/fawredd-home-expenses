# Requirement Doc — REQ-002: Document Extraction Pipeline

**Status:** APPROVED
**Author:** technical-ba
**Date:** 2026-05-26
**Security Review:** APPROVED_WITH_NOTES (2026-05-26)
**Phase:** MVP Phase 1 (Local Development)

---

## Business Context

Once documents are uploaded, the system must automatically extract structured financial data. This is the core automation that eliminates manual data entry.

**Problem:** Users currently manually read documents and type data into Excel.

**Solution:** Implement a multi-stage extraction pipeline:

1. **OCR** — Convert image/PDF to readable text (Tesseract)
2. **Parsing** — Extract structured fields (date, amount, vendor, type)
3. **Normalization** — Clean and standardize extracted data
4. **Quality Scoring** — Assess extraction confidence

The pipeline runs asynchronously via pg-boss after upload succeeds.

---

## User Stories

1. **As a User**, I want documents to be **automatically analyzed for financial data**, so that **I don't manually type amounts, dates, vendors.**

2. **As a System**, I want to **extract key fields (date, amount, currency, vendor, document type)**, so that **we have structured data for categorization.**

3. **As a System**, I want to **assign a confidence score to each extraction**, so that **low-confidence extractions can be flagged for review.**

4. **As a User**, I want to **see extracted data in the UI for manual correction**, so that **I can fix OCR mistakes before categorization.**

---

## Acceptance Criteria

### AC-001: OCR Processing

```gherkin
Given: A PDF or image document is queued for extraction
When: OCR job starts via pg-boss
Then: Tesseract processes the image
And: Text is extracted with language detection (Spanish/English)
And: Processing time is logged
And: If OCR fails, error is recorded with message
```

### AC-002: Structured Data Extraction

```gherkin
Given: OCR text is available
When: Parser processes the text
Then: System attempts to extract:
  - Transaction date (DATE)
  - Amount (DECIMAL)
  - Currency (VARCHAR: ARS, USD, etc.)
  - Vendor/Merchant name (VARCHAR)
  - Document type (ENUM: receipt, invoice, statement, etc.)
  - Description (TEXT)
And: Each field has NULL if not found
And: Extraction is logged for audit
```

### AC-003: Data Normalization

```gherkin
Given: Raw extracted fields exist
When: Normalization runs
Then: Date is converted to ISO 8601 format
And: Amount has currency symbol removed, decimals standardized
And: Vendor name is trimmed, case-normalized
And: All NULL fields remain NULL
```

### AC-004: Confidence Scoring

```gherkin
Given: Extraction is complete
When: Scoring algorithm runs
Then: Each field gets a confidence score (0.0 - 1.0)
And: Document gets overall confidence (avg of field scores)
And: Score < 0.7 flags document as "requires review"
And: Score stored in database
```

### AC-005: Extraction Errors

```gherkin
Given: OCR or parsing fails
When: Error occurs
Then: Error message is captured
And: Document status becomes "failed"
And: Error is shown to user: "No se pudo procesar el documento"
And: User can re-upload or view error details
```

---

## Data Model

### Extraction Result (New Table)

| Field                     | Type          | Nullable | Notes                               |
| ------------------------- | ------------- | -------- | ----------------------------------- |
| `id`                      | UUID          | No       | Primary key                         |
| `document_id`             | UUID          | No       | FK to documents                     |
| `raw_ocr_text`            | TEXT          | Yes      | Full OCR output                     |
| `extracted_date`          | DATE          | Yes      | Parsed transaction date             |
| `extracted_amount`        | DECIMAL(15,2) | Yes      | Transaction amount                  |
| `extracted_currency`      | VARCHAR(3)    | Yes      | ISO 4217 code (ARS, USD)            |
| `extracted_vendor`        | VARCHAR(255)  | Yes      | Merchant/vendor name                |
| `extracted_document_type` | ENUM          | Yes      | receipt, invoice, statement, ticket |
| `extracted_description`   | TEXT          | Yes      | Full description                    |
| `confidence_score`        | DECIMAL(3,2)  | No       | 0.0 - 1.0 (field-level in JSON)     |
| `overall_confidence`      | DECIMAL(3,2)  | No       | Average confidence                  |
| `extraction_errors`       | JSONB         | Yes      | Array of field-level errors         |
| `extracted_at`            | TIMESTAMP     | No       | ISO 8601                            |

### Confidence Scores (JSON structure)

```json
{
  "date_confidence": 0.85,
  "amount_confidence": 0.95,
  "currency_confidence": 0.92,
  "vendor_confidence": 0.78,
  "type_confidence": 0.88,
  "overall": 0.87
}
```

---

## API Contract Reference

See: `.agents/artifacts/api-docs/extraction-api.yaml`

**Key Endpoints:**

- `GET /api/documents/{id}/extraction` — Get extraction results
- `PUT /api/documents/{id}/extraction` — Update extraction manually
- `POST /api/documents/{id}/reprocess` — Rerun extraction

---

## Processing Architecture

### Async Job Flow (pg-boss)

```
Document Uploaded
    ↓
[Job Created: extract_document]
    ↓
Queue → Worker Process
    ├─ OCR (Tesseract)
    ├─ Parse (Heuristics)
    ├─ Normalize
    ├─ Score
    ├─ Store Results
    └─ Queue Next: categorize_document
    ↓
Document Status: "Extracted" → Next: Categorization
```

### Extraction Pipeline Stages

1. **OCR Stage** (Tesseract)
   - Input: PDF/Image binary
   - Output: Plain text + confidence
   - Fallback: If PDF is already text, extract directly
   - Timeout: 30 seconds

2. **Parsing Stage** (Heuristics)
   - Regex patterns for date (DD/MM/YYYY, MM/DD/YYYY)
   - Amount detection ($1,234.56, 1.234,56)
   - Vendor name extraction (common keywords)
   - Type detection (keywords: "factura", "recibo", "estado de cuenta")
   - Timeout: 5 seconds

3. **Normalization Stage**
   - Date → ISO 8601 (YYYY-MM-DD)
   - Amount → Decimal(15,2)
   - Currency → ISO 4217 code
   - Vendor → Trim, lowercase for matching
   - Timeout: 2 seconds

4. **Scoring Stage**
   - Field-level: Confidence of extraction accuracy
   - Overall: Average of field scores
   - Threshold: < 0.7 = "requires review"
   - Timeout: 1 second

---

## Technical Specifications

### OCR Integration

- **Library:** Tesseract (via Ollama or local binary)
- **Languages:** Spanish, English
- **Supported formats:** PDF (via pdfimages), JPG, PNG
- **Config:** DPI normalization for poor scans

### Parser Heuristics

- Date patterns: Multiple formats (AR, US conventions)
- Amount patterns: With/without currency symbols, thousands separators
- Vendor patterns: Common words (supermercado, farmacia, combustible)
- Type inference: Keywords from document text

### Error Handling

- OCR timeout → Error captured, document flagged
- Parse failures → NULL fields, low confidence
- Extraction not reprocessed automatically (user must retry)

### Performance Targets

- Average extraction time: 5-15 seconds per document
- OCR: 10 seconds for 1-page receipt
- Parsing: < 5 seconds for structured extraction
- Database write: < 1 second

---

## Open Questions

- [ ] Should we store raw OCR text for debugging? (Recommendation: Yes, for Phase 1 debugging, remove in Phase 2)
- [ ] OCR preprocessing (deskew, denoise)? (Recommendation: Yes, for poor-quality scans)
- [ ] Multilingual OCR or Spanish-only Phase 1? (Recommendation: Spanish + English Phase 1, more languages Phase 2)

---

## Dependencies

- **REQ-001:** Document upload must succeed first
- **REQ-004:** Extraction must feed into categorization
- **Infrastructure:** Tesseract/Ollama must be available

---

## Effort Estimate

- OCR integration: 3 hours
- Parser heuristics: 4 hours
- Normalization: 2 hours
- Scoring: 2 hours
- Testing: 3 hours
- **Total: ~14 hours**

---

## Approval Checklist

- [ ] Security review passed
- [ ] Technical BA approves
- [ ] PM approves scope

---

[SECURITY_REVIEW]
Reviewer: security-engineer
Date: 2026-05-26
Status: [APPROVED_WITH_NOTES]

Findings:

1. [Severity: High] — Sensitive Data Exposure: Raw OCR text stored in database
   Recommendation: Mark field as sensitive in logging. Ensure database backups are encrypted. Do NOT log raw OCR text to application logs (use hashed reference instead).

2. [Severity: Medium] — Input Validation: OCR text not sanitized before parsing
   Recommendation: Validate extracted fields against schema (Zod) before storage. Reject obviously malformed data (e.g., amount = "hello").

3. [Severity: Medium] — Injection Prevention: Regex patterns in parser must be carefully constructed
   Recommendation: Use well-tested regex libraries. Unit test regex patterns against adversarial inputs (SQL injection attempts in vendor name, etc.).

4. [Severity: Low] — Error Information Leakage: Detailed OCR errors shown to user
   Recommendation: Log full errors server-side, show generic "Processing failed" to user. Include reference ID for support inquiries.

Notes:

- Extraction pipeline is mostly deterministic (OCR → regex), low injection risk
- Confidence scoring is not user-influenced, good design
- Extraction errors properly captured and tracked
- Timeout protections prevent DoS via malicious files

Conditional Approval: Implement input validation with Zod before storage. MVP may proceed.
