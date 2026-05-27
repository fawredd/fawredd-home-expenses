# PROJECT STATE — Fawredd Home Expenses

**Last Updated:** 2026-05-26
**Status:** MVP Discovery Phase

---

## Project Overview

**Product:** Financial expense management system with automatic document processing and AI-assisted categorization.

**Primary Goal:** Eliminate manual Excel-based expense tracking by automating extraction, categorization, and analysis of financial documents.

**Target Users:** Individuals managing family household finances.

---

## Tech Stack

| Component           | Technology                   | Rationale                                            |
| ------------------- | ---------------------------- | ---------------------------------------------------- |
| **Framework**       | Next.js 16+                  | SSR, API routes, Server Components, production-grade |
| **Language**        | TypeScript                   | Strong typing, IDE support, maintainability          |
| **UI Library**      | React 19                     | Latest features, Server Components compatibility     |
| **UI Components**   | shadcn/ui                    | Accessible, Tailwind-based, customizable             |
| **Styling**         | TailwindCSS                  | Utility-first, responsive, dark mode support         |
| **Validation**      | Zod                          | TypeScript-first, schema validation, API contracts   |
| **Database**        | PostgreSQL                   | ACID compliance, JSON support, scalability           |
| **ORM**             | Drizzle ORM                  | Type-safe, lightweight, SQL-first approach           |
| **Cache/Queue**     | Redis                        | Caching, background job state, session management    |
| **Background Jobs** | pg-boss                      | Native PostgreSQL, no external service               |
| **AI**              | AI SDK                       | Unified provider interface, model switching          |
| **Local AI**        | Ollama                       | Fully local inference, privacy-first, cost-free      |
| **RAG**             | pgvector + embeddings        | PostgreSQL-native, minimal dependencies              |
| **Storage**         | Filesystem (Phase 1)         | Local development, simple deployment                 |
| **OCR**             | Tesseract (via Ollama/local) | Open source, multilingual                            |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────┐
│              Next.js Frontend                    │
│  (React 19, Server Components, Server Actions)  │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│        API Routes / Server Actions               │
│    (Auth, Upload, Dashboard, Extraction)         │
└──────────────────────┬──────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        │              │              │
   ┌────▼──────┐  ┌────▼──────┐  ┌──▼───────────┐
   │ PostgreSQL │  │   Redis   │  │ File Storage │
   │ (Data ORM)│  │ (Cache)   │  │ (Documents)  │
   └────┬──────┘  └────┬──────┘  └──┬───────────┘
        │              │            │
        └──────────────┼────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
   ┌────▼──────────┐  ┌──────────────▼────┐
   │ Background    │  │ AI Services        │
   │ Jobs (pg-boss)│  │ (Ollama/Remote)    │
   └───────────────┘  └────────────────────┘
```

---

## Core Modules (MVP)

### 1. **Document Ingestion**

- File upload (drag-drop, manual)
- File type validation (PDF, JPG, PNG)
- Virus scanning consideration
- Storage to filesystem

### 2. **Extraction Pipeline**

- OCR processing (Tesseract via Ollama)
- Structured data parsing
- Metadata capture (date, amount, vendor, type)
- Quality scoring

### 3. **Categorization**

- Rule-based heuristics (first pass)
- RAG-based retrieval (historical patterns)
- AI fallback (Ollama local)
- Manual correction & feedback loop

### 4. **Data Persistence**

- Document metadata
- Extracted movements
- Categories & hierarchy
- User corrections (learning)
- RAG embeddings

### 5. **Dashboard**

- Movement table (filterable, sortable)
- Monthly/annual aggregation
- Category breakdown
- Balance metrics
- Export capability

---

## MVP Phase 1 Scope

### In Scope

- ✅ Single-user local deployment
- ✅ Document upload (PDF, images)
- ✅ OCR extraction
- ✅ Automatic categorization (rule-based + AI)
- ✅ Financial dashboard
- ✅ Manual correction flow
- ✅ Spanish UI

### Out of Scope (Phase 2+)

- Multi-user auth/RBAC
- Cloud deployment (Vercel)
- Vercel Blob storage
- Scheduled folder watching
- Advanced analytics
- Mobile app

---

## Database Strategy

**ORM:** Drizzle ORM
**Migrations:** Drizzle Migrations
**Seed:** Sample data + categories

### Core Tables (TBD in REQ-005)

- `documents` — Original file metadata
- `movements` — Extracted financial entries
- `categories` — Taxonomy (hierarchical)
- `rag_embeddings` — Vector store for categorization memory
- `corrections` — User feedback for learning

---

## API Strategy

All endpoints documented in **OpenAPI 3.0 Swagger** format under `.agents/artifacts/api-docs/`.

**Endpoints will cover:**

- Document upload & processing
- Movement CRUD
- Categorization (auto + manual)
- Dashboard data aggregation
- Admin configuration

---

## Security Considerations (TBD)

- Input validation (Zod schemas)
- File type whitelisting
- Malware scanning (optional Phase 1)
- CORS configuration
- Error message sanitization
- No PII logging

---

## Development Environment

**Phase 1 (Current):**

- Local Next.js dev server
- Local PostgreSQL (Docker)
- Local Redis (Docker)
- Local Ollama (optional, fallback to remote)

**Deployment readiness:**

- Docker Compose for orchestration
- Environment-based config (local/staging/prod)

---

## Performance & Scalability

**MVP Targets:**

- Document upload: < 5MB per file
- Processing latency: < 30 seconds per document
- Dashboard query: < 1 second

**Future optimizations:**

- Batch processing
- Caching strategies
- Database indexing
- Vector DB optimization

---

## Internationalization (i18n)

**Phase 1:** Spanish (es-ES) hardcoded in UI
**Future:** i18n framework (next-intl) for multi-language support

---

## Monitoring & Logging

**MVP Phase 1:** Console logs (structured)
**Future:** Dedicated logging service (Datadog, Vercel Analytics)

---

## User Roles

### End User

- Upload documents
- Review categorizations
- Correct errors
- View financial dashboard

### Administrator (Phase 2)

- Category management
- AI model configuration
- System monitoring

---

## Key Decisions

1. **Drizzle ORM** — Type-safe, lightweight, SQL-first approach aligns with TypeScript-first product
2. **pg-boss** — Native PostgreSQL job queue, no external service dependency
3. **Local Ollama default** — Privacy-first, cost-free, fallback to remote configured by user
4. **RAG via pgvector** — Keep all data in PostgreSQL, minimal infrastructure
5. **Filesystem storage Phase 1** — Simplicity for MVP, Vercel Blob for Phase 2
6. **shadcn/ui + TailwindCSS** — Minimal, modern, highly customizable UX

---

## Next Steps

1. ✅ Complete STATE.md
2. 🔄 Technical BA produces Requirement Docs (REQ-001 through REQ-005)
3. 🔄 Security Engineer reviews each Requirement Doc
4. 🔄 Backend + Frontend + Infrastructure begin implementation
5. 🔄 CI validation
6. 🔄 QA testing
