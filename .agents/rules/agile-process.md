---
trigger: always_on
---
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

## Build Validation Gate (Mandatory)

The CI Engineer may ONLY execute these commands, in this order:

```bash
pnpm run lint
npx tsc --noEmit
pnpm run build
```

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

After every completed task, the responsible agent must update `.agents/artifacts/STATE.md`. No task is done without a STATE update.

---

## Definition of Done

- [ ] Requirement Doc is `[APPROVED]` by Technical BA
- [ ] `[SECURITY_REVIEW]` status is `[APPROVED]` or `[APPROVED_WITH_NOTES]`
- [ ] Implementation matches the Swagger contract exactly (if applicable)
- [ ] BDD test suite exists and passes for all Acceptance Criteria
- [ ] Implementation validated against stakeholder-described behavior
- [ ] All core user flows functional end-to-end (manual QA)
- [ ] No critical or high-severity functional gaps remain
- [ ] `STATE.md` updated
- [ ] `agents-backlog.md` status updated to `DONE`
- [ ] `pnpm run lint` passes
- [ ] `npx tsc --noEmit` passes
- [ ] `pnpm run build` succeeds
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

## File System Naming

Use kebab-case for all file names and API endpoints.
