# Agents Backlog — Fawredd Home Expenses

**Last Updated:** 2026-05-29
**Current Phase:** MVP Phase 1e — CI + QA
**Audited:** Yes — PM re-audited 2026-05-29 (all Phase 1c routes confirmed complete on disk)

---

## Status Legend

| Status        | Meaning                                |
| ------------- | -------------------------------------- |
| `DONE`        | Completed and verified on disk         |
| `IN_PROGRESS` | Code exists but incomplete — see notes |
| `TODO`        | Not started                            |
| `BLOCKED`     | Cannot proceed, see reason             |

---

## DONE

| ID        | Title                                            | Agent             | Notes                                                                                                                      |
| --------- | ------------------------------------------------ | ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| TASK-001  | REQ-001 — Document Upload Pipeline               | Technical BA      | [APPROVED] + Security [APPROVED_WITH_NOTES]                                                                                |
| TASK-002  | REQ-002 — Extraction Pipeline                    | Technical BA      | [APPROVED] + Security [APPROVED_WITH_NOTES]                                                                                |
| TASK-003  | REQ-003 — Categorization System                  | Technical BA      | [APPROVED] + Security [APPROVED_WITH_NOTES]                                                                                |
| TASK-004  | REQ-004 — Financial Dashboard                    | Technical BA      | [APPROVED] + Security [APPROVED_WITH_NOTES]                                                                                |
| TASK-005  | REQ-005 — Database Schema                        | Technical BA      | [APPROVED] + Security [APPROVED_WITH_NOTES]                                                                                |
| TASK-006  | Swagger — upload-api.yaml                        | Technical BA      | OpenAPI 3.0                                                                                                                |
| TASK-007  | Swagger — extraction-api.yaml                    | Technical BA      | OpenAPI 3.0                                                                                                                |
| TASK-008  | Swagger — categorization-api.yaml                | Technical BA      | OpenAPI 3.0                                                                                                                |
| TASK-009  | Swagger — dashboard-api.yaml                     | Technical BA      | OpenAPI 3.0                                                                                                                |
| TASK-010  | Security review — all 5 REQ docs                 | Security Engineer | All APPROVED_WITH_NOTES                                                                                                    |
| TASK-011  | Database schema — Drizzle ORM (8 tables)         | Backend Dev       | db/schema.ts                                                                                                               |
| TASK-012  | Database config, seed, queries                   | Backend Dev       | db/index.ts, seed.ts, queries.ts                                                                                           |
| TASK-013  | TypeScript types + Zod schemas                   | Backend Dev       | lib/types.ts                                                                                                               |
| TASK-014  | API utilities and error handling                 | Backend Dev       | lib/api-utils.ts                                                                                                           |
| TASK-015  | API skeleton routes — all 13 endpoints           | Backend Dev       | app/api/ complete                                                                                                          |
| TASK-016  | Document Upload API                              | Backend Dev       | app/api/documents/upload/route.ts — wired to `lib/file-utils.ts` and `lib/job-queue.ts` (magic-bytes validation + enqueue) |
| TASK-017  | Extraction Pipeline                              | Backend Dev       | app/api/documents/[documentId]/extraction/route.ts — Zod validation wired for PUT updates and GET behavior preserved       |
| TASK-018  | Categorization Engine                            | Backend Dev       | app/api/movements/[movementId]/category/route.ts — Zod validation, user correction audit, and RAG embedding persistence    |
| TASK-019  | Dashboard Queries                                | Backend Dev       | db/queries.ts + all dashboard routes — wired with user_id filtering and metrics query                                      |
| TASK-020  | Upload component — drag-drop                     | Frontend Dev      | components/upload-component.tsx — complete                                                                                 |
| TASK-021  | Dashboard table — filtering, sorting, pagination | Frontend Dev      | components/movements-table.tsx — complete                                                                                  |
| TASK-022  | Categorization review UI — modal                 | Frontend Dev      | components/category-correction-modal.tsx — complete                                                                        |
| TASK-023  | Dark/light mode toggle                           | Frontend Dev      | components/dashboard-layout.tsx — complete                                                                                 |
| TASK-024a | Category breakdown component                     | Frontend Dev      | components/category-breakdown.tsx — complete                                                                               |
| TASK-024b | Metrics summary component                        | Frontend Dev      | components/metrics-summary.tsx — complete                                                                                  |
| TASK-024c | Monthly/annual summary tables                    | Frontend Dev      | components/summary-tables.tsx — complete                                                                                   |
| TASK-016b | Wire file-utils + job-queue into upload route    | Backend Dev       | app/api/documents/upload/route.ts — complete                                                                               |
| TASK-017b | Wire extraction.ts into extraction route         | Backend Dev       | app/api/documents/[documentId]/extraction/route.ts — complete                                                              |
| TASK-018b | Wire categorization.ts into category routes      | Backend Dev       | app/api/movements/[movementId]/category/route.ts + categories/route.ts — complete                                          |
| TASK-019b | Wire db/queries.ts into all dashboard routes     | Backend Dev       | All dashboard route.ts files — complete                                                                                    |
| TASK-028  | Page assembly — app/page.tsx                     | Frontend Dev      | All tabs assembled — complete                                                                                              |
| TASK-034  | Full PDF extraction + AI/RAG categorization flow  | Backend Dev       | Added real PDF extraction with pdf-parse, AI-assisted field inference, and vector RAG memory support                        |
| TASK-035  | Clerk authentication + sign-in flow              | Backend Dev       | Integrated Clerk auth into API routes, added `proxy.ts`, protected homepage redirect, and added Clerk sign-in/sign-up UI   |
| TASK-037  | Document extraction storage path bug fix         | Backend Dev       | Fixed path normalization in `lib/file-utils.ts` so background extraction jobs can read saved files                       |

---

## IN_PROGRESS — Phase 1c: API Implementation

---

### TASK-017 — Extraction Pipeline

- **Agent:** Backend Dev
- **Status:** DONE
- **What exists:** `lib/extraction.ts` — complete for images (Ollama OCR + regex fallback), sanitizeVendorName ✅, confidence scoring ✅
- **Completed:** `app/api/documents/[documentId]/extraction/route.ts` now validates update payloads using Zod before writing to the database and preserves GET extraction retrieval.
- **What's remaining:**
  - PDF extraction — explicit stub remains in `lib/extraction.ts` for Phase 2
- **Ref:** REQ-002, extraction-api.yaml

---

### TASK-018 — Categorization Engine

- **Agent:** Backend Dev
- **Status:** DONE
- **What exists:** `lib/categorization.ts` — all 3 strategies implemented (rules ✅, RAG ✅, AI/Ollama ✅), vendor sanitization ✅, `categorizeMovement()` orchestrator ✅
- **Completed:**
  - `recordSuccessfulCategorization()` now generates and stores RAG embedding records in `rag_embeddings`
  - `app/api/movements/[movementId]/category/route.ts` now validates corrections with Zod, records user corrections, and updates RAG learning
  - `app/api/categories/route.ts` remains available for category listing
- **Ref:** REQ-003, categorization-api.yaml

---

### TASK-019 — Dashboard Queries

- **Agent:** Backend Dev
- **Status:** DONE
- **What exists:** `db/queries.ts` — user-aware query builders for movements, monthly summary, annual summary, category breakdown, metrics, and uncategorized count
- **Completed:**
  - All dashboard route.ts files are wired to `db/queries.ts`
  - user_id filtering implemented through current user context
  - `app/api/dashboard/metrics/route.ts` now uses shared metrics query builder and document-scoped filters
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
| TASK-036 | Fix Clerk user ID type mismatch in dashboard queries | Backend Dev | 1h | DONE |

---

## Backlog — Phase 2 (Deferred)

| ID       | Title                                                     | Notes                                 |
| -------- | --------------------------------------------------------- | ------------------------------------- |
| TASK-100 | Replace in-memory job-queue with pg-boss                  | Technical debt — jobs lost on restart |
| TASK-101 | PDF extraction — integrate pdfjs or pdf-parse             | Explicit stub in lib/extraction.ts    |
| TASK-102 | RAG embeddings — implement recordSuccessfulCategorization | 2 TODOs in lib/categorization.ts      |
| TASK-103 | Multi-user authentication / RBAC                          | Phase 2                               |
| TASK-104 | Vercel deployment                                         | Phase 2                               |
| TASK-105 | Vercel Blob cloud storage                                 | Phase 2                               |
| TASK-106 | Virus scanning (ClamAV)                                   | Security recommendation               |
| TASK-107 | Field-level encryption (pgcrypto)                         | Security recommendation               |
| TASK-108 | Row-level security (RLS) policies                         | Security recommendation               |
| TASK-109 | Scheduled folder watching / auto-import                   | Phase 2                               |
| TASK-110 | Advanced analytics and charting                           | Phase 2                               |
| TASK-111 | Mobile app                                                | Phase 3                               |
| TASK-038 | Fix RAG vector query runtime failure | **DONE** |
| TASK-040 | Fix document upload missing userId on documents | **DONE** |
