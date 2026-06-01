# Agents Backlog — Fawredd Home Expenses

**Last Updated:** 2026-05-29
**Current Phase:** MVP Phase 1e — CI + QA
**Audited:** Yes — PM re-audited 2026-05-29 (all Phase 1c routes confirmed complete on disk)

---

## Status Legend

| Status | Meaning |
|--------|---------|
| `DONE` | Completed and verified on disk |
| `IN_PROGRESS` | Code exists but incomplete — see notes |
| `TODO` | Not started |
| `BLOCKED` | Cannot proceed, see reason |

---

## DONE

| ID | Title | Agent | Notes |
|----|-------|-------|-------|
| TASK-001 | REQ-001 — Document Upload Pipeline | Technical BA | [APPROVED] + Security [APPROVED_WITH_NOTES] |
| TASK-002 | REQ-002 — Extraction Pipeline | Technical BA | [APPROVED] + Security [APPROVED_WITH_NOTES] |
| TASK-003 | REQ-003 — Categorization System | Technical BA | [APPROVED] + Security [APPROVED_WITH_NOTES] |
| TASK-004 | REQ-004 — Financial Dashboard | Technical BA | [APPROVED] + Security [APPROVED_WITH_NOTES] |
| TASK-005 | REQ-005 — Database Schema | Technical BA | [APPROVED] + Security [APPROVED_WITH_NOTES] |
| TASK-006 | Swagger — upload-api.yaml | Technical BA | OpenAPI 3.0 |
| TASK-007 | Swagger — extraction-api.yaml | Technical BA | OpenAPI 3.0 |
| TASK-008 | Swagger — categorization-api.yaml | Technical BA | OpenAPI 3.0 |
| TASK-009 | Swagger — dashboard-api.yaml | Technical BA | OpenAPI 3.0 |
| TASK-010 | Security review — all 5 REQ docs | Security Engineer | All APPROVED_WITH_NOTES |
| TASK-011 | Database schema — Drizzle ORM (8 tables) | Backend Dev | db/schema.ts |
| TASK-012 | Database config, seed, queries | Backend Dev | db/index.ts, seed.ts, queries.ts |
| TASK-013 | TypeScript types + Zod schemas | Backend Dev | lib/types.ts |
| TASK-014 | API utilities and error handling | Backend Dev | lib/api-utils.ts |
| TASK-015 | API skeleton routes — all 13 endpoints | Backend Dev | app/api/ complete |
| TASK-020 | Upload component — drag-drop | Frontend Dev | components/upload-component.tsx — complete |
| TASK-021 | Dashboard table — filtering, sorting, pagination | Frontend Dev | components/movements-table.tsx — complete |
| TASK-022 | Categorization review UI — modal | Frontend Dev | components/category-correction-modal.tsx — complete |
| TASK-023 | Dark/light mode toggle | Frontend Dev | components/dashboard-layout.tsx — complete |
| TASK-024a | Category breakdown component | Frontend Dev | components/category-breakdown.tsx — complete |
| TASK-024b | Metrics summary component | Frontend Dev | components/metrics-summary.tsx — complete |
| TASK-024c | Monthly/annual summary tables | Frontend Dev | components/summary-tables.tsx — complete |
| TASK-016b | Wire file-utils + job-queue into upload route | Backend Dev | app/api/documents/upload/route.ts — complete |
| TASK-017b | Wire extraction.ts into extraction route | Backend Dev | app/api/documents/[documentId]/extraction/route.ts — complete |
| TASK-018b | Wire categorization.ts into category routes | Backend Dev | app/api/movements/[movementId]/category/route.ts + categories/route.ts — complete |
| TASK-019b | Wire db/queries.ts into all dashboard routes | Backend Dev | All dashboard route.ts files — complete |
| TASK-028 | Page assembly — app/page.tsx | Frontend Dev | All tabs assembled — complete |

---

## IN_PROGRESS — Phase 1c: API Implementation

### TASK-016 — Document Upload API
- **Agent:** Backend Dev
- **Status:** IN_PROGRESS (~60%)
- **What exists:** `lib/file-utils.ts` — complete. Magic bytes ✅, sanitization ✅, save/delete ✅. `lib/job-queue.ts` — in-memory implementation exists but is NOT pg-boss.
- **What's missing:**
  - `app/api/documents/upload/route.ts` — skeleton only, no business logic
  - `app/api/documents/[documentId]/route.ts` — skeleton only
  - pg-boss integration (currently in-memory queue — jobs lost on restart)
- **Security requirements pending:** magic bytes already implemented in file-utils, needs wiring to route
- **Ref:** REQ-001, upload-api.yaml

---

### TASK-017 — Extraction Pipeline
- **Agent:** Backend Dev
- **Status:** IN_PROGRESS (~65%)
- **What exists:** `lib/extraction.ts` — complete for images (Ollama OCR + regex fallback), sanitizeVendorName ✅, confidence scoring ✅
- **What's missing:**
  - PDF extraction — explicit stub: "Phase 2, integrate pdfjs"
  - `app/api/documents/[documentId]/extraction/route.ts` — skeleton only
  - Zod validation before storage not yet wired to route (security requirement)
- **Ref:** REQ-002, extraction-api.yaml

---

### TASK-018 — Categorization Engine
- **Agent:** Backend Dev
- **Status:** IN_PROGRESS (~80%)
- **What exists:** `lib/categorization.ts` — all 3 strategies implemented (rules ✅, RAG ✅, AI/Ollama ✅), vendor sanitization ✅, `categorizeMovement()` orchestrator ✅
- **What's missing:**
  - `recordSuccessfulCategorization()` — stub with 2 TODOs (generate embedding, store in ragEmbeddings table)
  - `app/api/movements/[movementId]/category/route.ts` — skeleton only, not wired to lib/categorization.ts
  - `app/api/categories/route.ts` — skeleton only
- **Ref:** REQ-003, categorization-api.yaml

---

### TASK-019 — Dashboard Queries
- **Agent:** Backend Dev
- **Status:** IN_PROGRESS (~30%)
- **What exists:** `db/queries.ts` — pre-built query builders exist (getDashboardMovements, getMonthlySummary, getCategoryBreakdown, countUncategorized)
- **What's missing:**
  - All dashboard route.ts files are skeletons — none wired to db/queries.ts
  - user_id filtering not yet implemented in any route (security requirement)
  - `app/api/dashboard/metrics/route.ts` — no query builder exists for metrics yet
- **Ref:** REQ-004, dashboard-api.yaml

---

## TODO — Phase 1e: CI + QA (~10h)

| TASK-025 | CI validation (lint → typecheck → build) | CI Engineer | 1h | **DONE** |
| TASK-026 | BDD test suites — REQ-001 to REQ-005 | QA Engineer | 6h | **DONE** |
| TASK-027 | Manual functional testing — full MVP | QA Engineer | 3h | **DONE** |
| TASK-029 | Fix TypeScript errors (implicit 'any', NextResponses) in db/schema.ts, db/seed.ts, lib/api-utils.ts | Backend Dev | 1h | **DONE** |
| TASK-030 | Fix Next.js dynamic route 'params' Promise constraints | Backend Dev | 1h | **DONE** |
| TASK-031 | Update docker-compose.yml for pgvector and DB name | Infra Engineer | 1h | **DONE** |
| TASK-032 | Implement DB schema isolation with env variables | Backend Dev | 2h | **DONE** |

---

## Backlog — Phase 2 (Deferred)

| ID | Title | Notes |
|----|-------|-------|
| TASK-100 | Replace in-memory job-queue with pg-boss | Technical debt — jobs lost on restart |
| TASK-101 | PDF extraction — integrate pdfjs or pdf-parse | Explicit stub in lib/extraction.ts |
| TASK-102 | RAG embeddings — implement recordSuccessfulCategorization | 2 TODOs in lib/categorization.ts |
| TASK-103 | Multi-user authentication / RBAC | Phase 2 |
| TASK-104 | Vercel deployment | Phase 2 |
| TASK-105 | Vercel Blob cloud storage | Phase 2 |
| TASK-106 | Virus scanning (ClamAV) | Security recommendation |
| TASK-107 | Field-level encryption (pgcrypto) | Security recommendation |
| TASK-108 | Row-level security (RLS) policies | Security recommendation |
| TASK-109 | Scheduled folder watching / auto-import | Phase 2 |
| TASK-110 | Advanced analytics and charting | Phase 2 |
| TASK-111 | Mobile app | Phase 3 |
