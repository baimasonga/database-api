# AVDP Integrated Data & Analytics Platform

Data integration, governance and analytics platform for the Agricultural Value Chain
Development Project (AVDP), Sierra Leone.

Scattered AVDP data sources are ingested, mapped to a canonical model, validated,
deduplicated, approved and published. Only published data reaches the analytics layer,
and only the analytics layer feeds the dashboard — so every figure on the dashboard is
traceable to an approved dataset, a file and an uploader.

```
Sources → Ingestion → Raw → Mapping/Validation → Approval → Published
        → Analytics → Dashboard API v1 → AVDP Dashboard
```

## What this is not

This is not an ERP, procurement, finance, HR, CRM or general-purpose MIS. Operational
transactions stay in the AVDP source systems. This platform consolidates, validates,
governs, publishes and visualises their output.

## Stack

Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS v4 · PostgreSQL 16 ·
Prisma · Vitest. One modular monolith, with logical modules as physical PostgreSQL
schemas.

## Getting started

**Requirements:** Node.js 20+, PostgreSQL 16+.

```bash
git clone <repository-url> && cd database-api
npm install

cp .env.example .env.local          # then edit DATABASE_URL and AUTH_SECRET
openssl rand -base64 48             # generate AUTH_SECRET

createdb avdp                       # or use an existing PostgreSQL database
npx prisma migrate deploy           # apply migrations
npm run db:seed                     # reference data + initial administrator

npm run dev                         # http://localhost:3000
```

Sign in to the Data Manager at `/login` with `SEED_ADMIN_EMAIL` (default
`admin@avdp.local`) and `SEED_ADMIN_PASSWORD`. **Change this password immediately.**

To include sample data sources, datasets and indicator targets in development:

```bash
SEED_DEV_FIXTURES=true npm run db:seed
```

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | — | PostgreSQL connection string (required) |
| `AUTH_SECRET` | — | Session signing secret; set a unique value per environment |
| `SESSION_TTL_HOURS` | `12` | Session lifetime |
| `DATA_MODE` | `mock` | `mock` serves prototype fixtures; `live` consumes `/api/v1` |
| `DASHBOARD_API_BASE_URL` | `http://127.0.0.1:3000` | Base URL the live provider fetches from |
| `UPLOAD_STORAGE_DIR` | `./storage/uploads` | Where source files are retained (never web-served) |
| `UPLOAD_MAX_BYTES` | `26214400` | Upload size limit (25 MB) |
| `UPLOAD_ALLOWED_EXTENSIONS` | `csv,xlsx,xls` | Permitted upload types; executables are always rejected |
| `API_RATE_LIMIT` | `120` | Requests per window per client and path |
| `API_RATE_LIMIT_WINDOW_SECONDS` | `60` | Rate-limit window |
| `BENEFICIARY_REF_FORMAT` | `AVDP-FRM-{seq}` | Human-readable beneficiary reference format |
| `BENEFICIARY_REF_SEQ_WIDTH` | `8` | Zero-padding width for the sequence |
| `INTEGRATION_SECRET_KEY` | — | Base64 32-byte key encrypting connector credentials at rest (AES-256-GCM). Required before an integration with credentials can be saved; generate with `openssl rand -base64 32` |
| `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` | `admin@avdp.local` / `ChangeMe!2026` | Initial administrator |
| `SEED_DEV_FIXTURES` | unset | `true` seeds development fixtures |

Environment access is centralised in `src/lib/env.ts`, which is `server-only`. Database
credentials and integration secrets never reach the browser.

## Commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run test:integration` | Integration tests against a real PostgreSQL database |
| `npm run test:all` | Lint, typecheck, unit, integration and production build |
| `npm run db:migrate` | Create and apply a migration (development) |
| `npm run db:deploy` | Apply migrations (production) |
| `npm run db:seed` | Seed reference data |
| `npx tsx scripts/register-sources.ts <csv>` | Bulk-register sources from the inventory CSV |
| `npx tsx scripts/generate-inventory-template.ts` | Regenerate the XLSX inventory template |

The `scripts/` helpers import server-only modules; run them with
`NODE_OPTIONS="--conditions=react-server"` if your Node version rejects the `server-only`
guard. `scripts/dev/` holds development-only checks, superseded for CI by
`npm run test:integration`.

## Migration procedure

Development:

```bash
npx prisma migrate dev --name <change>
```

Production:

```bash
npx prisma migrate deploy
```

Every migration must be reversible or safely forward-compatible. The analytics views
migration ships with a `down.sql`. Never edit a migration that has been applied to a
shared environment; add a new one.

## Application areas

**AVDP Dashboard** (`/`) — public analytics view: KPIs, indicator performance against
target, geographic coverage, value chain and infrastructure breakdowns, with an "About
this indicator" lineage disclosure on each headline KPI.

**AVDP Data Manager** (`/data-manager`) — internal, authenticated: Dashboard, Data
Sources, Datasets, Onboarding, Imports, Data Mapping (within an import), Data Quality,
Beneficiary Identity, Master Data, Indicators, Reporting Periods, Approval Workflow,
Published Data, Integrations, Audit Logs, Administration.

Its home screen is a governance and feed-health view: source, dataset and import counts
for the period, work awaiting review or approval, unresolved validation errors, the data
quality score and its trend across reporting periods, recent imports, sources requiring
attention, and the latest successful import and publication. It deliberately carries no
operational modules — those belong in the AVDP source systems.

**Dashboard API** (`/api/v1`) — read-only, versioned, documented at `/api/v1/openapi`.

## Roles

Seeded roles — Data Contributor, Data Reviewer, M&E Approver, Administrator — are database
rows composed from named permissions, so new roles can be created without a deployment.

## Documentation

| Document | Contents |
| --- | --- |
| [`current-architecture.md`](docs/data-platform/current-architecture.md) | Baseline assessment and the architecture as built |
| [`target-architecture.md`](docs/data-platform/target-architecture.md) | Target flow, enforced rules, safest implementation path |
| [`database-model.md`](docs/data-platform/database-model.md) | Complete data model |
| [`analytics-and-api.md`](docs/data-platform/analytics-and-api.md) | Analytics views, API contract, lineage |
| [`data-onboarding-guide.md`](docs/data-platform/data-onboarding-guide.md) | How to onboard an existing AVDP dataset |
| [`source-inventory-template.csv`](docs/data-platform/source-inventory-template.csv) / `.xlsx` | Repository inventory template |
| [`operations.md`](docs/data-platform/operations.md) | Backup, security posture, observability, production risks |

## Data mode

The dashboard runs on retained mock fixtures until live AVDP datasets are approved and
published. `DATA_MODE=live` switches it to `/api/v1`; any other value resolves to mock, so
a misconfiguration cannot fail open to live.

All dashboard data loads through `src/data/dashboard-service.ts`, and every section
resolves to one of four states — loading (skeleton), loaded, empty ("no published data for
the selected filters") or unavailable ("data temporarily unavailable"). Fictitious values
are never substituted for live data, an all-zero result is reported as empty rather than
as a row of zeros, and a failing section never blanks the rest of the page.
