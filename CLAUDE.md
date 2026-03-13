# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server
npm run build        # Production build (Next.js standalone output)
npm run start        # Start production server
npm run serve        # Build + start combined
npm run lint         # ESLint
docker build -t populus:test .   # Local Docker build
```

No test framework is configured yet.

## Architecture

**Populus** is an HR/project management app built with Next.js 16 (App Router), PostgreSQL (pg), Auth0, and shadcn/ui.

### Data Flow

Excel files → `src/lib/excel-parser.ts` → parsed & validated → upserted into PostgreSQL via API routes → client components fetch from `/api/*` endpoints.

### Key Directories

- `src/app/api/` — RESTful API routes (people, timesheets, projects, planned-work, pto, reports, dashboard, gantt, countries, photos, clients)
- `src/components/` — Feature-organized React components (`"use client"`, useState, fetch)
- `src/components/ui/` — shadcn/ui primitives
- `src/lib/db.ts` — PostgreSQL connection pool, async query helpers (`query`, `queryOne`, `execute`, `withTransaction`), utility functions (`getRate`, `getRateForUser`, `cleanupPlannedWork`)
- `src/lib/migrate.ts` — SQL file migration runner (reads `migrations/*.sql`, tracks in `_migrations` table)
- `src/lib/sql-helpers.ts` — Shared SQL fragments for PostgreSQL date arithmetic and named-to-positional parameter conversion
- `src/lib/audit.ts` — Audit trail logging utility
- `src/lib/auth0.ts` — Auth0 client configuration
- `src/lib/excel-parser.ts` — Excel import parsers for timesheets, rates, PTO
- `data/` — `photos/` and `logos/` directories for uploaded images

### Database

PostgreSQL via `pg` (node-postgres) with connection pooling. Connection string via `DATABASE_URL` environment variable.

Database helpers in `db.ts`:
- `query<T>(sql, params)` — returns all rows
- `queryOne<T>(sql, params)` — returns first row or undefined
- `execute(sql, params)` — returns `{ rowCount, rows }`
- `withTransaction(fn)` — runs a function inside BEGIN/COMMIT/ROLLBACK

Schema managed via **SQL file migrations** in `migrations/` — numbered files (`001_description.sql`) applied on startup. The consolidated PostgreSQL schema is in `migrations/005_postgresql_initial_schema.sql`.

### Auth

Auth0 via `@auth0/nextjs-auth0`. Session checked in `src/proxy.ts` middleware. Root layout passes user to Sidebar.

### API Response Pattern

```typescript
// Success: { data, message? } with 200/201
// Error: { error: "message" } with 400/404/409/500
```

## Deployment

- **Docker**: Multi-stage build (deps → build → production). Image: `ghcr.io/lenhoney/populus`
- **CI/CD**: GitHub Actions (`.github/workflows/docker-publish.yml`) builds and pushes on merge to `main`
- **Hosting**: Railway (app + PostgreSQL add-on) or Komodo on `smartserver` via `compose.yaml`
- **Data persistence**: PostgreSQL for all data. Docker volume `populus_data` at `/app/data` for photos/logos only.
- **Database**: PostgreSQL 16 — managed by Railway or self-hosted via `compose.yaml`

### Environment Variables

```
APP_BASE_URL        # Application URL
AUTH0_DOMAIN        # Auth0 tenant domain
AUTH0_CLIENT_ID     # Auth0 app client ID
AUTH0_CLIENT_SECRET # Auth0 app secret
AUTH0_SECRET        # Session encryption key (openssl rand -hex 32)
DATABASE_URL        # PostgreSQL connection string (e.g. postgresql://user:pass@host:5432/dbname)
POSTGRES_PASSWORD   # PostgreSQL password (used in compose.yaml)
```

## Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
