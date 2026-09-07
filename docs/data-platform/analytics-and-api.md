# Analytics Layer and Dashboard API (Phases 10, 11, 15)

## Analytics layer

Every view lives in the `analytics` schema and joins through
`analytics.published_import_jobs`, which selects only `publication_records` with
`status = 'published'`. Unapproved data cannot reach the dashboard.

| View | Grain |
| --- | --- |
| `published_import_jobs` | Live publication per import job (lineage spine) |
| `published_beneficiaries` | Non-merged beneficiaries from published imports, with primary location |
| `analytics_beneficiary_summary` | Reporting period |
| `analytics_beneficiaries_by_district` | Period × district |
| `analytics_beneficiaries_by_value_chain` | Period × value chain |
| `analytics_beneficiaries_by_sex` | Period × district × sex |
| `analytics_training_summary` | Period × district × value chain |
| `analytics_production_summary` | Period × district × value chain |
| `analytics_infrastructure_summary` | Period × district × asset type |
| `analytics_value_chain_summary` | Value chain (beneficiaries, area, output, training) |
| `analytics_geographic_summary` | District (beneficiaries, area, training, assets) |
| `analytics_indicator_performance` | Indicator × period × district × value chain |
| `analytics_data_quality_summary` | Source × dataset × period |

The Data Manager home screen reads through `src/modules/analytics/data-manager-home.ts`,
which also builds the data quality trend — validation pass rate per reporting period,
oldest first. Periods with no imports are omitted rather than plotted as zero, and a
period with no rows reports a null pass rate rather than a misleading 0%. Headline counts
are counted directly, never derived from the length of a preview list.

Every view carries `last_published_at` and `calculated_at`, so any figure can state which
publication produced it and when it was computed.

**Lineage.** Each core fact table carries `source_import_job_id`. From any analytics row:
import job → file (checksum, uploader, upload timestamp) → dataset → data source →
reporting period → publication record.

**Refresh.** The layer is built from standard views, which are always current, so a
refresh verifies each view, counts its rows and records the timing in
`analytics_refresh_log`. Refresh runs on publication, on unpublish, and on demand from the
Published Data screen. Promoting a view to a materialised view is a change to
`refreshAnalytics()` alone; a scheduled refresh is a cron call to the same function.

**Indicator calculation.** Indicators carry a declarative `calculationRef` (for example
`beneficiaries.total`, `training.participants`, `production.area`). Actuals are computed
from the analytics layer at read time rather than stored row by row; only indicators
without a recognised reference fall back to `indicator_observations`. Targets resolve
most-specific-first (district and value chain before a global target).

## Dashboard API

Read-only, versioned at `/api/v1`, serving DTOs rather than database models. It reads the
analytics layer — never raw imports.

| Endpoint | Returns |
| --- | --- |
| `GET /api/v1/dashboard/summary` | Headline KPIs plus the leading indicators |
| `GET /api/v1/indicators` | Indicator registry with actual, target and achievement (paginated) |
| `GET /api/v1/indicators/:code` | One indicator with its definition and calculation |
| `GET /api/v1/indicators/:code/lineage` | Provenance: sources, publications, quality status |
| `GET /api/v1/geography/districts` | District summaries (paginated) |
| `GET /api/v1/geography/districts/:id/summary` | One district across all domains |
| `GET /api/v1/value-chains` | Value chain summaries (paginated) |
| `GET /api/v1/value-chains/:id/summary` | One value chain across all domains |
| `GET /api/v1/beneficiaries/summary` | Beneficiary totals and disaggregation |
| `GET /api/v1/production/summary` | Area, output, average yield |
| `GET /api/v1/training/summary` | Events, participants, certification |
| `GET /api/v1/infrastructure/summary` | Assets by status and type |
| `GET /api/v1/openapi` | OpenAPI 3.0 description of the above |

**Filters** (validated with Zod; unknown or malformed values return 400):
`reporting_period`, `district`, `chiefdom`, `value_chain`, `sex`, `age_group`.
Districts and value chains accept either a code or a name. When `reporting_period` is
omitted, the currently open period is used.

```
GET /api/v1/dashboard/summary?reporting_period=2026-Q2&district=Bo
```

**Response envelope** — identical on every endpoint:

```json
{
  "data": { },
  "metadata": {
    "generated_at": "2026-09-06T18:03:38.677Z",
    "source": "analytics",
    "last_updated": "2026-09-06T18:03:12.416Z",
    "reporting_period": "2026-Q3",
    "pagination": { "page": 1, "page_size": 50, "total": 16, "total_pages": 1 }
  },
  "filters": { "district": "Bo", "value_chain": null }
}
```

Errors use `{ "error": { "code", "message", "details" }, "metadata": { "generated_at" } }`
with codes `bad_request`, `unauthorized`, `forbidden`, `not_found`, `conflict`,
`payload_too_large`, `rate_limited`, `server_error`.

**Pagination.** `page` (≥ 1) and `page_size` (1–200, default 50) on list endpoints.

**Rate limiting.** Fixed window per client and path, configured by `API_RATE_LIMIT` and
`API_RATE_LIMIT_WINDOW_SECONDS`; a 429 carries `Retry-After`. The store is in-process and
must be moved to a shared store before running more than one node.

## Data lineage

Lineage answers "where did this number come from?" by tracing the actual path:

```
indicator → calculation reference → core table → source import job
          → publication record → dataset → data source
```

`src/modules/analytics/lineage.ts` maps each calculation reference to the core table its
records live in, finds the import jobs that materialised those records for the reporting
period, and returns only the live publications behind them:

| Calculation reference | Traced to |
| --- | --- |
| `beneficiaries.*` | `beneficiaries.beneficiaries` (excluding merged records) |
| `training.*` | `project_delivery.training_events` |
| `production.*` | `production.production_records` |
| `infrastructure.*` | `project_delivery.infrastructure_assets` |

**Only contributing publications are reported.** An indicator with nothing published
returns an empty publication list and `unavailable` status — it never borrows another
dataset's provenance. An indicator whose calculation reference is not mapped reports
`unmapped` rather than guessing.

Data quality status is `validated`, `warnings` or `unavailable`. Any unresolved warning in
*any* contributing publication downgrades the whole figure: one clean dataset does not make
a number clean.

Superseded and withdrawn publications are excluded, so lineage always describes the data
the dashboard is serving now.

`GET /api/v1/indicators/:code/lineage` returns the indicator, its calculation and version,
the reporting period, the contributing publications (dataset, source, period, published-at,
quality score), the combined source list, last update and quality status. The response
carries an `x-avdp-lineage-domain` header naming the record set behind the figure.

Each dashboard KPI carries a collapsed "About this indicator" disclosure showing the same
provenance, and the Data Manager's indicator detail page shows the full contributing
publication table with row counts, quality scores and warning counts.

Provenance is **dataset-level only** — no row-level beneficiary information is exposed
through any lineage surface. Lineage failures are caught per indicator, so a missing
lineage record can never blank the dashboard.

## Data mode and dashboard section states

`DATA_MODE=mock` serves the retained prototype fixtures; `DATA_MODE=live` consumes
`/api/v1` at `DASHBOARD_API_BASE_URL`. Any value other than `live` resolves to mock, so a
misconfiguration cannot silently fail open to live.

All dashboard data is loaded through `src/data/dashboard-service.ts`, the single place
that fetches, catches and classifies. Each section resolves to exactly one of four states:

| State | When | What the user sees |
| --- | --- | --- |
| **Loading** | The section is still streaming | A skeleton matching the section's final layout, so nothing shifts |
| **Loaded** | Data returned and is non-empty | The figures |
| **Empty** | The request succeeded but nothing is published for the filters | "No published data for the selected filters", naming the reporting period |
| **Unavailable** | Live mode could not reach the API | "Data temporarily unavailable", with the endpoint — never a substituted figure |

Two distinctions matter:

- **Empty is not zero.** An all-zero result means nothing has been published yet, not that
  the project delivered nothing. Rendering a row of zeros would misrepresent the
  programme, so the section says which state it is in.
- **Failure is isolated.** A failing section renders its own unavailable state; the rest of
  the dashboard still shows its data. One slow or broken endpoint cannot blank the page.

Indicator lineage is supplementary, so a lineage failure resolves to `null` and the KPI it
annotates renders normally.

Sections stream independently through React Suspense. `src/app/loading.tsx` provides the
route-level skeleton and `src/app/error.tsx` is a last-resort boundary for genuine
defects — it shows no figures at all, because their accuracy cannot be confirmed.
