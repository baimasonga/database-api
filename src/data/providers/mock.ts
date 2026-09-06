import type {
  DashboardDataProvider,
  DashboardFilterInput,
  DashboardSummary,
  DistrictSummary,
  Envelope,
  IndicatorLineage,
  IndicatorPerformance,
  InfrastructureSummary,
  ProductionSummary,
  TrainingSummary,
  ValueChainSummary,
} from "@/data/types";
import {
  MOCK_DISTRICTS,
  MOCK_INDICATORS,
  MOCK_INFRASTRUCTURE,
  MOCK_LAST_UPDATED,
  MOCK_PRODUCTION,
  MOCK_REPORTING_PERIOD,
  MOCK_SUMMARY,
  MOCK_TRAINING,
  MOCK_VALUE_CHAINS,
  mockLineage,
} from "@/data/mock/fixtures";

function envelope<T>(data: T, filters?: DashboardFilterInput): Envelope<T> {
  return {
    data,
    meta: {
      lastUpdated: MOCK_LAST_UPDATED,
      reportingPeriod: filters?.reportingPeriod ?? MOCK_REPORTING_PERIOD,
      source: "mock",
    },
  };
}

/** Serves the retained prototype fixtures. Behaviour is unchanged from the
 *  prototype: filters narrow the fixture set but never fabricate new values. */
export class MockDashboardDataProvider implements DashboardDataProvider {
  readonly mode = "mock" as const;

  private districts(filters?: DashboardFilterInput): DistrictSummary[] {
    if (!filters?.district) return MOCK_DISTRICTS;
    const needle = filters.district.toLowerCase();
    return MOCK_DISTRICTS.filter((d) => d.name.toLowerCase() === needle || d.code.toLowerCase() === needle);
  }

  private valueChains(filters?: DashboardFilterInput): ValueChainSummary[] {
    if (!filters?.valueChain) return MOCK_VALUE_CHAINS;
    const needle = filters.valueChain.toLowerCase();
    return MOCK_VALUE_CHAINS.filter((v) => v.name.toLowerCase() === needle || v.code.toLowerCase() === needle);
  }

  async getDashboardSummary(filters?: DashboardFilterInput): Promise<Envelope<DashboardSummary>> {
    if (!filters?.district && !filters?.valueChain) return envelope(MOCK_SUMMARY, filters);

    const districts = this.districts(filters);
    const valueChains = this.valueChains(filters);
    const beneficiaries = filters.district
      ? districts.reduce((sum, d) => sum + d.beneficiaries, 0)
      : valueChains.reduce((sum, v) => sum + v.beneficiaries, 0);
    const female = filters.district ? districts.reduce((sum, d) => sum + d.female, 0) : Math.round(beneficiaries * 0.5);

    return envelope(
      {
        ...MOCK_SUMMARY,
        beneficiaries: {
          total: beneficiaries,
          female,
          male: beneficiaries - female,
          youth: Math.round(beneficiaries * 0.32),
          femaleSharePercent: beneficiaries === 0 ? 0 : Math.round((female / beneficiaries) * 1000) / 10,
          districtsCovered: districts.length,
        },
        training: {
          ...MOCK_SUMMARY.training,
          participantsTrained: districts.reduce((sum, d) => sum + d.participantsTrained, 0),
        },
        production: {
          totalAreaHa: valueChains.reduce((sum, v) => sum + v.areaHa, 0),
          totalQuantity: valueChains.reduce((sum, v) => sum + v.quantity, 0),
          avgYieldPerHa: MOCK_SUMMARY.production.avgYieldPerHa,
        },
        infrastructure: {
          ...MOCK_SUMMARY.infrastructure,
          assetCount: districts.reduce((sum, d) => sum + d.infrastructureAssets, 0),
        },
      },
      filters,
    );
  }

  async getIndicatorPerformance(filters?: DashboardFilterInput): Promise<Envelope<IndicatorPerformance[]>> {
    return envelope(MOCK_INDICATORS, filters);
  }

  async getDistrictSummary(filters?: DashboardFilterInput): Promise<Envelope<DistrictSummary[]>> {
    return envelope(this.districts(filters), filters);
  }

  async getValueChainSummary(filters?: DashboardFilterInput): Promise<Envelope<ValueChainSummary[]>> {
    return envelope(this.valueChains(filters), filters);
  }

  async getTrainingSummary(filters?: DashboardFilterInput): Promise<Envelope<TrainingSummary>> {
    return envelope(MOCK_TRAINING, filters);
  }

  async getProductionSummary(filters?: DashboardFilterInput): Promise<Envelope<ProductionSummary>> {
    return envelope(MOCK_PRODUCTION, filters);
  }

  async getInfrastructureSummary(filters?: DashboardFilterInput): Promise<Envelope<InfrastructureSummary>> {
    return envelope(MOCK_INFRASTRUCTURE, filters);
  }

  async getIndicatorLineage(code: string, filters?: DashboardFilterInput): Promise<Envelope<IndicatorLineage | null>> {
    return envelope(mockLineage(code), filters);
  }
}
