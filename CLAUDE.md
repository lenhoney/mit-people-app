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

**Populus** is an HR/project management app built with Next.js 16 (App Router), SQLite (better-sqlite3), Auth0, and shadcn/ui.

### Data Flow

Excel files → `src/lib/excel-parser.ts` → parsed & validated → upserted into SQLite via API routes → client components fetch from `/api/*` endpoints.

### Key Directories

- `src/app/api/` — RESTful API routes (people, timesheets, projects, planned-work, pto, reports, dashboard, gantt, countries, photos)
- `src/components/` — Feature-organized React components (`"use client"`, useState, fetch)
- `src/components/ui/` — shadcn/ui primitives
- `src/lib/db.ts` — Database singleton, schema creation, inline migrations, helper functions (`getRate`, `getRateForUser`, `cleanupPlannedWork`)
- `src/lib/migrate.ts` — SQL file migration runner (reads `migrations/*.sql`, tracks in `_migrations` table)
- `src/lib/auth0.ts` — Auth0 client configuration
- `src/lib/excel-parser.ts` — Excel import parsers for timesheets, rates, PTO
- `data/` — SQLite database (`mit-people.db`) and `photos/` directory, committed to repo as seed data

### Database

SQLite with `better-sqlite3`. Tables created inline in `db.ts` `createDb()`. Schema changes use two mechanisms:
1. **Inline migrations** in `db.ts` — legacy approach using `PRAGMA table_info()` to check column existence
2. **SQL file migrations** in `migrations/` — new approach, numbered files (`001_description.sql`) applied on startup. See `docs/migrations.md`.

Database instance persisted via `globalThis` to survive Next.js hot reloads. Pragmas: `journal_mode = DELETE`, `foreign_keys = ON`, `busy_timeout = 5000`.

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
- **Hosting**: Komodo on `smartserver` via `compose.yaml` (UI Defined Stack)
- **Data persistence**: Docker volume `populus_data` at `/app/data`. Seed data baked into image, copied on first run
- **Reseed**: Set `RESEED_DB=true` env var in Komodo to force fresh DB on next deploy

### Environment Variables

```
APP_BASE_URL        # Application URL
AUTH0_DOMAIN        # Auth0 tenant domain
AUTH0_CLIENT_ID     # Auth0 app client ID
AUTH0_CLIENT_SECRET # Auth0 app secret
AUTH0_SECRET        # Session encryption key (openssl rand -hex 32)
RESEED_DB           # Set to "true" to force DB reseed on deploy
```

## Path Alias

`@/*` maps to `src/*` (configured in `tsconfig.json`).
