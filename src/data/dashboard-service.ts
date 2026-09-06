import "server-only";
import { getDashboardProvider } from "./index";
import {
  DashboardDataUnavailable,
  type DashboardFilterInput,
  type DashboardSummary,
  type DataMeta,
  type DistrictSummary,
  type Envelope,
  type IndicatorLineage,
  type IndicatorPerformance,
  type InfrastructureSummary,
  type ProductionSummary,
  type TrainingSummary,
  type ValueChainSummary,
} from "./types";

/**
 * The dashboard service layer.
 *
 * Every dashboard section loads its data through this module, so fetching,
 * error handling and empty detection exist in exactly one place. Visual
 * components receive a already-resolved SectionResult and render one of four
 * states — they never call a provider, catch an error, or know the data mode.
 */

export type SectionResult<T> =
  | { status: "ok"; data: T; meta: DataMeta }
  /** The request succeeded, but no published data matches the filters. */
  | { status: "empty"; meta: DataMeta }
  /** Live mode could not reach the API. Never substituted with fixtures. */
  | { status: "unavailable"; message: string; endpoint: string | null };

/**
 * Runs one provider call and classifies the outcome.
 *
 * A DashboardDataUnavailable becomes an "unavailable" result rather than
 * propagating, so one failing section cannot blank the whole dashboard. Any
 * other error is a genuine defect and is rethrown.
 */
async function load<T>(
  fetcher: () => Promise<Envelope<T>>,
  isEmpty: (data: T) => boolean,
): Promise<SectionResult<T>> {
  try {
    const envelope = await fetcher();
    if (isEmpty(envelope.data)) return { status: "empty", meta: envelope.meta };
    return { status: "ok", data: envelope.data, meta: envelope.meta };
  } catch (error) {
    if (error instanceof DashboardDataUnavailable) {
      return { status: "unavailable", message: error.message, endpoint: error.endpoint };
    }
    throw error;
  }
}

/**
 * A summary is empty when nothing has been published for the filters — every
 * headline measure is zero. Rendering zeros without saying so would imply the
 * project delivered nothing, rather than that no data has been published yet.
 */
export function isSummaryEmpty(summary: DashboardSummary): boolean {
  return (
    summary.beneficiaries.total === 0 &&
    summary.training.participantsTrained === 0 &&
    summary.training.trainingEvents === 0 &&
    summary.production.totalAreaHa === 0 &&
    summary.production.totalQuantity === 0 &&
    summary.infrastructure.assetCount === 0
  );
}

export function loadDashboardSummary(filters: DashboardFilterInput): Promise<SectionResult<DashboardSummary>> {
  return load(() => getDashboardProvider().getDashboardSummary(filters), isSummaryEmpty);
}

export function loadIndicatorPerformance(
  filters: DashboardFilterInput,
): Promise<SectionResult<IndicatorPerformance[]>> {
  // An indicator registry with no actuals anywhere is an empty section, not a
  // list of zeros.
  return load(
    () => getDashboardProvider().getIndicatorPerformance(filters),
    (rows) => rows.length === 0 || rows.every((row) => row.actual === 0),
  );
}

export function loadDistrictSummary(filters: DashboardFilterInput): Promise<SectionResult<DistrictSummary[]>> {
  return load(
    () => getDashboardProvider().getDistrictSummary(filters),
    (rows) => rows.length === 0 || rows.every((row) => row.beneficiaries === 0),
  );
}

export function loadValueChainSummary(filters: DashboardFilterInput): Promise<SectionResult<ValueChainSummary[]>> {
  return load(
    () => getDashboardProvider().getValueChainSummary(filters),
    (rows) => rows.length === 0 || rows.every((row) => row.beneficiaries === 0),
  );
}

export function loadTrainingSummary(filters: DashboardFilterInput): Promise<SectionResult<TrainingSummary>> {
  return load(
    () => getDashboardProvider().getTrainingSummary(filters),
    (data) => data.trainingEvents === 0 && data.participantsTrained === 0,
  );
}

export function loadProductionSummary(filters: DashboardFilterInput): Promise<SectionResult<ProductionSummary>> {
  return load(
    () => getDashboardProvider().getProductionSummary(filters),
    (data) => data.records === 0 && data.totalAreaHa === 0 && data.totalQuantity === 0,
  );
}

export function loadInfrastructureSummary(
  filters: DashboardFilterInput,
): Promise<SectionResult<InfrastructureSummary>> {
  return load(
    () => getDashboardProvider().getInfrastructureSummary(filters),
    (data) => data.assetCount === 0 && data.byType.length === 0,
  );
}

/**
 * Lineage is supplementary context on a KPI. Its absence must never degrade the
 * figure it annotates, so failures resolve to null instead of a section state.
 */
export async function loadIndicatorLineage(
  code: string,
  filters: DashboardFilterInput,
): Promise<IndicatorLineage | null> {
  try {
    const envelope = await getDashboardProvider().getIndicatorLineage(code, filters);
    return envelope.data;
  } catch {
    return null;
  }
}

export async function loadLineageFor(
  codes: string[],
  filters: DashboardFilterInput,
): Promise<Record<string, IndicatorLineage | null>> {
  const entries = await Promise.all(
    codes.map(async (code) => [code, await loadIndicatorLineage(code, filters)] as const),
  );
  return Object.fromEntries(entries);
}

/** Filter options come from the same source as the data they filter. */
export async function loadFilterOptions(filters: DashboardFilterInput) {
  const [districts, valueChains] = await Promise.all([
    loadDistrictSummary({ ...filters, district: undefined }),
    loadValueChainSummary({ ...filters, valueChain: undefined }),
  ]);

  const districtOptions =
    districts.status === "ok" ? districts.data.map((d) => ({ value: d.code, label: d.name })) : [];
  const valueChainOptions =
    valueChains.status === "ok" ? valueChains.data.map((v) => ({ value: v.code, label: v.name })) : [];

  const reference = districts.status === "unavailable" ? null : districts.meta;
  const year = reference?.reportingPeriod
    ? Number.parseInt(reference.reportingPeriod.slice(0, 4), 10)
    : new Date().getUTCFullYear();
  const base = Number.isFinite(year) ? year : new Date().getUTCFullYear();

  return {
    districts: districtOptions,
    valueChains: valueChainOptions,
    periods: [base - 1, base].flatMap((y) => [1, 2, 3, 4].map((q) => ({ value: `${y}-Q${q}`, label: `Q${q} ${y}` }))),
  };
}
