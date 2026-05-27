# Requirement Doc — REQ-001: Document Upload Pipeline

**Status:** APPROVED
**Author:** technical-ba
**Date:** 2026-05-26
**Security Review:** APPROVED_WITH_NOTES (2026-05-26)
**Phase:** MVP Phase 1 (Local Development)

---

## Business Context

The application needs to accept financial documents from users and process them. The upload mechanism is the entry point for all document-based workflows. A seamless, responsive upload experience is critical for user adoption.

**Problem:** Users currently must manually categorize and track expenses in Excel. The first step to automation is accepting diverse document formats (PDFs, receipts, invoices, bank statements, credit card statements) with zero friction.

**Solution:** Implement a drag-and-drop upload component with validation, progress feedback, and immediate processing queuing.

---

## User Stories

1. **As a User**, I want to **drag and drop financial documents onto the dashboard**, so that **I can quickly upload receipts without navigating file dialogs.**

2. **As a User**, I want to **upload multiple documents simultaneously**, so that **I can batch-load a week's worth of receipts in one action.**

3. **As a User**, I want to **see real-time progress and status feedback during upload**, so that **I know my documents are being processed.**

4. **As a User**, I want to **receive clear error messages if a file is invalid**, so that **I can correct the issue and retry immediately.**

5. **As a System**, I want to **queue documents for processing** automatically upon successful upload, so that **the extraction pipeline can process them asynchronously.**

---

## Acceptance Criteria

### AC-001: Drag-and-Drop Upload

```gherkin
Given: User is on the dashboard
When: User drags a PDF/JPG/PNG file onto the designated drop zone
Then: File is accepted and upload begins immediately
And: User sees a progress indicator
And: File is not uploaded if the drop zone is not focused
```

### AC-002: File Type Validation

```gherkin
Given: User selects or drags a file
When: File extension is checked
Then: Allowed types (PDF, JPG, JPEG, PNG) are accepted
And: Other file types show an error message: "Solo se aceptan PDF, JPG, PNG"
And: File size must be ≤ 5MB, else: "Archivo demasiado grande (máx 5MB)"
```

### AC-003: Multiple File Upload

```gherkin
Given: User drags 5 PDF files onto the drop zone
When: Files are validated
Then: All 5 files are queued for upload in parallel
And: Progress is shown per file
And: User can cancel individual uploads
```

### AC-004: Upload Success Feedback

```gherkin
Given: A file has been successfully uploaded
When: Upload completes
Then: File is removed from the upload queue
And: User sees a success message: "Documento subido correctamente"
And: Document appears in the "Processing" state on the dashboard
```

### AC-005: Upload Error Handling

```gherkin
Given: Upload fails (network, file system, virus scan)
When: Error is received
Then: User sees error message in Spanish (e.g., "Error al subir archivo")
And: File remains in upload queue for retry
And: User can attempt upload again
```

### AC-006: Asynchronous Processing Queue

```gherkin
Given: File has been successfully uploaded
When: Upload completes
Then: Document is automatically queued to the processing pipeline
And: Processing job is created in pg-boss
And: User can see "En procesamiento..." status without waiting
```

---

## Data Model

| Field               | Type         | Nullable | Notes                                                    |
| ------------------- | ------------ | -------- | -------------------------------------------------------- |
| `id`                | UUID         | No       | Primary key                                              |
| `filename`          | VARCHAR(255) | No       | Original filename                                        |
| `file_size`         | INTEGER      | No       | Size in bytes                                            |
| `mime_type`         | VARCHAR(50)  | No       | Detected MIME type                                       |
| `file_path`         | TEXT         | No       | Path in filesystem storage                               |
| `upload_status`     | ENUM         | No       | `uploaded`, `processing`, `completed`, `failed`          |
| `processing_status` | ENUM         | No       | `pending`, `extracting`, `categorizing`, `done`, `error` |
| `uploaded_at`       | TIMESTAMP    | No       | ISO 8601                                                 |
| `processed_at`      | TIMESTAMP    | Yes      | ISO 8601 when done                                       |
| `error_message`     | TEXT         | Yes      | If processing failed                                     |
| `user_id`           | UUID         | Yes      | For future multi-user (Phase 2)                          |

---

## API Contract Reference

See: `.agents/artifacts/api-docs/upload-api.yaml`

**Key Endpoints:**

- `POST /api/documents/upload` — Upload single or multiple files
- `GET /api/documents/{id}/status` — Poll upload/processing status
- `DELETE /api/documents/{id}` — Cancel or remove document

---

## UI/UX Specifications

### Upload Component Layout

```
┌─────────────────────────────────────────┐
│  Cargar documentos financieros          │
├─────────────────────────────────────────┤
│                                         │
│   ┌─────────────────────────────────┐  │
│   │  📁 Arrastra archivos aquí      │  │
│   │     o haz clic para seleccionar │  │
│   │                                 │  │
│   │  PDF, JPG, PNG (máx 5MB)        │  │
│   └─────────────────────────────────┘  │
│                                         │
│  Archivos en cola:                      │
│  ├─ Receipt_2026-05.pdf ████░ 75%      │
│  ├─ Invoice_001.jpg      ██████░ 95%   │
│  └─ Bank_Statement.pdf   ███░ 40%      │
│                                         │
└─────────────────────────────────────────┘
```

### Status Messages (Spanish)

- Upload progress: "Subiendo... X%"
- Success: "Documento subido correctamente"
- Queued: "En cola para procesamiento"
- Processing: "Procesando documento..."
- Error: "Error al subir: [reason]"

---

## Technical Considerations

1. **File Storage:** Filesystem at `./storage/documents/{year}/{month}/{uuid}.{ext}`
2. **Temporary Files:** Cleaned up after successful processing (pg-boss cleanup task)
3. **CORS:** Configure to allow frontend origin
4. **Multipart Upload:** Use `multipart/form-data` with streaming
5. **Rate Limiting:** Implement to prevent abuse (TBD in infrastructure)
6. **Virus Scanning:** Optional Phase 1, recommended Phase 2 (ClamAV integration)

---

## Open Questions

- [ ] Should virus scanning be included in MVP? (Recommendation: Skip Phase 1, add Phase 2)
- [ ] Max concurrent upload threads per user? (Recommendation: 3)
- [ ] Should we support nested ZIP archives? (Recommendation: No, Phase 2 feature)

---

## Dependencies

- **REQ-002:** Extraction pipeline must exist to queue jobs
- **REQ-004:** Dashboard must display document status
- **Infrastructure:** File storage directory must exist

---

## Effort Estimate

- Backend API: 4 hours
- Frontend Component: 3 hours
- Integration testing: 2 hours
- **Total: ~9 hours**

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

1. [Severity: High] — File Upload Abuse: MIME type validation only on extension, not content
   Recommendation: Implement magic byte validation (file signature) in addition to extension checks. Use library like `file-type` to detect actual file content.

2. [Severity: High] — File Upload Abuse: Original filename directly used in storage path
   Recommendation: Sanitize filenames or use UUID-based naming (already noted in spec). Ensure no path traversal (../) possible.

3. [Severity: Medium] — Information Leakage: File size/metadata exposed to UI
   Recommendation: Fine-grained access control per document (Phase 2 for multi-user). Currently OK for single-user MVP.

4. [Severity: Medium] — Malware Scanning: Not included in MVP
   Recommendation: Document that virus/malware scanning is Phase 2 requirement. Acceptable for local MVP, mandatory for cloud Phase 2.

5. [Severity: Low] — Rate Limiting: Not specified
   Recommendation: Implement IP-based rate limiting (3 requests per minute) to prevent abuse. Add to infrastructure spec.

Notes:

- File storage path uses UUID + timestamp, which is good for preventing traversal
- CORS configuration properly scoped to frontend origin
- Multipart form handling follows OWASP guidelines
- Max file size (5MB) is reasonable for local development

Conditional Approval: Implement magic byte validation before production deployment. MVP may proceed with recommendations noted for Phase 2.
