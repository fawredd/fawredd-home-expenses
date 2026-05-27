# Requirement Doc — REQ-005: Database Schema & Persistence Layer

**Status:** APPROVED
**Author:** technical-ba
**Date:** 2026-05-26
**Security Review:** APPROVED_WITH_NOTES (2026-05-26)
**Phase:** MVP Phase 1 (Local Development)

---

## Business Context

All application data must be persisted in PostgreSQL. The schema must support:

- Document storage metadata
- Extracted movement data
- Categorization with learning
- RAG embeddings for intelligent categorization
- User corrections for continuous improvement

**Requirements:** Type-safe ORM (Drizzle), migrations, seed data, efficient queries.

---

## User Stories

1. **As a System**, I want to **persist documents, extractions, and categorizations reliably**, so that **data is never lost.**

2. **As a System**, I want to **efficiently query movements by date, category, vendor**, so that **dashboard queries are fast.**

3. **As a System**, I want to **track user corrections**, so that **we can improve categorization algorithms.**

4. **As a System**, I want to **store vector embeddings for RAG**, so that **similar movements can be retrieved efficiently.**

---

## Acceptance Criteria

### AC-001: Schema Creation

```gherkin
Given: PostgreSQL is running
When: Drizzle migration runs
Then: All tables are created with correct types and constraints
And: Indexes are created for query optimization
And: pgvector extension is installed
And: Foreign keys maintain referential integrity
```

### AC-002: Document Tracking

```gherkin
Given: User uploads a document
When: Document is saved
Then: Document record includes:
  - filename, file_path, file_size, mime_type
  - upload_status, processing_status
  - uploaded_at, processed_at timestamps
And: Document tracks all related extractions and categorizations
```

### AC-003: Movement Extraction Storage

```gherkin
Given: OCR and parsing complete
When: Extraction is stored
Then: All extracted fields are persisted:
  - date, amount, currency, vendor, type, description
  - confidence scores (per field + overall)
And: Raw OCR text is stored for debugging
And: Extraction is linked to source document
```

### AC-004: Categorization Persistence

```gherkin
Given: Movement is categorized
When: Category is assigned
Then: System records:
  - category_id (FK to categories table)
  - confidence_score
  - categorization_method (rule/rag/ai/manual)
  - is_manual_correction flag
And: User corrections are timestamped
And: History is preserved for audit
```

### AC-005: RAG Embedding Storage

```gherkin
Given: Movement is categorized
When: RAG embedding is generated
Then: Vector is stored:
  - movement_id (FK)
  - vendor_name (for retrieval)
  - category_id
  - embedding vector (pgvector)
And: Vectors are indexed for efficient similarity search
```

### AC-006: Migration History

```gherkin
Given: Schema changes are needed
When: Drizzle migration is created
Then: Migration file is generated in ./drizzle/migrations/
And: Migration can be applied and rolled back
And: Migration history is tracked in _drizzle_journal table
```

### AC-007: Seed Data

```gherkin
Given: Fresh database is initialized
When: Seed script runs
Then: Default categories are created
And: Sample movements can be optionally loaded
And: System is ready for operation
```

---

## Complete Data Model

### Core Tables

#### 1. documents

Primary storage for uploaded files.

```sql
CREATE TABLE documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename VARCHAR(255) NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  upload_status ENUM NOT NULL DEFAULT 'uploaded',
  processing_status ENUM NOT NULL DEFAULT 'pending',
  uploaded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP,
  error_message TEXT,
  user_id UUID,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ENUM types
CREATE TYPE upload_status AS ENUM ('uploaded', 'processing', 'completed', 'failed');
CREATE TYPE processing_status AS ENUM ('pending', 'extracting', 'categorizing', 'done', 'error');
```

#### 2. extractions

Stores OCR and parsing results.

```sql
CREATE TABLE extractions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  raw_ocr_text TEXT,
  extracted_date DATE,
  extracted_amount DECIMAL(15,2),
  extracted_currency VARCHAR(3),
  extracted_vendor VARCHAR(255),
  extracted_document_type VARCHAR(50),
  extracted_description TEXT,
  confidence_scores JSONB NOT NULL DEFAULT '{}',
  overall_confidence DECIMAL(3,2) NOT NULL,
  extraction_errors JSONB,
  extraction_method VARCHAR(50) NOT NULL DEFAULT 'ocr',
  extracted_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- JSONB structure for confidence_scores:
-- { "date_confidence": 0.95, "amount_confidence": 0.92, ... }
```

#### 3. categories

Hierarchical taxonomy of expense/income categories.

```sql
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  parent_id UUID REFERENCES categories(id),
  color VARCHAR(7),
  icon VARCHAR(50),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 4. movements

Core financial movements (extracted and categorized).

```sql
CREATE TABLE movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  extraction_id UUID NOT NULL REFERENCES extractions(id) ON DELETE CASCADE,
  category_id UUID REFERENCES categories(id),
  transaction_date DATE NOT NULL,
  vendor_name VARCHAR(255),
  amount DECIMAL(15,2) NOT NULL,
  currency VARCHAR(3) NOT NULL DEFAULT 'ARS',
  movement_type ENUM NOT NULL,
  description TEXT,
  confidence_score DECIMAL(3,2),
  categorization_method VARCHAR(50),
  is_reviewed BOOLEAN NOT NULL DEFAULT FALSE,
  is_manual_correction BOOLEAN NOT NULL DEFAULT FALSE,
  corrected_at TIMESTAMP,
  corrected_category_id UUID REFERENCES categories(id),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ENUM type
CREATE TYPE movement_type AS ENUM ('income', 'expense');
```

#### 5. rag_embeddings

Vector store for categorization memory (requires pgvector extension).

```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE rag_embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
  vendor_name VARCHAR(255) NOT NULL,
  category_id UUID NOT NULL REFERENCES categories(id),
  embedding vector(384) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create index for efficient similarity search
CREATE INDEX idx_rag_embeddings_embedding ON rag_embeddings USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX idx_rag_embeddings_vendor ON rag_embeddings(vendor_name);
```

#### 6. user_corrections

Track user feedback for learning and audit.

```sql
CREATE TABLE user_corrections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  movement_id UUID NOT NULL REFERENCES movements(id) ON DELETE CASCADE,
  old_category_id UUID,
  new_category_id UUID NOT NULL REFERENCES categories(id),
  reason TEXT,
  corrected_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

#### 7. processing_jobs

Background job tracking (pg-boss integration).

```sql
CREATE TABLE processing_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id),
  movement_id UUID REFERENCES movements(id),
  job_type VARCHAR(50) NOT NULL,
  job_status VARCHAR(50) NOT NULL DEFAULT 'pending',
  priority INTEGER DEFAULT 0,
  retry_count INTEGER DEFAULT 0,
  error_details JSONB,
  started_at TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ENUM type
CREATE TYPE job_type AS ENUM ('extract_document', 'categorize_movement', 'cleanup_file');
CREATE TYPE job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'retry');
```

---

## Indexing Strategy

```sql
-- Document queries
CREATE INDEX idx_documents_upload_status ON documents(upload_status);
CREATE INDEX idx_documents_uploaded_at ON documents(uploaded_at DESC);
CREATE INDEX idx_documents_user_id ON documents(user_id);

-- Movement queries (critical for dashboard)
CREATE INDEX idx_movements_transaction_date ON movements(transaction_date DESC);
CREATE INDEX idx_movements_category_id ON movements(category_id);
CREATE INDEX idx_movements_vendor_name ON movements(vendor_name);
CREATE INDEX idx_movements_movement_type ON movements(movement_type);
CREATE INDEX idx_movements_is_reviewed ON movements(is_reviewed);

-- Extraction queries
CREATE INDEX idx_extractions_document_id ON extractions(document_id);
CREATE INDEX idx_extractions_overall_confidence ON extractions(overall_confidence DESC);

-- Date range queries (monthly aggregation)
CREATE INDEX idx_movements_date_category ON movements(
  DATE_TRUNC('month', transaction_date),
  category_id
);

-- RAG retrieval (pgvector specific)
CREATE INDEX idx_rag_embeddings_embedding ON rag_embeddings USING ivfflat (embedding vector_cosine_ops);
```

---

## Migrations Strategy

Using Drizzle ORM migrations:

```
drizzle/migrations/
├── 0001_initial_schema.sql
├── 0002_rag_embeddings.sql
├── 0003_processing_jobs.sql
└── ...
```

**Migration workflow:**

```bash
pnpm drizzle-kit generate:pg  # Generate migration from schema changes
pnpm drizzle-kit migrate:pg   # Apply migrations to dev database
pnpm drizzle-kit push:pg      # Push schema to database
```

---

## Seed Data

**Default Categories:**

```javascript
// drizzle/seed.ts
const SEED_CATEGORIES = [
  { id: "income", name: "Ingresos", parent_id: null, color: "#00C853" },
  { id: "expenses", name: "Gastos", parent_id: null, color: "#FF5252" },
  {
    id: "groceries",
    name: "Alimentos",
    parent_id: "expenses",
    color: "#FFA726",
  },
  {
    id: "utilities",
    name: "Servicios",
    parent_id: "expenses",
    color: "#42A5F5",
  },
  {
    id: "transportation",
    name: "Transporte",
    parent_id: "expenses",
    color: "#AB47BC",
  },
  { id: "healthcare", name: "Salud", parent_id: "expenses", color: "#EC407A" },
  {
    id: "entertainment",
    name: "Entretenimiento",
    parent_id: "expenses",
    color: "#29B6F6",
  },
  { id: "other", name: "Otros", parent_id: "expenses", color: "#9E9E9E" },
  {
    id: "uncategorized",
    name: "Sin Categorizar",
    parent_id: null,
    color: "#BDBDBD",
  },
];
```

---

## Data Retention & Cleanup

**Phase 1 (MVP):** No automatic cleanup (local development)

**Phase 2:** Implement policies:

- Document files: Delete after 1 year (keep metadata)
- Temporary extraction files: Delete after successful processing
- Audit logs: Retain indefinitely
- Vector embeddings: Archive old ones monthly

---

## Performance Metrics

**Query Targets:**

- Get all movements (with filter): < 500ms
- Monthly summary: < 1 second
- Category breakdown: < 1 second
- RAG retrieval (top-5 similar): < 300ms

**Data Growth Estimates (Year 1):**

- ~3,000 documents
- ~5,000 movements
- ~2,000 RAG embeddings
- ~500 user corrections

---

## Backup & Recovery

**Phase 1 (MVP):** Manual backups (PostgreSQL dump)

```bash
pg_dump fawredd_local > backup_$(date +%Y%m%d).sql
```

**Phase 2:** Automated daily backups (AWS RDS or similar)

---

## Open Questions

- [ ] Time-series compression for old data? (Recommendation: Phase 2)
- [ ] Data encryption at rest? (Recommendation: Phase 2)
- [ ] Row-level security (RLS) for multi-user? (Recommendation: Phase 2)

---

## Dependencies

- **Infrastructure:** PostgreSQL 14+, pgvector extension
- **ORM:** Drizzle ORM
- **Migrations:** Drizzle Migrations

---

## Effort Estimate

- Schema design: 2 hours
- Drizzle integration: 3 hours
- Migrations setup: 2 hours
- Seed data: 1 hour
- Testing: 2 hours
- **Total: ~10 hours**

---

## Approval Checklist

- [ ] Security review passed (encryption, PII, audit)
- [ ] Technical BA approves
- [ ] PM approves scope

---

[SECURITY_REVIEW]
Reviewer: security-engineer
Date: 2026-05-26
Status: [APPROVED_WITH_NOTES]

Findings:

1. [Severity: High] — SQL Injection Prevention: Drizzle ORM provides parameterized queries (good)
   Recommendation: Never use raw SQL. Validate all ORM queries through TypeScript layer. Document in coding standards.

2. [Severity: High] — Sensitive Data Exposure: Raw OCR text stored unencrypted
   Recommendation: Phase 2: Implement field-level encryption for raw_ocr_text (pgcrypto extension). MVP acceptable with note that local dev DB is not sensitive.

3. [Severity: Medium] — JSONB Field Validation: confidence_scores and extraction_errors are JSONB
   Recommendation: Validate JSONB structure in application code before storage. Define schema for JSONB fields (even though PostgreSQL is schema-flexible).

4. [Severity: Medium] — Foreign Key Constraints: DELETE CASCADE on documents
   Recommendation: Current design (CASCADE delete) is acceptable for MVP. Phase 2: Consider soft deletes for audit trails.

5. [Severity: Low] — Index Performance: Multiple composite indexes for query optimization
   Recommendation: Monitor index usage after deployment. Add missing indexes if new query patterns emerge.

Notes:

- pgvector extension properly used for RAG embeddings
- Primary keys (UUID) are non-sequential, good for IDOR prevention
- Timestamps on all audit-critical tables (created_at, updated_at)
- Seed data includes reasonable default categories

Conditional Approval: Validate JSONB structure before storage. Document encryption requirements for Phase 2. MVP may proceed.
