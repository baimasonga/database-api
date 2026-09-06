# Current Architecture Assessment (Phase 1)

## Baseline condition at the start of this work

The prompt pack assumes an existing AVDP dashboard prototype with mock data. **That
prototype was not present in this repository.** At the start of Phase 1 the repository
`baimasonga/database-api` contained:

```
first          # a single 12-byte text file
.git/          # one commit: "Add initial content to first file"
```

There was no frontend, no backend, no database configuration, no API layer, no
authentication, no tests, no deployment configuration and no data models. The Phase 1
searches specified in the prompt pack (`mock`, `dummy`, `seed`, `fixture`, `sample`,
`statistics`, `indicators`, `kpi`, `valueChain`, `district`, `chiefdom`, `beneficiary`,
`farmer`, `production`, `infrastructure`, `training`) returned no matches.

This was confirmed with the repository owner, who directed a greenfield full-stack build
in this repository: the platform plus a minimal AVDP dashboard running on mock data, so
that the mock/live switch required by Phase 12 is real and demonstrable rather than
theoretical.

**Consequence for the prompt pack's rules.** The instructions "preserve existing
dashboard functionality", "reuse the existing technology stack", "do not redesign the
existing dashboard" and "identify the current mock-data architecture" have no existing
artefact to apply to. They have been honoured in spirit: the dashboard built here is
deliberately thin, its mock fixtures are the only source of dashboard numbers until data
is published, and every later phase was implemented behind the data-provider abstraction
so the dashboard layer never had to be rewritten.

If the real AVDP dashboard prototype exists in another repository, the integration path is
in `target-architecture.md` under *Adopting an existing dashboard*.

## Architecture as built

| Concern | Choice | Rationale |
| --- | --- | --- |
| Frontend | Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4 | Server components keep dashboard queries server-side; no database credentials reach the browser. |
| Backend | The same Next.js application (modular monolith) | The prompt pack requires a modular monolith and forbids unnecessary microservices. |
| Database | PostgreSQL 16 with Prisma ORM | Explicitly preferred by the prompt pack; multi-schema support gives real physical module separation. |
| Auth | First-party session cookies, bcrypt password hashing, database-backed roles and permissions | No pre-existing framework to reuse; roles are data rows, not hard-coded strings. |
| Testing | Vitest | Fast, no browser needed for the pure engine logic that carries the risk. |

### Module layout

```
src/
  app/                      routes
    page.tsx                public AVDP dashboard
    login/                  authentication
    data-manager/           internal AVDP Data Manager (14 areas)
    api/v1/                 versioned read-only Dashboard API
    api/admin/              Data Manager operations (session + permission gated)
  data/                     dashboard data-provider abstraction
    types.ts                the dashboard contract
    dashboard-service.ts    the only place that fetches, catches and classifies
    mock/fixtures.ts        retained prototype fixtures
    providers/mock.ts       MockDashboardDataProvider
    providers/live.ts       LiveDashboardDataProvider
  modules/                  domain logic, independent of HTTP and React
    ingestion/              parse, profile, secure storage, pipeline
    mapping/                canonical fields, declarative transformations, lookups
    quality/                validation rules and engine
    identity/               beneficiary references and duplicate matching
    approval/               workflow state machine, materialisation, service
    analytics/              analytics read model and refresh
    integrations/           connector registry (framework)
  lib/                      env, db, auth, audit, API envelope, rate limiting
prisma/                     schema, migrations, seeds
```

## Mock-data flow

```
src/data/mock/fixtures.ts
  → MockDashboardDataProvider
    → getDashboardProvider()   (selects by DATA_MODE)
      → src/data/dashboard-service.ts   (fetch, catch, classify)
        → src/app/page.tsx sections
```

Dashboard components receive a resolved `SectionResult` — `ok`, `empty` or `unavailable` —
and plain contract types. They cannot tell whether the numbers came from fixtures or from
the live API, they never import fixtures directly, and they never call a provider or catch
an error themselves.

## Major data domains

| Domain | PostgreSQL schema | Purpose |
| --- | --- | --- |
| Governance | `governance` | Sources, datasets, imports, mapping, validation, approval, publication, audit, integrations |
| Master data | `master_data` | Sierra Leone geography, value chains, units, partners, reporting periods |
| Beneficiaries | `beneficiaries` | Canonical beneficiary identity, groups, deduplication and merge lineage |
| Project delivery | `project_delivery` | Activities, training, input/equipment distribution, infrastructure |
| Production | `production` | Farms, plots, production, harvest and sales records |
| Monitoring | `monitoring` | Indicator registry, disaggregations, targets, observations |
| Analytics | `analytics` | Views over published data plus refresh bookkeeping |
| Admin | `admin` | Users, roles, permissions, sessions |

## Technical debt and constraints affecting live-data integration

1. **No real AVDP data has been onboarded.** Every dataset must go through the onboarding
   process in `data-onboarding-guide.md`. Nothing should be mass-imported.
2. **Materialisation covers four domains.** `materialiseImport` writes beneficiaries,
   training, production and infrastructure. Input/equipment distribution, farms, plots,
   harvest and sales records are modelled and indexed but not yet written by the
   publication step.
3. **Analytics are standard views, not materialised views.** Correct and always current,
   but heavier at scale. The refresh function is already the single point of change.
4. **Rate limiting is in-process.** Correct for one node; needs a shared store before
   horizontal scaling.
5. **Connectors are framework-only.** The adapter interface, configuration entities and
   run logging exist; no concrete adapter is registered, by design (Phase 16 forbids
   building integrations without API specifications).
6. **The dashboard has no map component.** District data carries coordinates and the API
   serves them; a choropleth or point map can be added without touching the data layer.
7. **Section streaming is server-side only.** Sections stream independently through
   Suspense, but filter changes are full navigations. Client-side transitions would need a
   router-level loading treatment.

## Components that should remain unchanged

- `src/data/types.ts` — the dashboard contract. Changing it ripples into both providers.
- `src/data/mock/fixtures.ts` — retained until live AVDP data is approved and published.
- `src/modules/approval/workflow.ts` — the single authority on workflow legality.
- `src/data/dashboard-service.ts` — the single place dashboard data is fetched and
  classified. Fetching from a component would reintroduce the duplication it removes.
- The analytics views' "published only" join. Loosening it would let unapproved data reach
  the dashboard.

## Components that are deliberately abstracted

- Dashboard data access, behind `DashboardDataProvider`.
- Transformations and validation rules, expressed declaratively as data.
- Connectors, behind the `Connector` interface.
- Roles and permissions, stored as rows rather than hard-coded strings.

## Baseline commands

There was no existing test or build command to run as a baseline; the repository had no
`package.json`. The gate established for every phase is:

```
npm run lint        # eslint (flat config)
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # next build
```
