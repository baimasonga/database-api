import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { DashboardFilters } from "@/lib/api/filters";

/**
 * Read model over the analytics schema. Every query below is parameterised —
 * no filter value is ever interpolated into SQL text.
 */

export interface ResolvedFilters {
  reportingPeriodId: string | null;
  reportingPeriodCode: string | null;
  districtId: string | null;
  valueChainId: string | null;
  sex: string | null;
}

export async function resolveFilters(filters: DashboardFilters): Promise<ResolvedFilters> {
  const [period, district, valueChain] = await Promise.all([
    filters.reporting_period
      ? prisma.reportingPeriod.findFirst({ where: { code: { equals: filters.reporting_period, mode: "insensitive" } } })
      : prisma.reportingPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } }),
    filters.district
      ? prisma.district.findFirst({
          where: {
            OR: [
              { code: { equals: filters.district, mode: "insensitive" } },
              { name: { equals: filters.district, mode: "insensitive" } },
            ],
          },
        })
      : null,
    filters.value_chain
      ? prisma.valueChain.findFirst({
          where: {
            OR: [
              { code: { equals: filters.value_chain, mode: "insensitive" } },
              { name: { equals: filters.value_chain, mode: "insensitive" } },
            ],
          },
        })
      : null,
  ]);

  return {
    reportingPeriodId: period?.id ?? null,
    reportingPeriodCode: period?.code ?? null,
    districtId: district?.id ?? null,
    valueChainId: valueChain?.id ?? null,
    sex: filters.sex ?? null,
  };
}

function n(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === "bigint") return Number(value);
  if (value instanceof Prisma.Decimal) return value.toNumber();
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export interface BeneficiarySummary {
  total_beneficiaries: number;
  female_count: number;
  male_count: number;
  youth_count: number;
  disability_count: number;
  districts_covered: number;
  female_share_percent: number;
  last_published_at: string | null;
}

export async function getBeneficiarySummary(f: ResolvedFilters): Promise<BeneficiarySummary> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT
      COUNT(*)::bigint                                     AS total_beneficiaries,
      COUNT(*) FILTER (WHERE pb.sex = 'female')::bigint    AS female_count,
      COUNT(*) FILTER (WHERE pb.sex = 'male')::bigint      AS male_count,
      COUNT(*) FILTER (WHERE pb.is_youth IS TRUE)::bigint  AS youth_count,
      COUNT(*) FILTER (WHERE pb.disability IS TRUE)::bigint AS disability_count,
      COUNT(DISTINCT pb.district_id)::bigint               AS districts_covered,
      MAX(pb.published_at)                                 AS last_published_at
    FROM analytics.published_beneficiaries pb
    LEFT JOIN beneficiaries.beneficiary_value_chains bvc ON bvc.beneficiary_id = pb.id
    WHERE (${f.reportingPeriodId}::uuid IS NULL OR pb.reporting_period_id = ${f.reportingPeriodId}::uuid)
      AND (${f.districtId}::uuid IS NULL OR pb.district_id = ${f.districtId}::uuid)
      AND (${f.valueChainId}::uuid IS NULL OR bvc.value_chain_id = ${f.valueChainId}::uuid)
      AND (${f.sex}::text IS NULL OR pb.sex::text = ${f.sex}::text)
  `;
  const row = rows[0] ?? {};
  const total = n(row.total_beneficiaries);
  const female = n(row.female_count);
  return {
    total_beneficiaries: total,
    female_count: female,
    male_count: n(row.male_count),
    youth_count: n(row.youth_count),
    disability_count: n(row.disability_count),
    districts_covered: n(row.districts_covered),
    female_share_percent: total === 0 ? 0 : Math.round((female / total) * 1000) / 10,
    last_published_at: row.last_published_at ? new Date(row.last_published_at as string).toISOString() : null,
  };
}

export interface DistrictRow {
  district_id: string;
  district_code: string;
  district_name: string;
  latitude: number | null;
  longitude: number | null;
  total_beneficiaries: number;
  female_count: number;
  total_area_ha: number;
  participants_trained: number;
  infrastructure_assets: number;
}

export async function getDistrictSummaries(f: ResolvedFilters): Promise<DistrictRow[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT g.district_id, g.district_code, g.district_name, g.latitude, g.longitude,
           COALESCE(g.total_beneficiaries, 0)   AS total_beneficiaries,
           COALESCE(g.female_count, 0)          AS female_count,
           COALESCE(g.total_area_ha, 0)         AS total_area_ha,
           COALESCE(g.participants_trained, 0)  AS participants_trained,
           COALESCE(g.infrastructure_assets, 0) AS infrastructure_assets
    FROM analytics.analytics_geographic_summary g
    WHERE (${f.reportingPeriodId}::uuid IS NULL OR g.reporting_period_id = ${f.reportingPeriodId}::uuid OR g.reporting_period_id IS NULL)
      AND (${f.districtId}::uuid IS NULL OR g.district_id = ${f.districtId}::uuid)
    ORDER BY g.district_name
  `;
  return rows.map((r) => ({
    district_id: String(r.district_id),
    district_code: String(r.district_code),
    district_name: String(r.district_name),
    latitude: r.latitude === null ? null : n(r.latitude),
    longitude: r.longitude === null ? null : n(r.longitude),
    total_beneficiaries: n(r.total_beneficiaries),
    female_count: n(r.female_count),
    total_area_ha: n(r.total_area_ha),
    participants_trained: n(r.participants_trained),
    infrastructure_assets: n(r.infrastructure_assets),
  }));
}

export interface ValueChainRow {
  value_chain_id: string;
  value_chain_code: string;
  value_chain_name: string;
  total_beneficiaries: number;
  total_area_ha: number;
  total_quantity: number;
  avg_yield_per_ha: number | null;
  participants_trained: number;
}

export async function getValueChainSummaries(f: ResolvedFilters): Promise<ValueChainRow[]> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT v.value_chain_id, v.value_chain_code, v.value_chain_name,
           COALESCE(v.total_beneficiaries, 0)  AS total_beneficiaries,
           COALESCE(v.total_area_ha, 0)        AS total_area_ha,
           COALESCE(v.total_quantity, 0)       AS total_quantity,
           v.avg_yield_per_ha,
           COALESCE(v.participants_trained, 0) AS participants_trained
    FROM analytics.analytics_value_chain_summary v
    WHERE (${f.reportingPeriodId}::uuid IS NULL OR v.reporting_period_id = ${f.reportingPeriodId}::uuid OR v.reporting_period_id IS NULL)
      AND (${f.valueChainId}::uuid IS NULL OR v.value_chain_id = ${f.valueChainId}::uuid)
    ORDER BY v.value_chain_name
  `;
  return rows.map((r) => ({
    value_chain_id: String(r.value_chain_id),
    value_chain_code: String(r.value_chain_code),
    value_chain_name: String(r.value_chain_name),
    total_beneficiaries: n(r.total_beneficiaries),
    total_area_ha: n(r.total_area_ha),
    total_quantity: n(r.total_quantity),
    avg_yield_per_ha: r.avg_yield_per_ha === null ? null : n(r.avg_yield_per_ha),
    participants_trained: n(r.participants_trained),
  }));
}

export interface TrainingSummary {
  training_events: number;
  participants_trained: number;
  unique_participants: number;
  certified_count: number;
  total_training_days: number;
}

export async function getTrainingSummary(f: ResolvedFilters): Promise<TrainingSummary> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT COALESCE(SUM(training_events), 0)      AS training_events,
           COALESCE(SUM(participants_trained), 0) AS participants_trained,
           COALESCE(SUM(unique_participants), 0)  AS unique_participants,
           COALESCE(SUM(certified_count), 0)      AS certified_count,
           COALESCE(SUM(total_training_days), 0)  AS total_training_days
    FROM analytics.analytics_training_summary t
    WHERE (${f.reportingPeriodId}::uuid IS NULL OR t.reporting_period_id = ${f.reportingPeriodId}::uuid)
      AND (${f.districtId}::uuid IS NULL OR t.district_id = ${f.districtId}::uuid)
      AND (${f.valueChainId}::uuid IS NULL OR t.value_chain_id = ${f.valueChainId}::uuid)
  `;
  const r = rows[0] ?? {};
  return {
    training_events: n(r.training_events),
    participants_trained: n(r.participants_trained),
    unique_participants: n(r.unique_participants),
    certified_count: n(r.certified_count),
    total_training_days: n(r.total_training_days),
  };
}

export interface ProductionSummary {
  production_records: number;
  total_area_ha: number;
  total_quantity: number;
  avg_yield_per_ha: number | null;
  producing_beneficiaries: number;
}

export async function getProductionSummary(f: ResolvedFilters): Promise<ProductionSummary> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT COALESCE(SUM(production_records), 0)      AS production_records,
           COALESCE(SUM(total_area_ha), 0)           AS total_area_ha,
           COALESCE(SUM(total_quantity), 0)          AS total_quantity,
           COALESCE(SUM(producing_beneficiaries), 0) AS producing_beneficiaries,
           CASE WHEN SUM(total_area_ha) > 0 THEN SUM(total_quantity)/SUM(total_area_ha) END AS avg_yield_per_ha
    FROM analytics.analytics_production_summary p
    WHERE (${f.reportingPeriodId}::uuid IS NULL OR p.reporting_period_id = ${f.reportingPeriodId}::uuid)
      AND (${f.districtId}::uuid IS NULL OR p.district_id = ${f.districtId}::uuid)
      AND (${f.valueChainId}::uuid IS NULL OR p.value_chain_id = ${f.valueChainId}::uuid)
  `;
  const r = rows[0] ?? {};
  return {
    production_records: n(r.production_records),
    total_area_ha: n(r.total_area_ha),
    total_quantity: n(r.total_quantity),
    avg_yield_per_ha: r.avg_yield_per_ha === null || r.avg_yield_per_ha === undefined ? null : n(r.avg_yield_per_ha),
    producing_beneficiaries: n(r.producing_beneficiaries),
  };
}

export interface InfrastructureSummary {
  asset_count: number;
  completed_count: number;
  ongoing_count: number;
  beneficiaries_served: number;
  by_type: Array<{ asset_type: string; asset_count: number; completed_count: number }>;
}

export async function getInfrastructureSummary(f: ResolvedFilters): Promise<InfrastructureSummary> {
  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT i.asset_type,
           COALESCE(SUM(i.asset_count), 0)           AS asset_count,
           COALESCE(SUM(i.completed_count), 0)       AS completed_count,
           COALESCE(SUM(i.ongoing_count), 0)         AS ongoing_count,
           COALESCE(SUM(i.beneficiaries_served), 0)  AS beneficiaries_served
    FROM analytics.analytics_infrastructure_summary i
    WHERE (${f.reportingPeriodId}::uuid IS NULL OR i.reporting_period_id = ${f.reportingPeriodId}::uuid)
      AND (${f.districtId}::uuid IS NULL OR i.district_id = ${f.districtId}::uuid)
    GROUP BY i.asset_type
    ORDER BY i.asset_type
  `;
  const byType = rows.map((r) => ({
    asset_type: String(r.asset_type),
    asset_count: n(r.asset_count),
    completed_count: n(r.completed_count),
  }));
  return {
    asset_count: rows.reduce((sum, r) => sum + n(r.asset_count), 0),
    completed_count: rows.reduce((sum, r) => sum + n(r.completed_count), 0),
    ongoing_count: rows.reduce((sum, r) => sum + n(r.ongoing_count), 0),
    beneficiaries_served: rows.reduce((sum, r) => sum + n(r.beneficiaries_served), 0),
    by_type: byType,
  };
}

export interface IndicatorPerformanceRow {
  indicator_id: string;
  indicator_code: string;
  indicator_name: string;
  unit: string | null;
  result_level: string;
  calculation_version: number;
  actual_value: number;
  target_value: number | null;
  achievement_percent: number | null;
  last_calculated_at: string | null;
}

/**
 * Declarative calculation references. Indicator actuals are computed from the
 * analytics layer rather than stored row by row; only indicators without a
 * recognised reference fall back to manually recorded observations.
 */
const CALCULATION_REFS = [
  "beneficiaries.total",
  "beneficiaries.female",
  "beneficiaries.male",
  "beneficiaries.youth",
  "training.participants",
  "training.events",
  "production.area",
  "production.quantity",
  "infrastructure.assets",
] as const;

export type CalculationRef = (typeof CALCULATION_REFS)[number];

export function isCalculationRef(value: string | null): value is CalculationRef {
  return value !== null && (CALCULATION_REFS as readonly string[]).includes(value);
}

async function computeActuals(f: ResolvedFilters): Promise<Record<CalculationRef, number>> {
  const [beneficiaries, training, production, infrastructure] = await Promise.all([
    getBeneficiarySummary(f),
    getTrainingSummary(f),
    getProductionSummary(f),
    getInfrastructureSummary(f),
  ]);
  return {
    "beneficiaries.total": beneficiaries.total_beneficiaries,
    "beneficiaries.female": beneficiaries.female_count,
    "beneficiaries.male": beneficiaries.male_count,
    "beneficiaries.youth": beneficiaries.youth_count,
    "training.participants": training.participants_trained,
    "training.events": training.training_events,
    "production.area": production.total_area_ha,
    "production.quantity": production.total_quantity,
    "infrastructure.assets": infrastructure.asset_count,
  };
}

/** Manually recorded observations, for indicators with no calculation reference. */
async function getObservedValues(f: ResolvedFilters, code?: string) {
  return prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT indicator_code,
           SUM(actual_value)        AS actual_value,
           MAX(last_calculated_at)  AS last_calculated_at
    FROM analytics.analytics_indicator_performance p
    WHERE (${f.reportingPeriodId}::uuid IS NULL OR p.reporting_period_id = ${f.reportingPeriodId}::uuid)
      AND (${f.districtId}::uuid IS NULL OR p.district_id = ${f.districtId}::uuid OR p.district_id IS NULL)
      AND (${f.valueChainId}::uuid IS NULL OR p.value_chain_id = ${f.valueChainId}::uuid OR p.value_chain_id IS NULL)
      AND (${code ?? null}::text IS NULL OR p.indicator_code = ${code ?? null}::text)
    GROUP BY indicator_code
  `;
}

export async function getIndicatorPerformance(
  f: ResolvedFilters,
  code?: string,
): Promise<IndicatorPerformanceRow[]> {
  const indicators = await prisma.indicator.findMany({
    where: { isActive: true, ...(code ? { code } : {}) },
    orderBy: { code: "asc" },
    include: {
      targets: {
        where: {
          ...(f.reportingPeriodId ? { OR: [{ reportingPeriodId: f.reportingPeriodId }, { reportingPeriodId: null }] } : {}),
          ...(f.districtId ? { OR: [{ districtId: f.districtId }, { districtId: null }] } : { districtId: null }),
          ...(f.valueChainId ? { OR: [{ valueChainId: f.valueChainId }, { valueChainId: null }] } : { valueChainId: null }),
        },
      },
    },
  });
  if (indicators.length === 0) return [];

  const [actuals, observed, publishedAt] = await Promise.all([
    computeActuals(f),
    getObservedValues(f, code),
    prisma.publicationRecord.findFirst({
      where: { status: "published", ...(f.reportingPeriodId ? { reportingPeriodId: f.reportingPeriodId } : {}) },
      orderBy: { publishedAt: "desc" },
      select: { publishedAt: true },
    }),
  ]);
  const observedByCode = new Map(observed.map((row) => [String(row.indicator_code), row]));

  return indicators.map((indicator) => {
    const observation = observedByCode.get(indicator.code);
    const actual = isCalculationRef(indicator.calculationRef)
      ? actuals[indicator.calculationRef]
      : n(observation?.actual_value);
    // The most specific matching target wins over a global one.
    const target = indicator.targets
      .slice()
      .sort((a, b) => Number(!!b.districtId) + Number(!!b.valueChainId) - (Number(!!a.districtId) + Number(!!a.valueChainId)))
      .at(0);
    const targetValue = target ? Number(target.targetValue) : null;
    const lastCalculated = observation?.last_calculated_at
      ? new Date(observation.last_calculated_at as string)
      : (publishedAt?.publishedAt ?? null);

    return {
      indicator_id: indicator.id,
      indicator_code: indicator.code,
      indicator_name: indicator.name,
      unit: indicator.unit,
      result_level: indicator.resultLevel,
      calculation_version: indicator.calculationVersion,
      actual_value: actual,
      target_value: targetValue,
      achievement_percent: targetValue && targetValue > 0 ? Math.round((actual / targetValue) * 1000) / 10 : null,
      last_calculated_at: lastCalculated ? lastCalculated.toISOString() : null,
    };
  });
}
