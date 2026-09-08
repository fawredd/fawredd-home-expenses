# Fawredd Home Expenses

Fawredd Home Expenses is a local financial-document application. It accepts PDF and image uploads, extracts transaction data, categorizes movements, and presents dashboard summaries for movements, months, years, and categories. The implemented UI is Spanish-language and the seeded taxonomy contains nine categories.

## Features

- Upload up to five PDF/JPG/PNG files per request.
- Validate MIME type, extension, size, and magic bytes before filesystem storage.
- Extract PDF text with `pdf-parse` and image text with Ollama; enhance incomplete fields with Ollama JSON extraction.
- Detect bank statements and extract multiple transactions.
- Use extraction memory to route known document profiles through hinted extraction or send unknown profiles to review.
- Categorize movements using rules, pgvector similarity, Ollama fallback, or the default uncategorized category.
- Review extracted documents, correct movement categories, and record correction/learning data.
- View filtered movements, financial metrics, monthly and annual summaries, category breakdowns, and uncategorized counts.
- Protect the homepage and middleware-matched application paths with Clerk authentication.

## Architecture

The application uses the Next.js App Router. React client components call route handlers under `app/api/`. Route handlers use shared utilities in `lib/`, Drizzle ORM through `db/`, and local filesystem storage for uploaded files. Upload processing is dispatched to a process-local in-memory job queue. PostgreSQL, including the `vector` extension, stores application data.

### Verified technology stack

- Next.js `16.2.6`, React `19.2.4`, and React DOM `19.2.4`
- TypeScript and ESLint with `eslint-config-next`
- Drizzle ORM and Drizzle Kit with PostgreSQL via `pg`
- PostgreSQL with the pgvector extension supplied by `pgvector/pgvector:pg17` in Docker Compose
- Clerk for authentication
- Zod for request validation
- `pdf-parse` for PDF text extraction
- Ollama HTTP endpoints for OCR, field extraction, statement extraction, and AI categorization
- Tailwind CSS v4/PostCSS, Radix UI, shadcn, Lucide React, `clsx`, `tailwind-merge`, and `class-variance-authority` for the UI
- `@modelcontextprotocol/sdk` and the checked-in MCP server for the local developer workflow

## Main Architectural Decisions

- Database access is centralized through Drizzle and the schema is isolated in the configurable `fawredd_home_expenses` PostgreSQL schema.
- Uploaded files use local filesystem storage under a configurable path; the database stores document metadata and the relative file path.
- Extraction uses deterministic parsing first, then optional Ollama enhancement when confidence is low or required fields are missing.
- Categorization follows rules, RAG similarity, Ollama, then the default category.
- The job queue is an in-memory singleton with priority ordering and retries. The `processing_jobs` table exists, but the current upload path uses the in-memory queue.
- External request bodies are validated with Zod in the implemented create/update/review paths.
- Clerk identity is preferred for API user scoping; `x-user-id` and `DEFAULT_USER_ID` are fallback identity sources in `getCurrentUserId`.

## Project Structure

```text
app/                  App Router pages, layout, auth pages, and API route handlers
components/           Dashboard, upload, review, movement, and summary UI
db/                   Drizzle schema, connection, queries, seed, and migrations
lib/                  Extraction, categorization, memory, file, queue, API, and types
public/               Static assets
storage/documents/    Local uploaded-document storage
.agents/              Agent workflow rules and generated project artifacts
.vscode/              VS Code MCP server registration
```

See [DATA_FLOW.md](DATA_FLOW.md) for the entities and request lifecycles.

## Installation and Configuration

Prerequisites are Node.js 18+, pnpm, PostgreSQL 14+, and Git. For the containerized path, Docker Compose provides PostgreSQL/pgvector and Redis.

```powershell
pnpm install
copy .env.example .env.development.local
pnpm db:setup
pnpm dev
```

The development server runs at `http://localhost:3000`. The database scripts are:

```text
pnpm db:generate   Generate Drizzle migrations
pnpm db:push       Push the schema to PostgreSQL
pnpm db:migrate    Apply migrations
pnpm db:seed       Seed the default categories
pnpm db:setup      Run db:push and db:seed
pnpm db:studio     Start Drizzle Studio
pnpm lint          Run ESLint
pnpm typecheck     Run TypeScript without emitting files
pnpm build         Build the Next.js application
```

`docker compose up -d` starts the checked-in PostgreSQL/pgvector and Redis services. The repository also contains [LOCAL_SETUP.md](LOCAL_SETUP.md) with the manual PostgreSQL setup path.

## Environment Variables

The templates define the following variables. Values are intentionally not repeated here.

| Variable                            | Role                         | Evidence/status                                                                  |
| ----------------------------------- | ---------------------------- | -------------------------------------------------------------------------------- |
| `DATABASE_URL`                      | PostgreSQL connection string | Read by Drizzle runtime and Drizzle Kit; local fallback exists                   |
| `DB_SCHEMA`                         | PostgreSQL schema name       | Read by `db/schema.ts`; defaults to `fawredd_home_expenses`                      |
| `REDIS_URL`                         | Redis connection setting     | Declared by templates/Compose; no direct application read found                  |
| `OLLAMA_BASE_URL`                   | Ollama base URL              | Read by extraction and categorization code; defaults to `http://localhost:11434` |
| `AI_PROVIDER`                       | AI provider setting          | Declared by templates; no direct application read found                          |
| `AI_API_KEY`                        | Optional provider key        | Commented in the template; no direct application read found                      |
| `STORAGE_PATH`                      | Uploaded-file root           | Read by `lib/file-utils.ts`; defaults to `./storage/documents`                   |
| `LOG_LEVEL`                         | Logging setting              | Declared by templates; no direct application read found                          |
| `DEFAULT_USER_ID`                   | Local fallback API identity  | Read by `lib/api-utils.ts`                                                       |
| `NODE_ENV`                          | Runtime environment          | Read for development logging                                                     |
| `CLERK_SECRET_KEY`                  | Clerk server configuration   | Declared in environment templates and used by Clerk integration                  |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk client configuration   | Declared in environment templates and used by Clerk integration                  |

Do not commit real credentials. The checked-in `.env.development` currently contains values and should be treated as local configuration.

## Authentication and External Services

`ClerkProvider` wraps the application, `app/page.tsx` redirects unauthenticated users to `/sign-in`, and `proxy.ts` applies `clerkMiddleware` to non-static, non-auth paths. API dashboard routes call `getCurrentUserId`, which scopes query results through `documents.userId` when an identity is available.

The concrete runtime integrations are PostgreSQL/pgvector, Clerk, Ollama, and the local filesystem. Redis is provisioned in Docker Compose and declared in the environment template, but no application module directly reads `REDIS_URL`. The MCP server is a developer-tool integration, not an application data dependency.

## AI-Assisted Developer Experience

The repository includes AI-agent metadata as project data:

- `AGENTS.md` contains the repository's agent guidance and points to `.agents/rules/agile-process.md`.
- `CLAUDE.md` delegates to `AGENTS.md`.
- `.agents/rules/` contains the agile workflow rule file.
- `.agents/artifacts/` contains project state, requirements, API contracts, and test reports.
- `.vscode/mcp.json` registers `mcp-server.mjs` as the local `agile-orchestrator` MCP server.
- `agents-backlog.md` and `agents-stakeholders-inputs.md` are additional workflow/project inputs.

These files describe the intended AI-assisted development workflow and are not application runtime modules.

## Known Implementation Boundaries

- The job queue is process-local and is not persisted in the `processing_jobs` table.
- Authentication is integrated, but the API still contains local fallback identity behavior.
- The pending-review component requests `/api/documents?status=awaiting_review&limit=20`; no matching `app/api/documents/route.ts` file is present in the repository tree and this integration requires further investigation.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!
