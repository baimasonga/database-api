import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { CalculationRef } from "./queries";

/**
 * Indicator lineage (Phase 15).
 *
 * Traces a dashboard figure back to the datasets that actually produced it:
 *
 *   indicator → calculation reference → core table → source import job
 *             → publication record → dataset → data source
 *
 * Only publications that genuinely contribute are reported. Listing unrelated
 * publications would misrepresent where a number came from, which defeats the
 * purpose of publishing lineage at all.
 *
 * Lineage is dataset-level by design: it never exposes row-level beneficiary
 * information.
 */

/** The core table each calculation reference is materialised into. */
export type LineageDomain = "beneficiaries" | "training" | "production" | "infrastructure";

const DOMAIN_BY_REF: Record<CalculationRef, LineageDomain> = {
  "beneficiaries.total": "beneficiaries",
  "beneficiaries.female": "beneficiaries",
  "beneficiaries.male": "beneficiaries",
  "beneficiaries.youth": "beneficiaries",
  "training.participants": "training",
  "training.events": "training",
  "production.area": "production",
  "production.quantity": "production",
  "infrastructure.assets": "infrastructure",
};

export const DOMAIN_LABELS: Record<LineageDomain, string> = {
  beneficiaries: "Beneficiary records",
  training: "Training records",
  production: "Production records",
  infrastructure: "Infrastructure records",
};

export function domainForCalculationRef(ref: string | null): LineageDomain | null {
  if (!ref) return null;
  return DOMAIN_BY_REF[ref as CalculationRef] ?? null;
}

/**
 * The import jobs that materialised records for a domain. Table names come
 * from this closed mapping, never from user input.
 */
function contributingJobsQuery(domain: LineageDomain, reportingPeriodId: string | null): Prisma.Sql {
  const period = reportingPeriodId;
  switch (domain) {
    case "beneficiaries":
      return Prisma.sql`
        SELECT DISTINCT b.source_import_job_id AS import_job_id
        FROM beneficiaries.beneficiaries b
        WHERE b.source_import_job_id IS NOT NULL
          AND b.status <> 'merged'
          AND (${period}::uuid IS NULL OR b.first_seen_period_id = ${period}::uuid)`;
    case "training":
      return Prisma.sql`
        SELECT DISTINCT t.source_import_job_id AS import_job_id
        FROM project_delivery.training_events t
        WHERE t.source_import_job_id IS NOT NULL
          AND (${period}::uuid IS NULL OR t.reporting_period_id = ${period}::uuid)`;
    case "production":
      return Prisma.sql`
        SELECT DISTINCT p.source_import_job_id AS import_job_id
        FROM production.production_records p
        WHERE p.source_import_job_id IS NOT NULL
          AND (${period}::uuid IS NULL OR p.reporting_period_id = ${period}::uuid)`;
    case "infrastructure":
      return Prisma.sql`
        SELECT DISTINCT i.source_import_job_id AS import_job_id
        FROM project_delivery.infrastructure_assets i
        WHERE i.source_import_job_id IS NOT NULL
          AND (${period}::uuid IS NULL OR i.reporting_period_id = ${period}::uuid)`;
  }
}

export interface ContributingPublication {
  publicationRecordId: string;
  importJobId: string;
  datasetName: string;
  datasetCode: string;
  dataSourceName: string;
  dataSourceCode: string;
  reportingPeriodCode: string;
  publishedAt: Date;
  publishedRowCount: number;
  qualityScore: number | null;
  errorRowCount: number;
  warningRowCount: number;
}

/**
 * Live publications that produced the records behind a domain, most recent
 * first. A publication that has been superseded or withdrawn is excluded, so
 * lineage always describes the data the dashboard is serving now.
 */
export async function contributingPublications(
  domain: LineageDomain,
  reportingPeriodId: string | null,
): Promise<ContributingPublication[]> {
  const jobs = contributingJobsQuery(domain, reportingPeriodId);

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    WITH contributing AS (${jobs})
    SELECT
      p.id                  AS publication_record_id,
      p.import_job_id,
      p.published_at,
      p.published_row_count,
      p.quality_score,
      d.name                AS dataset_name,
      d.code                AS dataset_code,
      s.name                AS data_source_name,
      s.code                AS data_source_code,
      rp.code               AS reporting_period_code,
      j.error_row_count,
      j.warning_row_count
    FROM contributing c
    JOIN governance.publication_records p ON p.import_job_id = c.import_job_id
    JOIN governance.datasets d            ON d.id = p.dataset_id
    JOIN governance.data_sources s        ON s.id = d.data_source_id
    JOIN master_data.reporting_periods rp ON rp.id = p.reporting_period_id
    JOIN governance.import_jobs j         ON j.id = p.import_job_id
    WHERE p.status = 'published'
    ORDER BY p.published_at DESC
  `;

  return rows.map((r) => ({
    publicationRecordId: String(r.publication_record_id),
    importJobId: String(r.import_job_id),
    datasetName: String(r.dataset_name),
    datasetCode: String(r.dataset_code),
    dataSourceName: String(r.data_source_name),
    dataSourceCode: String(r.data_source_code),
    reportingPeriodCode: String(r.reporting_period_code),
    publishedAt: new Date(r.published_at as string),
    publishedRowCount: Number(r.published_row_count ?? 0),
    qualityScore: r.quality_score === null ? null : Number(r.quality_score),
    errorRowCount: Number(r.error_row_count ?? 0),
    warningRowCount: Number(r.warning_row_count ?? 0),
  }));
}

export type DataQualityStatus = "validated" | "warnings" | "unavailable";

/**
 * Quality status of the figure as a whole. Any unresolved warning in a
 * contributing publication downgrades it — a single clean dataset does not
 * make the whole number clean.
 */
export function qualityStatusFor(publications: ContributingPublication[]): DataQualityStatus {
  if (publications.length === 0) return "unavailable";
  return publications.some((p) => p.warningRowCount > 0) ? "warnings" : "validated";
}

export interface IndicatorLineageResult {
  indicator: {
    code: string;
    name: string;
    definition: string | null;
    calculationMethod: string | null;
    calculationRef: string | null;
    calculationVersion: number;
    unit: string | null;
    primaryDataSourceName: string | null;
  };
  domain: LineageDomain | null;
  publications: ContributingPublication[];
  dataSources: string[];
  qualityStatus: DataQualityStatus;
  lastUpdated: Date | null;
}

/**
 * Full lineage for one indicator. Returns null when the indicator is not
 * registered; an indicator with no contributing publications returns an empty
 * publication list and `unavailable` status rather than borrowed provenance.
 */
export async function indicatorLineage(
  code: string,
  reportingPeriodId: string | null,
): Promise<IndicatorLineageResult | null> {
  const indicator = await prisma.indicator.findUnique({
    where: { code },
    include: { primaryDataSource: { select: { name: true } } },
  });
  if (!indicator) return null;

  const domain = domainForCalculationRef(indicator.calculationRef);
  const publications = domain ? await contributingPublications(domain, reportingPeriodId) : [];

  return {
    indicator: {
      code: indicator.code,
      name: indicator.name,
      definition: indicator.definition,
      calculationMethod: indicator.calculationMethod,
      calculationRef: indicator.calculationRef,
      calculationVersion: indicator.calculationVersion,
      unit: indicator.unit,
      primaryDataSourceName: indicator.primaryDataSource?.name ?? null,
    },
    domain,
    publications,
    dataSources: [...new Set(publications.map((p) => p.dataSourceName))],
    qualityStatus: qualityStatusFor(publications),
    lastUpdated: publications[0]?.publishedAt ?? null,
  };
}
