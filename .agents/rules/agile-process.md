# Agile Process Rules

> Governs all agents operating in this workspace. Every agent must read and comply with this document before taking any action.

---

## Roles

| Role | Responsibility |
|------|---------------|
| **Lead PM** | Owns backlog, priorities, task orchestration, and final DONE authority |
| **Technical BA** | Sole authority for Requirement Docs and technical specifications |
| **Security Engineer** | Reviews every Requirement Doc before implementation begins |
| **Frontend Engineer** | Implements UI features according to BA specs |
| **Backend Engineer** | Implements APIs and backend logic according to BA specs |
| **Infrastructure Engineer** | Maintains Docker, runtime environments, and deployment infrastructure according to BA specs |
| **QA Engineer** | Validates features through automated and manual testing |
| **CI Engineer** | Runs lint, typecheck, and production build as mandatory quality gate before QA |

---

## Workflow Order (Mandatory)

```
PM assigns task
  → Technical BA produces Requirement Doc [DRAFT]
  → Security Engineer reviews → [SECURITY_REVIEW] appended
  → Technical BA marks doc [APPROVED]
  → Implementation (Frontend / Backend / Infrastructure)
  → CI Engineer (lint → typecheck → build)
  → QA Engineer
  → PM marks DONE
```

No step may be skipped. No agent may start work before its trigger condition is met.

---

## Security Engineer — Invocation Rules

**Trigger:** Automatically invoked when Technical BA outputs a Requirement Doc marked `[DRAFT]`.

**Scope:** Every Requirement Doc, no exceptions.

**Token efficiency:** The Security Engineer reads only the Requirement Doc. It does not read backlog, STATE.md, or any other artifact. Output is a single `[SECURITY_REVIEW]` block appended to the doc — nothing else.

**Blocking behavior:**
- `[APPROVED]` or `[APPROVED_WITH_NOTES]` → Technical BA may mark doc `[APPROVED]` and implementation proceeds.
- `[BLOCKED_PENDING_REVISION]` → BA revises spec, Security Engineer re-reviews. Implementation cannot start.

**The Security Engineer does NOT:**
- Attend standup or backlog reviews
- Review code (only specs)
- Interact with CI or QA
- Produce any artifact other than the `[SECURITY_REVIEW]` block

---

## Protocol — No Code Without Approval

> No implementation work may begin until the Technical BA has produced a Requirement Doc marked `[APPROVED]` (which requires a passing `[SECURITY_REVIEW]`).
> Stakeholder will test the app manually. Do not implement GitHub Actions, Playwright, or Docker unless explicitly requested.

### Post-Implementation Handoff

Workflow order is strictly:

```
Implementation → CI Engineer → QA Engineer
```

Developers may NOT move tasks directly to QA.

---

## Agent Logging Format

Every agent must prefix activity with its role.

```
PM: Reviewing backlog.
BA: Drafting Requirement Doc AUTH-001.
SECURITY: Reviewing AUTH-001 for vulnerabilities.
FRONTEND: Implementing login page per AUTH-001.
BACKEND: Implementing POST /auth/login per Swagger contract.
CI: Running build validation gate.
QA: Running integration tests for AUTH-001.
INFRA: Updating docker-compose.
```

---

## API Documentation Standard

All API contracts must use **Swagger / OpenAPI 3.0** format, saved to `.agents/artifacts/api-docs/`. Implementation must exactly match the saved contract.

---

## Database Standards

All projects in this workspace use PostgreSQL + Drizzle ORM.

### Mandatory Rules

- ALWAYS use PostgreSQL schemas for project isolation.
- NEVER use the default `public` schema.
- Every project MUST define a dedicated schema name.
- All Drizzle tables MUST be created from a `pgSchema(...)` instance.
- Direct use of `pgTable(...)` is forbidden unless explicitly approved.
- Raw SQL queries MUST explicitly reference the project schema.
- Migrations MUST target only the assigned schema.
- Agents must assume the database server is shared across multiple projects.

### Required Pattern

```ts
import { pgSchema } from "drizzle-orm/pg-core";

export const appSchema = pgSchema("<PROJECT_DB_SCHEMA>");
```

All tables must use:

```ts
appSchema.table(...)
```

Never:

```ts
pgTable(...)
```

### drizzle.config.ts Requirements

The Drizzle configuration MUST explicitly support the project schema.

Example:

```ts
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
```

### Migration Rules

- Generated migrations MUST only affect `<PROJECT_DB_SCHEMA>`.
- Never generate or modify objects in unrelated schemas.
- Introspection must target only the project schema whenever supported.
- Migration reviews must verify schema isolation before execution.

### Infrastructure Requirements

- PostgreSQL connections should configure:
  `search_path=<PROJECT_DB_SCHEMA>`
- Database users should not have permissions over unrelated schemas whenever possible.

### Backend Agent Responsibility

The Backend Engineer is responsible for:
- preserving schema isolation
- avoiding cross-project queries
- ensuring migrations never touch unrelated schemas

---

## TypeScript Standards

All projects in this workspace use strict TypeScript.

### Mandatory Rules

- NEVER use `any` unless explicitly approved by the stakeholder.
- `unknown` must be preferred over `any` when type safety is uncertain.
- All functions must declare explicit parameter and return types.
- All API payloads must be validated with Zod.
- Zod schemas must be the source of truth for runtime validation.
- Types should be inferred from Zod whenever possible.
- Avoid manual duplicate type definitions when Zod inference is available.
- Prefer discriminated unions over loose object typing.
- Prefer readonly types when mutation is not required.
- Avoid unsafe type assertions (`as any`, double casting, etc.).
- TypeScript strict mode assumptions must always be respected.
- Never bypass type errors to make builds pass.
- Generic types must use meaningful constraints.
- Database entities, DTOs, API responses, and form payloads must be strongly typed.

### Zod Standards

Preferred pattern:

```ts
import { z } from "zod";

export const userSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
});

export type User = z.infer<typeof userSchema>;
```

### Forbidden Patterns

Never:

```ts
const data: any = response;
```

Never:

```ts
function process(data: any)
```

Never:

```ts
as any
```

Never:

```ts
as unknown as SomeType
```

### Backend Responsibilities

Backend Engineers must:
- validate all external inputs with Zod
- infer DTO types from schemas
- preserve end-to-end type safety
- avoid nullable ambiguity
- properly type database responses

### Frontend Responsibilities

Frontend Engineers must:
- strongly type component props
- strongly type hooks and state
- avoid implicit `any`
- validate forms with Zod
- infer form types from schemas

---

## Build Validation Gate (Mandatory)

The CI Engineer may ONLY execute these commands, in this order:

```bash
pnpm run lint
npx tsc --noEmit
pnpm run build
```
### TypeScript Quality Gate

The CI Engineer must fail validation if:
- explicit `any` exists
- unsafe casts exist
- TypeScript errors are silenced
- Zod validation is missing for external inputs

**Failure output:**
```
[BLOCKED]
Agent: CI Engineer
Task: <task ID>
Failed Step: <Lint | Typecheck | Build>
Error Summary: <plain English explanation>
Escalated To: Lead PM
```

**Success output:**
```
[CI_APPROVED]
Agent: CI Engineer
Checks:
- Lint: PASS
- Typecheck: PASS
- Build: PASS
Handoff To: QA Engineer
```

QA must not start until `[CI_APPROVED]` is issued.

---

## QA Validation Rules

QA validates that **actual implementation behavior matches stakeholder intent**, not just that test cases exist.

**Sources of truth (priority order):**
1. Stakeholder description
2. Technical BA Requirement Doc
3. Acceptance Criteria

**UI/UX checklist (frontend tasks):**
- [ ] All sections described by stakeholder exist
- [ ] Order of sections matches specification
- [ ] Key interactions exist (click, modal, edit, navigation)
- [ ] Primary CTAs are clearly available

**Functional completeness check:**
- Can the user complete the intended goal?
- Are any stakeholder-described features missing or partial?

If any check fails → output `[BLOCKED]` and escalate to PM.

**Anti-false-pass rule:** A task must NOT pass QA if Gherkin exists but does not reflect real UI behavior, or if implementation is partial.

---

## Ambiguity Protocol

```
[CLARIFICATION_REQUEST]
Agent: <name>
Field/Topic: <what is ambiguous>
Current Interpretation: <how agent reads it>
Alternative Interpretation: <other plausible reading>
Blocking: <yes/no>
```

---

## Failure Escalation

```
[BLOCKED]
Agent: <name>
Task: <ID and description>
Reason: <detailed reason>
Escalated To: Lead PM
```

---

## Cross-Domain Error Protocol

If an agent hits an error outside their expertise:
1. **HALT** immediately.
2. **LOG** using `[ESCALATION_REPORT]` format.
3. **CREATE** a triage task in `agents-backlog.md` with `priority: HIGH`, `assignee: PM`.
4. **DO NOT** attempt a fix.

```
[ESCALATION_REPORT]
Originating Agent: <name>
Target Domain: <Backend / Frontend / Infrastructure / Security>
Error Log: <description>
Impact on Current Task: <Blocked / Partially Blocked>
```

---

## Optimization Mandate

All agents are empowered and required to suggest optimizations:

```
[OPTIMIZATION]
Priority: <High / Medium / Low>
Area: <Architecture / Performance / Security / Process>
Description: <what and why>
Suggested Action: <concrete next step>
```

---

## State Management

After every completed task, the responsible agent **must** update
`.agents/artifacts/STATE.md` using the template below.
No task is considered done without a STATE update.

### STATE.md Entry Template

\```
## [TASK-ID] — Task Title
- Status: <DONE | IN_PROGRESS | BLOCKED>
- Agent: <role>
- Date: YYYY-MM-DD
- Summary: <what was done in 1-2 sentences>
- Decisions: <design or implementation decisions made in chat that are not captured in the Requirement Doc>
- Pending: <what remains if status is IN_PROGRESS or BLOCKED>
- Next Agent: <role that must act next, or NONE if DONE>
\```

### Rules

- Append new entries — never overwrite previous ones.
- `Decisions` is mandatory if any choice was made that future agents need to understand.
- `Pending` is mandatory if status is not `DONE`.
- If a task was BLOCKED, include the `[BLOCKED]` tag content verbatim under `Pending`.

---

## Definition of Done

- [ ] Requirement Doc is `[APPROVED]` by Technical BA
- [ ] `[SECURITY_REVIEW]` status is `[APPROVED]` or `[APPROVED_WITH_NOTES]`
- [ ] Implementation matches the Swagger contract exactly (if applicable)
- [ ] BDD test suite exists and passes for all Acceptance Criteria
- [ ] Implementation validated against stakeholder-described behavior
- [ ] All core user flows functional end-to-end (manual QA)
- [ ] No critical or high-severity functional gaps remain
- [ ] `.agents/artifacts/STATE.md` entry appended with Summary, Decisions, and Pending fields completed
- [ ] `agents-backlog.md` status updated to `DONE`
- [ ] `pnpm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] CI Engineer issued `[CI_APPROVED]`
- [ ] PM has verified against QA and marked DONE

---

## Artifact Locations

| Artifact | Location |
|----------|----------|
| Architecture | `.agents/artifacts/architecture.md` |
| Backlog | `agents-backlog.md` |
| Requirement Docs | `.agents/artifacts/requirement-docs/` |
| API Contracts | `.agents/artifacts/api-docs/` |
| Project State | `.agents/artifacts/STATE.md` |

---
### Artifact Creation Rule

Agents may ONLY create files in the locations defined in the table above.

Creating files in the project root or in any path not listed here is
STRICTLY FORBIDDEN. If an agent needs a new artifact type not covered
by the table, it must raise an [OPTIMIZATION] request to the PM and
wait for approval before creating any file.

---

### Project Initialization (PM — First Session Only)

Before assigning any task, the PM must verify the following files exist.
If they do not, create them immediately:

- `agents-backlog.md` — initialize with empty backlog structure
- `.agents/artifacts/STATE.md` — initialize with project name and date

No task may be assigned until both files exist.
---

## File System Naming

Use kebab-case for all file names and API endpoints.
