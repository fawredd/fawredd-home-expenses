# PROJECT STATE — Fawredd Home Expenses

**Last Updated:** 2026-05-29
**Current Phase:** MVP Phase 1e — CI + QA
**Next Agent:** CI Engineer → TASK-025
**Audited:** Yes — PM re-audited 2026-05-29, all Phase 1c routes confirmed complete

---

## Project Overview

Financial expense management system. Eliminates manual Excel tracking by automating extraction, categorization, and analysis of financial documents. Single-user local deployment for Phase 1.

**Stack:** Next.js 16, React 19, TypeScript, PostgreSQL, Drizzle ORM, pgvector, Ollama, Redis, pg-boss (deferred), Zod, shadcn/ui, TailwindCSS

**Repo:** `c:\vscode\fawredd-home-expenses`

---

## Architecture

```
Next.js Frontend (React 19, Server Components)
  → API Routes / Server Actions
    → PostgreSQL (Drizzle ORM) + Filesystem (documents)
      → Background Jobs (in-memory queue → pg-boss Phase 2)
      → AI Services (Ollama local / remote fallback)
```

**Key directories:**
- `db/` — schema.ts, index.ts, queries.ts, seed.ts
- `lib/` — types.ts, api-utils.ts, categorization.ts, extraction.ts, file-utils.ts, job-queue.ts, utils.ts
- `app/api/` — 13 endpoint route files (skeletons, not yet wired to lib/)
- `components/` — all UI components complete
- `.agents/artifacts/requirement-docs/` — REQ-001 to REQ-005
- `.agents/artifacts/api-docs/` — 4 Swagger contracts

---

## Critical Context for Next Agent

The project has a structural gap: **all lib/ business logic is implemented but not connected to the API routes**. Every route in `app/api/` is still a skeleton. The next Backend Dev agent must wire lib/ into routes — not rewrite the logic.

**Do NOT rewrite:**
- `lib/file-utils.ts` — complete, magic bytes implemented
- `lib/extraction.ts` — complete for images, PDF is intentional stub
- `lib/categorization.ts` — 3 strategies implemented, only RAG embeddings recording is stub
- `lib/job-queue.ts` — in-memory, intentional for Phase 1 (pg-boss deferred to Phase 2)
- All `components/` — all complete, do not touch

**The only work remaining in Phase 1c is wiring routes to existing lib/ functions.**

---

## Task History

---

## [TASK-001 to TASK-010] — Specs, Contracts, Security Review
- Status: DONE
- Agent: Technical BA + Security Engineer
- Date: 2026-05-26
- Summary: 5 requirement docs, 4 Swagger contracts, full security review. All APPROVED_WITH_NOTES.
- Decisions: Single-user MVP. Spanish UI hardcoded. No Docker for local dev.
- Pending: None
- Next Agent: None

---

## [TASK-011 to TASK-015] — Backend Infrastructure (Phase 1b)
- Status: DONE
- Agent: Backend Dev
- Date: 2026-05-27
- Summary: DB schema (8 tables), Drizzle config, seed (9 Spanish categories), types, Zod schemas, API utilities, 13 skeleton routes.
- Decisions:
  - UUID primary keys on all tables (prevents IDOR)
  - pgvector 384D embeddings (nomic-embed-text)
  - In-memory job queue for Phase 1, pg-boss deferred to Phase 2
  - Filesystem storage Phase 1, Vercel Blob Phase 2
  - Local Ollama default, configurable remote fallback
- Pending: None
- Next Agent: Backend Dev → TASK-016b

---

## [TASK-016 to TASK-019] — Business Logic Libraries (Phase 1c partial)
- Status: IN_PROGRESS
- Agent: Backend Dev
- Date: 2026-05-27
- Summary: All lib/ files created with business logic. Routes are still skeletons.
- Decisions:
  - PDF extraction intentionally stubbed — "Phase 2, integrate pdfjs" (explicit comment in extraction.ts)
  - `recordSuccessfulCategorization()` intentionally stubbed — RAG embedding generation deferred (2 TODOs in categorization.ts)
  - job-queue.ts uses in-memory Map, not pg-boss — intentional for Phase 1
- Pending:
  - Wire lib/file-utils.ts into upload route (TASK-016b)
  - Wire lib/extraction.ts into extraction route + Zod validation (TASK-017b)
  - Wire lib/categorization.ts into category routes (TASK-018b)
  - Wire db/queries.ts into all dashboard routes + add metrics query + user_id filtering (TASK-019b)
- Next Agent: Backend Dev

---

## [TASK-020 to TASK-024] — Frontend Components (Phase 1d)
- Status: DONE
- Agent: Frontend Dev
- Date: 2026-05-27
- Summary: All components implemented. Connects to API routes via fetch — will work once routes are wired.
- Components:
  - `upload-component.tsx` — drag-drop, XHR progress, queue management
  - `movements-table.tsx` — filtering, sorting, pagination (50/page)
  - `category-correction-modal.tsx` — GET + PUT category, preview before save
  - `dashboard-layout.tsx` — dark/light mode with localStorage persistence
  - `category-breakdown.tsx` — progress bars with dynamic colors
  - `metrics-summary.tsx` — 4 KPI cards + uncategorized alert + dateRange support
  - `summary-tables.tsx` — monthly (with changePercent) + annual tables
- Decisions:
  - All components are "use client" — fetch directly from API routes
  - Dark mode via document.documentElement classList + localStorage
  - No page-level integration yet — components exist but not assembled into app/page.tsx
- Pending: Page integration (assemble components into app/page.tsx) — minor, ~1h
- Next Agent: Frontend Dev after Backend Dev completes TASK-016b to TASK-019b

---

## Security Requirements — Must Be Implemented in Routes

These were flagged by Security Engineer and are NOT yet wired:

| Requirement | File | Status |
|------------|------|--------|
| Magic byte validation on upload | lib/file-utils.ts ✅ → upload/route.ts ❌ | Not wired |
| Zod validation before storage | lib/types.ts ✅ → extraction/route.ts ❌ | Not wired |
| Vendor sanitization before LLM | lib/extraction.ts ✅ → categorization already uses it ✅ | Done |
| user_id filtering on dashboard queries | db/queries.ts ❌ | Not implemented |

---

## Environment Setup (for new agents)

```bash
# Prerequisites: Node.js v18+, PostgreSQL v14+, pnpm
psql -U postgres
CREATE DATABASE fawredd_local;
\c fawredd_local
CREATE EXTENSION IF NOT EXISTS vector;
\q

cd c:\vscode\fawredd-home-expenses
pnpm install
cp .env.example .env.development
# Set DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fawredd_local
pnpm db:setup
pnpm dev
```

Full setup guide: `LOCAL_SETUP.md` (project root)

---

## Known Technical Debt (Phase 2)

| Item | Location | Notes |
|------|----------|-------|
| PDF extraction stub | lib/extraction.ts L~95 | "Phase 2, integrate pdfjs" |
| RAG embedding recording | lib/categorization.ts L~185 | 2 TODOs — generate + store embeddings |
| In-memory job queue | lib/job-queue.ts | Replace with pg-boss Phase 2 |
| user_id filtering | db/queries.ts | Required for Phase 2 multi-user |

---

## [TASK-016b to TASK-019b + Page Assembly] — API Route Wiring (Phase 1c)
- Status: DONE
- Agent: Backend Dev (previous session)
- Date: 2026-05-27 (detected by PM audit 2026-05-29)
- Summary: All API routes fully wired to lib/ business logic. Upload route wires file-utils + magic bytes + job-queue. Extraction routes GET/PUT from DB. Category routes GET/PUT wired. All dashboard routes wired to db/queries.ts. app/page.tsx fully assembled with all tabs.
- Decisions:
  - upload/route.ts includes inline job handler registration for extract jobs
  - Extraction update (PUT) does not re-trigger categorization — user correction only updates extraction fields
  - Dashboard metrics route uses raw SQL aggregations (no query builder) due to no pre-built metrics query in queries.ts
  - app/page.tsx uses window.location.reload() after category correction — acceptable for Phase 1 MVP
- Pending: None
- Next Agent: CI Engineer → TASK-025

---

## [TASK-029] — Fix TypeScript errors
- Status: DONE
- Agent: Backend Dev
- Date: 2026-05-29
- Summary: Fixed TypeScript errors in db/schema.ts (implicit 'any' and self-references), db/seed.ts (array typing for Drizzle returning), and lib/api-utils.ts (ApiResponse data type).
- Decisions: Explicitly typed 'categories' self-reference with 'AnyPgColumn'. Used 'appSchema' instead of 'pgTable' following database standards. Added runtime Array.isArray check in seed.ts. Changed ApiResponse typing in validationErrorResponse.
- Pending: None
- Next Agent: CI Engineer

---

## [TASK-030] — Fix Next.js Route Handler 'params' type
- Status: DONE
- Agent: Backend Dev
- Date: 2026-05-29
- Summary: Fixed Next.js 15+ Route Handlers dynamic `params` typings to be `Promise<{...}>` and awaited the variable before access in `documents/[documentId]/extraction/route.ts`, `documents/[documentId]/route.ts`, and `movements/[movementId]/category/route.ts`.
- Decisions: Updated all three dynamic routes present in `app/api/` per Next.js 15+ async `params` requirements. 
- Pending: None
- Next Agent: CI Engineer

---

## [TASK-026] — QA Engineer — BDD Test Suites
- Status: DONE
- Agent: QA Engineer
- Date: 2026-05-29
- Summary: Generated Gherkin test suites (.feature files) for REQ-001 through REQ-005 covering Happy Paths, Edge Cases, Error Scenarios, and Security Scenarios.
- Decisions: Structured feature files based on the Acceptance Criteria provided in the respective Technical BA Requirement Docs.
- Pending: None
- Next Agent: PM
