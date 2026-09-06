# Operations, Security and Production Risks (Phase 17)

## Security posture

**Authentication.** Server-side sessions in `admin.sessions`; only the SHA-256 hash of the
token is stored, so a database read cannot yield a usable session. Cookies are
`httpOnly`, `sameSite=lax` and `secure` in production. Passwords are bcrypt with cost 12.
Login returns the same message for an unknown account and a wrong password, so accounts
cannot be enumerated.

**Authorisation.** Every Data Manager route handler is wrapped in `withPermission()`,
which requires a session and a named permission before the handler runs. Roles are
database rows composed from permissions, not hard-coded strings. The approval workflow
applies a second, finer check: `canTransition()` verifies the per-action permission *and*
the "no unresolved errors" rule, so a coarse route permission cannot be used to publish
bad data.

**Least privilege.** Logical modules are physical PostgreSQL schemas, so a reporting role
can be granted `analytics` without access to `beneficiaries`.

**Secure file upload.** Uploads are limited by size and extension, and a hard-coded
blocklist rejects executables and scriptable types (`.exe`, `.sh`, `.js`, `.php`, `.svg`,
`.html`, …) regardless of configuration. File names are sanitised against path traversal.
Files are stored outside the web root under a hash-derived path and served only through an
authenticated route handler that sets `Content-Disposition: attachment`,
`X-Content-Type-Options: nosniff` and `Cache-Control: private, no-store`. Reads are
confined to the configured upload root.

**Input validation.** Every request body and query string is parsed with Zod. Malformed
input returns 400 with field-level detail.

**SQL injection.** All analytics queries use parameterised `$queryRaw` tagged templates.
The one `$queryRawUnsafe` call interpolates a view name from a constant allow-list, never
user input.

**Secret management.** `src/lib/env.ts` is `server-only`; nothing else reads
`process.env`. Integration credentials are stored as `secret_ciphertext` and are excluded
from every API response. No credential is ever sent to the browser.

**Rate limiting.** Fixed window per client and path on `/api/v1`, with `Retry-After` on
429.

**Sensitive data.** Sources and datasets carry a data classification and a
`contains_personal_data` flag. The dashboard and its lineage endpoints expose only
aggregates and dataset-level provenance — never row-level beneficiary information.

## Data governance

Audit logs cover authentication, source changes, imports, mapping changes, validation
resolutions, every workflow action, merges, downloads and analytics refreshes, with actor,
entity, IP and user agent.

Publication history is retained: superseding marks the previous record `superseded` with a
pointer to its replacement. Nothing approved or published is ever physically deleted.
Merge lineage is immutable — `beneficiary_merges` stores a full snapshot of the merged
record and its retired identifiers, and the merged record is retained with
`status = 'merged'`.

Data sources with import history are soft-disabled (`archived_at`), never hard-deleted.

## Reliability

**Transactional imports.** Job creation, row landing and mapping seeding happen in one
transaction. Validation persists rows and findings in one transaction. The publish action
— materialisation, publication record, superseding, versioning and status change — is a
single transaction with a 120-second timeout.

**Duplicate import prevention.** A file's SHA-256 checksum is stored, and re-uploading an
identical file for the same dataset and reporting period is rejected with the existing
import job's ID.

**Idempotency.** Materialisation upserts training events, attendance, infrastructure
assets, identifiers and value chain links on natural keys, so a retried publication does
not duplicate them. Re-validation replaces unresolved findings while retaining resolved
ones.

**Failure recovery.** Import jobs carry a status and a status message; a failed job can be
re-mapped and re-validated without re-uploading. Analytics refresh records per-view
success or failure and continues past a failing view.

## Performance

Indexes cover all foreign keys, codes, reporting period, district, value chain, dataset,
import job, `source_import_job_id` on every core table, checksum, row hash and validation
severity, plus a partial index on live publications. List endpoints are paginated
(max 200). The dashboard aggregates in the analytics layer, never over raw transactional
tables in the browser or the API.

## Observability

Application and API errors are logged with the request path. Import lifecycle state is
recorded on the import job; integration runs record counts and error summaries; analytics
refreshes record row counts, duration and errors. The Data Manager home screen surfaces
feed health: pending review and approval, unresolved errors, latest successful import,
latest publication and the data quality score.

## Backup requirements

Two things must be backed up together, or a published figure loses its provenance:

1. **The PostgreSQL database.** Nightly `pg_dump` with point-in-time recovery (WAL
   archiving) for production. Retain 30 daily, 12 weekly and 12 monthly copies.
2. **`UPLOAD_STORAGE_DIR`.** The retained original source files. These are the evidence
   behind every published figure and cannot be reconstructed from the database. Back them
   up on the same schedule, with the same retention.

Restore drills should verify that an import job's checksum still matches its stored file.

## Testing

60 tests across 7 files: CSV and XLSX ingestion, profiling and duplicate detection,
declarative transformations, row mapping and mapping validation, all nine validation
categories, beneficiary matching (deterministic and probable), the approval workflow state
machine including its blocking rules, both dashboard providers and the mock/live switch,
API filter validation, pagination bounds, rate limiting and upload security.

`scripts/e2e-pipeline.ts` exercises the entire pipeline against a real database: upload →
profile → map → validate → blocked publication → resolve → submit → approve → publish →
analytics.

## Remaining production risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Rate limiting is in-process** | Limits are per node, so they are effectively multiplied when scaled out | Move to Redis or the edge before running more than one node |
| **Analytics are standard views** | Query cost grows with published volume | Promote hot views to materialised views; only `refreshAnalytics()` changes |
| **Publication runs inline** | A very large publication can approach the 120s transaction timeout | Move materialisation to a background job queue before onboarding six-figure datasets |
| **Materialisation covers four domains** | Input/equipment distribution, farms, plots, harvest and sales are modelled but not yet written on publication | Extend `materialiseImport` per domain as those datasets are onboarded |
| **Connector secret encryption is not implemented** | `INTEGRATION_SECRET_KEY` and the ciphertext column exist, but no adapter writes secrets yet | Implement envelope encryption alongside the first real connector |
| **No connectors implemented** | All data arrives by manual upload | Deliberate: Phase 16 forbids building integrations without API specifications |
| **Whole file held in memory during import** | Very large uploads increase memory pressure | Bounded by `UPLOAD_MAX_BYTES` (25 MB); stream-parse before raising it |
| **Single administrator seeded** | Default credentials are a risk if not changed | Change the password on first login and create individual accounts |
| **No automated backup configured** | Deployment-dependent | Configure per the backup requirements above before go-live |
| **No map component on the dashboard** | Geographic data is tabular only | Coordinates are already served by the API; add a map without touching the data layer |

## Go-live checklist

- [ ] Unique `AUTH_SECRET`; default administrator password changed
- [ ] `DATABASE_URL` points at a dedicated database with a least-privilege application role
- [ ] Database and `UPLOAD_STORAGE_DIR` backups configured and a restore drill completed
- [ ] TLS terminated in front of the application (cookies require `secure` in production)
- [ ] `DATA_MODE=mock` until live datasets are approved and published
- [ ] Real staff accounts created and assigned roles; shared accounts removed
- [ ] Reporting periods created and the current period opened
- [ ] Rate limits reviewed for the expected dashboard load
