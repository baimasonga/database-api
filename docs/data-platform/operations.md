# Operations, Security and Production Risks (Phase 17)

## Security posture

**Authentication.** Server-side sessions in `admin.sessions`; only the SHA-256 hash of the
token is stored, so a database read cannot yield a usable session. Cookies are
`httpOnly`, `sameSite=lax` and `secure` in production. Passwords are bcrypt with cost 12.
Login returns the same message for an unknown account and a wrong password, so accounts
cannot be enumerated.

**Authorisation.** Authorisation is enforced at three layers:

1. Every Data Manager **route handler** is wrapped in `withPermission()`, which requires a
   session and a named permission before the handler runs.
2. Every Data Manager **page** calls `requirePermission()` and renders nothing without it.
   The layout only proves a visitor is signed in; screens differ in sensitivity, and
   beneficiary identity and validation findings can both contain personal data, so each
   screen states the capability it needs.
3. The approval workflow applies a finer check: `canTransition()` verifies the per-action
   permission *and* the "no unresolved errors" rule, so a coarse route permission cannot be
   used to publish bad data.

Roles are database rows composed from permissions, not hard-coded strings.

**Brute-force protection.** Sign-in is a server action, so the `/api` rate limiter never
sees it. `checkLoginThrottle()` locks an account after five failures in fifteen minutes,
counting per email *and* per client address: locking by email alone would let an attacker
lock a colleague out, and by address alone would miss a distributed attempt on one
account. A successful sign-in clears the count, so ordinary typos are not cumulative.
Every failed attempt is audited.

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
`process.env`. Connector credentials are encrypted with AES-256-GCM under
`INTEGRATION_SECRET_KEY` before they are stored: the ciphertext is self-describing
(`v1.<iv>.<tag>.<ciphertext>`) so the format can be rotated, the authentication tag makes
tampering detectable, and a wrong key and a tampered payload fail identically. A key of
the wrong length is refused rather than silently weakening encryption, and an integration
that needs credentials cannot be saved until a valid key is configured.

Every integration leaves the server through `redactIntegration()`, which strips the
ciphertext and reports only whether a secret exists — a single choke point, so a
credential cannot escape through a route that forgot to omit the field. Audit entries
record *that* credentials changed, never their value. No credential is ever sent to the
browser.

**Rate limiting.** Fixed window per client and path on `/api/v1`, with `Retry-After` on
429. `/api/admin` is protected by session and permission checks instead; login has its own
throttle.

**Security headers.** Every response carries `X-Frame-Options: DENY`, `nosniff`, a strict
referrer policy, a `Permissions-Policy` denying camera, microphone, geolocation, payment
and USB, and a Content-Security-Policy limiting `default-src`, `connect-src` and
`form-action` to `self` with `frame-ancestors 'none'` and `object-src 'none'`. HSTS is
added in production only, where TLS is terminated. `X-Powered-By` is suppressed, and
`/api/admin` responses are `private, no-store` so no shared proxy caches a download.

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

**Integration runs cannot bypass governance.** The run orchestrator lands connector output
in the raw layer and validates it, then stops. It has no code path to approve or publish,
so a connector reaches the dashboard only through the same human approval workflow as a
manual upload. Each run records its attempt, counts and failure summary whether it
succeeds or fails, and the connector's payload is retained verbatim as the import file —
so a connector-sourced figure is exactly as traceable as an uploaded one.

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

**Unit tests** — hermetic and fast (`npm test`):

| Area | Covered |
| --- | --- |
| CSV / XLSX ingestion | Parsing, duplicate headers, blank columns, unsupported types |
| Profiling | Type detection, completeness, duplicate rows, row hashing |
| Mapping | All eight transformations, chains, row projection, mapping validation |
| Validation | All nine rule categories, severities, suggestions, quality score |
| Duplicate detection | Deterministic and probable matching, name similarity |
| Approval | State machine, permission gates, the unresolved-errors block |
| Analytics | Quality-trend computation, ordering, empty and null cases |
| Lineage | Reference-to-record-set mapping, quality-status derivation |
| Onboarding | Every lifecycle transition and the monotonic guarantee |
| Inventory | Field coercion, domain inference, classification |
| Integrations | Encryption round-trip, tamper and wrong-key rejection, redaction |
| API | Filter validation, pagination bounds, rate limiting, upload security |
| Authorisation | Role capability matrix, workflow authorisation, login throttling |
| Dashboard | Both providers, the mock/live switch, all four section states |

**Integration tests** — against a real PostgreSQL database
(`npm run test:integration`, opt-in via `RUN_INTEGRATION_TESTS=true`): CSV ingestion with
file retention, checksum-based duplicate rejection, validation that retains invalid rows,
the approval gate refusing publication while errors are unresolved, publication
materialising only valid rows, analytics reflecting published data, lineage attributing to
the right dataset and no other, and publication history surviving an unpublish. The suite
creates and removes its own fixtures.

`npm run test:all` runs lint, typecheck, unit tests, integration tests and the production
build in one pass.

## Remaining production risks

| Risk | Impact | Mitigation |
| --- | --- | --- |
| **Rate limiting is in-process** | Limits are per node, so they are effectively multiplied when scaled out | Move to Redis or the edge before running more than one node |
| **Analytics are standard views** | Query cost grows with published volume | Promote hot views to materialised views; only `refreshAnalytics()` changes |
| **Publication runs inline** | A very large publication can approach the 120s transaction timeout | Move materialisation to a background job queue before onboarding six-figure datasets |
| **Materialisation covers four domains** | Input/equipment distribution, farms, plots, harvest and sales are modelled but not yet written on publication | Extend `materialiseImport` per domain as those datasets are onboarded |
| **Three connector types remain framework-only** | ODK, database and webhook sources cannot yet be ingested automatically | Deliberate: Phase 16 forbids building integrations without API specifications. The adapter interface and run orchestration are in place, so each is a self-contained addition |
| **Integration runs execute inline** | A large scheduled pull occupies a request worker | Move runs to the same background queue as publication before enabling high-volume schedules |
| **No scheduler is wired** | `scheduleCron` is stored but nothing fires it; runs are manual | Point a scheduler at the Run Now endpoint, or add a worker that polls due integrations |
| **Whole file held in memory during import** | Very large uploads increase memory pressure | Bounded by `UPLOAD_MAX_BYTES` (25 MB); stream-parse before raising it |
| **Single administrator seeded** | Default credentials are a risk if not changed | Change the password on first login and create individual accounts |
| **Login throttle and rate limits are in-process** | Both reset on deploy and are per-node, so limits are effectively multiplied when scaled out | Move both to a shared store alongside the API rate limiter |
| **Sessions are pruned on demand, not on a schedule** | `pruneExpiredSessions()` exists but nothing calls it periodically | Call it from the same scheduler that will drive integration runs |
| **CSP allows `unsafe-inline` for scripts and styles** | Weakens XSS defence in depth | Required by Next's runtime style and hydration injection; tighten with per-request nonces if the framework's support matures |
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
- [ ] `INTEGRATION_SECRET_KEY` generated per environment and stored in the secret manager,
      never in source control
