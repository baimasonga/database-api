# Database Model (Phase 2)

PostgreSQL 16, managed with Prisma. Logical modules are physical schemas, so a role can be
granted access to `analytics` without seeing `beneficiaries`.

All tables use UUID primary keys, `created_at` and `updated_at`; governance and core
entities also carry `created_by` / `updated_by` where an actor is meaningful.

## `admin` — access control

| Table | Purpose |
| --- | --- |
| `users` | Staff accounts; bcrypt hashes, never plaintext |
| `roles`, `permissions`, `role_permissions`, `user_roles` | Role/permission framework. Roles are data, so new roles need no deployment |
| `sessions` | Server-side sessions; only the SHA-256 hash of the token is stored |

Seeded roles: Data Contributor, Data Reviewer, M&E Approver, Administrator.

## `master_data` — reference data

`districts` → `chiefdoms` → `wards` → `communities`. Every level below district is
optional, because not every AVDP dataset carries all of them: `communities` may attach at
district, chiefdom or ward level.

Also: `value_chains`, `units_of_measure` (with conversion factors), `organizations`,
`implementing_partners`, `reporting_periods` (quarter/year/custom, with
`planned | open | closed | locked`; locked periods reject new uploads).

Master data doubles as the validation reference set — a district added here is
immediately accepted by the quality engine, with no code change.

## `governance` — the data hub

**Registry.** `data_sources` (type, connection, frequency, classification, onboarding
status, contact, last-received/-imported/-synced timestamps) and `datasets` (domain,
owner, primary identifier). Neither is ever hard-deleted; `archived_at` provides soft
disable so import history stays traceable.

**Ingestion.** `import_files` (name, size, MIME, SHA-256 checksum, uploader, timestamp),
`import_jobs` (source, dataset, period, status, row/column/valid/error/warning/duplicate
counts, quality score, JSON profile) and `import_rows` (verbatim `raw_data`, canonical
`mapped_data`, `row_hash`, validity flags).

Import status: `uploaded → profiling → mapping_required → validating →
validation_failed | ready_for_review → submitted → approved → published`, plus `rejected`
and `failed`.

**Mapping.** `mapping_templates` / `mapping_template_fields` (reusable per dataset),
`import_field_mappings` (per job), and `lookup_sets` / `lookup_values` for controlled
alias mappings such as `BO DISTRICT → Bo` and `M → male`. Transformations are stored as
declarative JSON arrays; there is no code path that evaluates arbitrary expressions.

**Quality.** `validation_rules` (category, severity, declarative config) and
`validation_results` (job, row, field, rule code, severity, message, raw value, suggested
value, resolution, resolver, timestamp).

**Approval and publication.** `approval_requests`, `approval_actions` (actor, action,
previous and new status, comment, timestamp), `publication_records`
(`published | superseded | withdrawn`, with `superseded_by_id`) and `dataset_versions`.

**Audit and integration.** `audit_logs` (actor, action, entity, changes, IP, user agent)
and `integrations` / `integration_runs`. Integration secrets are stored only as
`secret_ciphertext`.

## `beneficiaries` — canonical identity

`beneficiaries` holds the canonical record. The human-readable `avdp_reference`
(`AVDP-FRM-00000001`, format configurable) is a **unique attribute, not the primary key** —
the key stays a UUID, so a reformat never breaks foreign keys.

`beneficiary_identifiers` stores national ID, phone, project ID, group membership ID and
external source IDs, each with `is_trusted` and `retired_at`. Names are never used as a
unique identifier.

`beneficiary_locations` (time-bounded, `is_primary`), `beneficiary_value_chains`,
`farmer_groups`, `farmer_group_members`.

`duplicate_candidates` queues matches for review; `beneficiary_merges` is the immutable
merge history, storing a full JSON snapshot of the merged record and its retired
identifiers. Merged records are retained with `status = 'merged'` and `merged_into_id`.

## `project_delivery`, `production`, `monitoring`

- `project_delivery`: `activities`, `activity_participants`, `training_events`,
  `training_attendance`, `input_distributions`, `equipment_distributions`,
  `infrastructure_assets`.
- `production`: `farms`, `farm_plots`, `production_records`, `harvest_records`,
  `sales_records`.
- `monitoring`: `indicators` (code, definition, calculation method and reference,
  calculation version, unit, result level, frequency, responsible unit, primary source,
  active flag), `indicator_disaggregations`, `indicator_targets`,
  `indicator_observations`.

Every core fact table carries `source_import_job_id`, which is what makes a dashboard
number traceable to its file.

## `analytics`

Views over published data only, plus `analytics_refresh_log`. See
`analytics-and-api.md`.

## Indexes and constraints

Indexed: all foreign keys, all `code` columns (unique), reporting period, district, value
chain, dataset, import job, `source_import_job_id` on every core table, checksum, row hash,
validation severity/resolution, and a partial index on live publications.

Constraints kept deliberately practical: geography below district is nullable, quantities
are `Decimal` with domain-appropriate precision, and dimensions the dashboard aggregates
by (district, value chain, period) are stored as direct foreign keys rather than being
normalised behind extra joins.

## Migrations

| Migration | Contents |
| --- | --- |
| `20260906173023_init_avdp_data_platform` | All schemas, enums, tables, indexes |
| `20260906173500_analytics_views` | Analytics views and supporting indexes; ships with `down.sql` |

Migrations are forward-compatible; the views migration is fully reversible.

## Seeds

`prisma/seed.ts` writes reference data only: permissions and roles, an initial
administrator, Sierra Leone's 16 districts, 8 value chains, 7 units of measure, quarterly
and annual reporting periods for the current and previous year, 7 AVDP indicators, and
controlled lookup aliases.

`prisma/seed-dev-fixtures.ts` (guarded by `SEED_DEV_FIXTURES=true`) adds sample data
sources, datasets and indicator targets. **No fictitious production data is written by any
migration or by the default seed path.**
