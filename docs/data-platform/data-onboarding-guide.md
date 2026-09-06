# Data Onboarding Guide (Phase 14)

**Do not mass-import data whose schema and ownership are unknown.** Every dataset is
onboarded one at a time, through the eleven steps below. A dataset is only "live" when its
figures appear on the dashboard through a published, validated import.

## Onboarding status

| Status | Meaning |
| --- | --- |
| `discovered` | The dataset is known to exist and has been listed in the inventory |
| `assessed` | Owner, schema, coverage and quality issues are documented |
| `mapped` | Columns are mapped to canonical AVDP fields and a template is saved |
| `tested` | A sample import has been run and its findings reviewed |
| `validated` | A full import passes validation with no unresolved errors |
| `approved` | The M&E Approver has approved the import |
| `live` | Published, feeding the analytics layer and the dashboard |

Both `data_sources` and `datasets` carry this status, and it is visible in the Data
Manager.

## The eleven steps

**1. Register the source.** Data Manager → Data Sources → Register data source. Record the
owning unit, responsible officer, type, connection type, frequency, classification and
whether it contains personal data. Metadata only — no file is uploaded here.

**2. Register the dataset.** One dataset per distinct file shape. Choose the domain
(`beneficiaries`, `training`, `production`, `infrastructure`, …) — the domain determines
which canonical fields are offered and what the publication step writes.

**3. Upload a sample.** Imports → New import. Use a representative extract, not the full
history. The file is checksummed, stored outside the web root, parsed and profiled.
Re-uploading an identical file for the same dataset and period is rejected as a duplicate.

**4. Profile the columns.** The Import Details screen shows each column's detected type,
null count, completeness, distinct values, sample values and any duplicate rows. **Profiling
never modifies source data.** If the profile does not match expectations, go back to the
data owner — do not adjust the file by hand.

**5. Map fields.** The mapping grid pre-fills from an existing template, or from
name-based suggestions. Set the canonical field for each column and mark the required ones.
Save the mapping as a template so the next period's file maps itself.

Common mappings:

| External column | Canonical field |
| --- | --- |
| `farmer_name`, `beneficiary_name` | `beneficiary.full_name` |
| `sex`, `gender` | `beneficiary.sex` |
| `district_name`, `district` | `geography.district` |
| `chiefdom` | `geography.chiefdom` |
| `crop`, `commodity`, `value_chain` | `value_chain.name` |
| `nin`, `national_id` | `beneficiary.national_id` |
| `area`, `hectares` | `production.cultivated_area_ha` |

**6. Configure validation.** Baseline rules apply automatically. Add dataset-specific rules
for anything the baseline does not cover — every rule is declarative configuration, never
code. Add controlled lookup aliases for spellings that recur (`BO DISTRICT → Bo`).

**7. Test import.** Press Validate. Review the findings by severity. Errors block
publication; warnings need a review decision.

**8. Review quality.** Resolve each finding with a recorded decision:
`corrected_at_source`, `accepted_with_warning`, `not_an_issue` or `record_excluded`.
Resolving records the decision — it does **not** rewrite the raw value. Where the data is
genuinely wrong, correct it in the source system and re-import.

**9. Approve.** Submit for Review, then have the M&E Approver approve. Both actions are
blocked while error-severity findings remain unresolved, and both are audited.

**10. Publish.** Publication is the only step that writes to the core data layer. It
materialises valid rows, resolves beneficiary identity (deterministic matches link;
probable matches queue for review), creates a publication record, supersedes the previous
publication for that dataset and period, and refreshes the analytics layer.

**11. Connect to an indicator.** Set the indicator's calculation reference (for example
`beneficiaries.total`) and its target for the period. The dashboard KPI then references
`AVDP-OUT-001` rather than a number embedded in frontend code, and the "About this
indicator" panel shows the lineage.

## Bulk registration of known sources

Register many known sources from the inventory CSV without importing any of their data:

```bash
npx tsx scripts/register-sources.ts docs/data-platform/source-inventory-template.csv
# add --commit to write; without it the script only reports what it would do
```

The script creates sources and datasets at status `discovered`. It never uploads,
validates or publishes anything.

## What not to do

- Do not edit raw imported rows. Correct at source and re-import.
- Do not resolve an error finding just to unblock publication.
- Do not merge probable duplicates without reviewing the evidence.
- Do not import a dataset whose owner is unknown.
- Do not switch `DATA_MODE=live` until the dashboard's indicators are backed by published
  data. Mock mode is the correct state until then.
