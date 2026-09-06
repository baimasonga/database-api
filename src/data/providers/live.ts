import {
  DashboardDataUnavailable,
  type DashboardDataProvider,
  type DashboardFilterInput,
  type DashboardSummary,
  type DistrictSummary,
  type Envelope,
  type IndicatorLineage,
  type IndicatorPerformance,
  type InfrastructureSummary,
  type ProductionSummary,
  type TrainingSummary,
  type ValueChainSummary,
} from "@/data/types";

interface ApiResponse<T> {
  data: T;
  metadata: { last_updated: string | null; reporting_period: string | null };
}

/**
 * Consumes /api/v1. API failures surface as DashboardDataUnavailable so the UI
 * can show an explicit "data temporarily unavailable" state — live mode never
 * falls back to fictitious values.
 */
export class LiveDashboardDataProvider implements DashboardDataProvider {
  readonly mode = "live" as const;

  constructor(private readonly baseUrl: string) {}

  private query(filters?: DashboardFilterInput): string {
    const params = new URLSearchParams();
    if (filters?.reportingPeriod) params.set("reporting_period", filters.reportingPeriod);
    if (filters?.district) params.set("district", filters.district);
    if (filters?.valueChain) params.set("value_chain", filters.valueChain);
    if (filters?.sex) params.set("sex", filters.sex);
    const qs = params.toString();
    return qs ? `?${qs}` : "";
  }

  private async get<T>(path: string, filters?: DashboardFilterInput): Promise<Envelope<T>> {
    const endpoint = `${this.baseUrl}/api/v1${path}${this.query(filters)}`;
    let response: Response;
    try {
      response = await fetch(endpoint, { headers: { accept: "application/json" }, cache: "no-store" });
    } catch (error) {
      throw new DashboardDataUnavailable(
        error instanceof Error ? error.message : "Network error contacting the AVDP dashboard API.",
        endpoint,
      );
    }
    if (!response.ok) {
      throw new DashboardDataUnavailable(
        `The AVDP dashboard API returned ${response.status}.`,
        endpoint,
        response.status,
      );
    }
    const body = (await response.json()) as ApiResponse<T>;
    return {
      data: body.data,
      meta: {
        lastUpdated: body.metadata?.last_updated ?? null,
        reportingPeriod: body.metadata?.reporting_period ?? null,
        source: "analytics",
      },
    };
  }

  getDashboardSummary(filters?: DashboardFilterInput) {
    return this.get<DashboardSummary>("/dashboard/summary", filters);
  }
  getIndicatorPerformance(filters?: DashboardFilterInput) {
    return this.get<IndicatorPerformance[]>("/indicators", filters);
  }
  getDistrictSummary(filters?: DashboardFilterInput) {
    return this.get<DistrictSummary[]>("/geography/districts", filters);
  }
  getValueChainSummary(filters?: DashboardFilterInput) {
    return this.get<ValueChainSummary[]>("/value-chains", filters);
  }
  getTrainingSummary(filters?: DashboardFilterInput) {
    return this.get<TrainingSummary>("/training/summary", filters);
  }
  getProductionSummary(filters?: DashboardFilterInput) {
    return this.get<ProductionSummary>("/production/summary", filters);
  }
  getInfrastructureSummary(filters?: DashboardFilterInput) {
    return this.get<InfrastructureSummary>("/infrastructure/summary", filters);
  }
  getIndicatorLineage(code: string, filters?: DashboardFilterInput) {
    return this.get<IndicatorLineage | null>(`/indicators/${encodeURIComponent(code)}/lineage`, filters);
  }
}
