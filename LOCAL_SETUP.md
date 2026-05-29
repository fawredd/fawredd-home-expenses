# Local Development Setup (No Docker)

This guide walks through setting up the Fawredd Home Expenses application for local development without Docker.

---

## Prerequisites

### Required Software

1. **Node.js** (v18 or higher)
   - Download from: https://nodejs.org/
   - Verify: `node --version`

2. **PostgreSQL** (v14 or higher)
   - Download from: https://www.postgresql.org/download/
   - Install and remember your `postgres` password
   - Verify: `psql --version`

3. **Git**
   - Download from: https://git-scm.com/download/win
   - Verify: `git --version`

4. **pnpm** (Package manager)
   ```bash
   npm install -g pnpm
   pnpm --version
   ```

### Optional but Recommended

- **Ollama** (for local AI/OCR)
  - Download from: https://ollama.ai
  - Pull required models:
    ```bash
    ollama pull nomic-embed-text    # For embeddings (RAG)
    ollama pull mistral             # For categorization AI
    ```

- **Redis** (for background jobs)
  - For Windows: Download from https://github.com/microsoftarchive/redis/releases
  - Or use Windows Subsystem for Linux (WSL)

---

## Step 1: Create PostgreSQL Database

Open a terminal and connect to PostgreSQL:

```bash
# Connect as postgres user
psql -U postgres

# Create the database
CREATE DATABASE fawredd_local;

# Create pgvector extension (required for RAG)
\c fawredd_local
CREATE EXTENSION IF NOT EXISTS vector;

# Verify extension is installed
\dx

# Exit psql
\q
```

---

## Step 2: Set Up Node.js Project

```bash
# Navigate to project directory
cd c:\vscode\fawredd-home-expenses

# Install dependencies
pnpm install

# Copy environment template
copy .env.example .env.development.local

# Update .env.development.local with your settings
# DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/fawredd_local
```

Edit `.env.development.local`:

```env
# Database Configuration
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fawredd_local

# Redis Configuration (optional)
REDIS_URL=redis://localhost:6379

# AI Configuration
OLLAMA_BASE_URL=http://localhost:11434
AI_PROVIDER=ollama

# Storage Configuration
STORAGE_PATH=./storage/documents

# Environment
NODE_ENV=development
```

---

## Step 3: Set Up Database Schema

Generate and apply the database schema using Drizzle:

```bash
# Generate migrations from schema
pnpm db:generate

# Push schema to database (creates all tables)
pnpm db:push

# Seed default categories
pnpm db:seed

# Verify (optional - opens Drizzle Studio)
pnpm db:studio
# Then visit http://localhost:3000 in browser
```

---

## Step 4: Start Ollama (Optional but Recommended)

If you installed Ollama:

```bash
# Start Ollama service
ollama serve

# In another terminal, pull models
ollama pull nomic-embed-text
ollama pull mistral
```

---

## Step 5: Start Redis (Optional)

If you installed Redis:

```bash
# Start Redis server
redis-server
```

Or if Redis is installed as a service, it may start automatically.

---

## Step 6: Start Development Server

```bash
# Start Next.js dev server
pnpm dev

# Server will start at http://localhost:3000
# HMR (hot reloading) enabled
```

---

## Verification Checklist

After setup, verify everything is working:

- [ ] PostgreSQL running: `psql -U postgres -d fawredd_local -c "SELECT COUNT(*) FROM categories;"`
- [ ] Database has 9 default categories (from seed)
- [ ] Next.js dev server running at `http://localhost:3000`
- [ ] No errors in console
- [ ] Ollama running (if installed): `curl http://localhost:11434/api/version`

---

## Troubleshooting

### PostgreSQL Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Solution:**

- Ensure PostgreSQL is running
- Windows: Check Services → PostgreSQL Server
- Check DATABASE_URL in `.env.development.local`
- Verify password is correct

### pgvector Extension Not Found

```
Error: extension "vector" does not exist
```

**Solution:**

```bash
# Connect to database and create extension
psql -U postgres -d fawredd_local
CREATE EXTENSION IF NOT EXISTS vector;
\q
```

### Drizzle Push Fails

```
Error: not enough privileges
```

**Solution:**

- Ensure you're connecting as `postgres` user (has permission to create tables)
- Check DATABASE_URL has correct credentials

### Port 3000 Already in Use

```
Error: listen EADDRINUSE: address already in use :::3000
```

**Solution:**

```bash
# Kill process using port 3000
# On Windows CMD:
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Or specify different port:
pnpm dev -- -p 3001
```

---

## Development Workflow

### Daily Development

```bash
# 1. Start PostgreSQL (if not running as service)
# 2. Start Ollama (if using local AI)
# 3. Start development server
pnpm dev

# 4. Make code changes (HMR enabled)
# 5. Stop with Ctrl+C
```

### Database Schema Changes

```bash
# 1. Edit db/schema.ts
# 2. Generate migration
pnpm db:generate

# 3. Push changes
pnpm db:push

# 4. Restart dev server
```

### Adding New Categories (Seed Data)

```bash
# Edit db/seed.ts
# Re-run seed
pnpm db:seed
```

---

## Useful Commands

```bash
# Database
pnpm db:generate    # Generate migrations from schema changes
pnpm db:push        # Push schema to database
pnpm db:migrate     # Apply migrations
pnpm db:seed        # Run seed script
pnpm db:setup       # Push schema + seed (full setup)
pnpm db:studio      # Open Drizzle Studio (visual DB browser)

# Development
pnpm dev            # Start dev server with HMR
pnpm build          # Build for production
pnpm start          # Start production server
pnpm lint           # Run ESLint

# Debugging
pnpm db:studio      # Visual inspection of database
# Open http://localhost:3000 in browser

# TypeScript
# Check types: tsc --noEmit
```

---

## Performance Tips

1. **Use indexes**: Database queries have proper indexes (see schema.ts)
2. **Enable query logging**: Add `debug: true` to Drizzle config to see SQL
3. **Monitor database size**: `SELECT pg_database.datname, pg_size_pretty(pg_database.datsize) FROM pg_database;`

---

## Next Steps

1. ✅ Database schema is ready
2. ⏳ Implement API endpoints (See `app/api/` structure)
3. ⏳ Build frontend components
4. ⏳ Create BDD test suites

---

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review `.agents/artifacts/requirement-docs/` for specifications
3. Check Drizzle ORM docs: https://orm.drizzle.team/
4. Check Next.js docs: https://nextjs.org/docs

---

**Last Updated:** 2026-05-27
**Status:** Ready for implementation