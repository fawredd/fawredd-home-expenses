# Agent Skills Index

> All available skills for the `fawredd-home-expenses` project.
> Each skill lives at `.agents/skills/[agent-name]/SKILL.md`.
> The PM agent uses this index to route tasks to the correct skill.

---

## Workflow Order

```
PM → Technical BA → Security Engineer → Implementation → CI Engineer → QA Engineer → PM (DONE)
```

---

## Skills

| Agent | Folder | Trigger |
|-------|--------|---------|
| Project Manager | `project-manager` | Session start — orchestrates all other agents |
| Technical BA | `technical-ba` | PM assigns a new feature or change request |
| Security Engineer | `security-engineer` | Technical BA outputs a Requirement Doc `[DRAFT]` |
| Frontend Dev | `frontend-dev` | Requirement Doc is `[APPROVED]` — UI tasks |
| Backend Dev | `backend-dev` | Requirement Doc is `[APPROVED]` — API / logic tasks |
| Infrastructure Engineer | `infrastructure-engineer` | Requirement Doc is `[APPROVED]` — env / deployment tasks |
| CI Engineer | `ci-engineer` | Any implementation agent completes their task |
| QA Engineer | `qa-engineer` | CI Engineer issues `[CI_APPROVED]` |

---

## Role Summaries

**Project Manager** — `.agents/skills/project-manager/SKILL.md`
Central orchestrator. Owns backlog, task assignment, escalation handling, model routing, and final DONE authority. The only agent that reads `agents-stakeholders-inputs.md` at session start.

**Technical BA** — `.agents/skills/technical-ba/SKILL.md`
Sole authority for Requirement Docs. Produces specs marked `[DRAFT]`, then marks them `[APPROVED]` only after Security Engineer clears them. No implementation begins without an `[APPROVED]` doc.

**Security Engineer** — `.agents/skills/security-engineer/SKILL.md`
Reviews every Requirement Doc for OWASP Top 10 and common vulnerability classes. Reads only the Requirement Doc — nothing else. Outputs a single `[SECURITY_REVIEW]` block. Does not review code, attend backlog, or interact with CI/QA.

**Frontend Dev** — `.agents/skills/frontend-dev/SKILL.md`
Implements UI features strictly according to BA specs. Hands off to CI Engineer when complete — never directly to QA.

**Backend Dev** — `.agents/skills/backend-dev/SKILL.md`
Implements APIs and backend logic strictly according to BA specs and Swagger contracts. Hands off to CI Engineer when complete.

**Infrastructure Engineer** — `.agents/skills/infrastructure-engineer/SKILL.md`
Manages Docker, runtime environments, and deployment configuration according to BA specs. Hands off to CI Engineer when complete.

**CI Engineer** — `.agents/skills/ci-engineer/SKILL.md`
Runs `pnpm run lint` → `npx tsc --noEmit` → `pnpm run build` in that order. Issues `[CI_APPROVED]` or `[BLOCKED]`. Does not fix code — validation only.

**QA Engineer** — `.agents/skills/qa-engineer/SKILL.md`
Validates that implementation matches stakeholder intent, not just acceptance criteria. Performs BDD and manual exploratory testing. Can fail a task even if all Gherkin tests pass.

---

## Process Rules

All agents load `.agents/rules/agile-process.md` before acting.
For cross-domain errors, ambiguity, or blocks — see escalation formats in `agile-process.md`.
