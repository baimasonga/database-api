# Target Architecture (Phase 1)

## The flow

```
AVDP DATA SOURCES
Excel · CSV · ODK/Kobo · MIS · Finance · Procurement · GPS/GIS · other DBs
        │
        ▼
┌─────────────────────────────┐
│ DATA INGESTION              │  upload today; connector framework for API/sync
│ src/modules/ingestion       │  checksum · size/type limits · executable rejection
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ RAW DATA                    │  governance.import_files · governance.import_rows
│ verbatim, never modified    │  original file retained and hash-addressed
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ MAPPING + VALIDATION        │  declarative transformations · 9 rule categories
│ CLEANING + DEDUPLICATION    │  deterministic then probable matching
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ APPROVAL LAYER              │  submit → review → approve, permission-gated
│ errors block progression    │  every action audited
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ PUBLISHED DATA              │  governance.publication_records
│ core layer written on       │  supersede, never delete
│ publication only            │
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ ANALYTICS WAREHOUSE         │  analytics.* views, published data only
│ lineage preserved per row   │  refresh logged
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ DASHBOARD API v1            │  /api/v1 · DTOs · filters · pagination · rate limits
└──────────────┬──────────────┘
               ▼
┌─────────────────────────────┐
│ AVDP DASHBOARD              │  KPIs · charts · indicator lineage
│ DATA_MODE=mock | live       │
└─────────────────────────────┘
```

## The rules this architecture enforces

| Rule | Where it is enforced |
| --- | --- |
| The dashboard never queries raw operational data | `analytics.published_*` views join through `publication_records` with `status = 'published'`; the API reads only those views |
| Invalid records are never silently discarded | Every finding is persisted in `governance.validation_results` with its raw value; only rows without error-severity findings are materialised, and the rest stay in the raw layer |
| Data with unresolved errors cannot be published | `canTransition()` blocks `submit`, `approve` and `publish` while `unresolvedErrorCount > 0` |
| Every number is traceable | Core records carry `source_import_job_id` → import job → file (checksum, uploader, timestamp) → dataset → source → reporting period → publication |
| Nothing arbitrary executes | Transformations and validation rules are discriminated unions parsed by Zod; there is no script or expression operation |
| Credentials never reach the browser | `src/lib/env.ts` is `server-only`; integration secrets are stored as ciphertext and excluded from every API response |
| Publication history is retained | Superseding marks the old record `superseded` with a pointer to its replacement; nothing is deleted |
| Merges never destroy lineage | `beneficiary_merges` stores a full snapshot and the retired identifiers; the merged record is retained with `status = 'merged'` |

## The smallest safe implementation path

This is the order the build followed, and the order to follow for each new dataset:

1. Register the data source (metadata only).
2. Register the dataset and its domain.
3. Upload one sample file; inspect the profile. Nothing is written to the core layer.
4. Map columns to canonical fields; save a reusable template.
5. Validate. Read the findings. Correct at source and re-import — do not edit raw data.
6. Submit, review, approve.
7. Publish. Only now does anything reach the core layer and the analytics views.
8. Point the relevant indicator at its calculation reference.
9. Switch `DATA_MODE=live` only when the dashboard's indicators are all backed by
   published data. Until then, `DATA_MODE=mock` keeps the dashboard usable.

Each step is reversible up to publication, and publication itself is reversible via
`unpublish`, which retains the history.

## Adopting an existing dashboard

If the real AVDP dashboard prototype lives elsewhere, it does not need to be rebuilt:

1. Keep its components and theme as they are.
2. Copy `src/data/types.ts`, `src/data/providers/live.ts` and `src/data/index.ts` into it.
3. Move its hard-coded figures into a `MockDashboardDataProvider` equivalent.
4. Replace direct fixture imports in components with provider calls.
5. Point `DASHBOARD_API_BASE_URL` at this platform and switch `DATA_MODE`.

Only step 4 touches the existing components, and it is a mechanical substitution.

## Deliberate non-goals

This platform is a data integration, governance and analytics platform. It is not an ERP,
procurement, finance, HR, CRM, farmer operational management or general-purpose MIS
system. Operational transactions stay in the source systems; this platform consolidates,
maps, validates, governs, publishes and visualises their output.
