/**
 * The dashboard contract. Visual components depend only on these types and on
 * the DashboardDataProvider interface — never on Prisma models, fetch calls or
 * mock fixtures directly.
 */
export interface DashboardFilterInput {
  reportingPeriod?: string;
  district?: string;
  valueChain?: string;
  sex?: "male" | "female" | "other" | "unknown";
}

export interface DataMeta {
  lastUpdated: string | null;
  reportingPeriod: string | null;
  source: "mock" | "analytics";
}

export interface Envelope<T> {
  data: T;
  meta: DataMeta;
}

export interface DashboardSummary {
  beneficiaries: {
    total: number;
    female: number;
    male: number;
    youth: number;
    femaleSharePercent: number;
    districtsCovered: number;
  };
  training: { participantsTrained: number; trainingEvents: number; certified: number };
  production: { totalAreaHa: number; totalQuantity: number; avgYieldPerHa: number | null };
  infrastructure: { assetCount: number; completedCount: number; beneficiariesServed: number };
  headlineIndicators: IndicatorPerformance[];
}

export interface IndicatorPerformance {
  code: string;
  name: string;
  shortName: string | null;
  unit: string | null;
  resultLevel: string;
  actual: number;
  target: number | null;
  achievementPercent: number | null;
  lastUpdated: string | null;
}

export interface DistrictSummary {
  id: string;
  code: string;
  name: string;
  latitude: number | null;
  longitude: number | null;
  beneficiaries: number;
  female: number;
  areaHa: number;
  participantsTrained: number;
  infrastructureAssets: number;
}

export interface ValueChainSummary {
  id: string;
  code: string;
  name: string;
  beneficiaries: number;
  areaHa: number;
  quantity: number;
  avgYieldPerHa: number | null;
  participantsTrained: number;
}

export interface TrainingSummary {
  trainingEvents: number;
  participantsTrained: number;
  uniqueParticipants: number;
  certified: number;
  totalTrainingDays: number;
}

export interface ProductionSummary {
  records: number;
  totalAreaHa: number;
  totalQuantity: number;
  avgYieldPerHa: number | null;
  producingBeneficiaries: number;
}

export interface InfrastructureSummary {
  assetCount: number;
  completedCount: number;
  ongoingCount: number;
  beneficiariesServed: number;
  byType: Array<{ assetType: string; assetCount: number; completedCount: number }>;
}

export interface IndicatorLineage {
  indicatorCode: string;
  indicatorName: string;
  definition: string | null;
  calculationMethod: string | null;
  calculationVersion: number;
  reportingPeriod: string | null;
  lastUpdated: string | null;
  dataQualityStatus: "validated" | "warnings" | "unavailable";
  primaryDataSource: string | null;
  publications: Array<{
    dataset: string;
    dataSource: string;
    reportingPeriod: string;
    publishedAt: string;
    qualityScore: number | null;
  }>;
}

export interface DashboardDataProvider {
  readonly mode: "mock" | "live";
  getDashboardSummary(filters?: DashboardFilterInput): Promise<Envelope<DashboardSummary>>;
  getIndicatorPerformance(filters?: DashboardFilterInput): Promise<Envelope<IndicatorPerformance[]>>;
  getDistrictSummary(filters?: DashboardFilterInput): Promise<Envelope<DistrictSummary[]>>;
  getValueChainSummary(filters?: DashboardFilterInput): Promise<Envelope<ValueChainSummary[]>>;
  getTrainingSummary(filters?: DashboardFilterInput): Promise<Envelope<TrainingSummary>>;
  getProductionSummary(filters?: DashboardFilterInput): Promise<Envelope<ProductionSummary>>;
  getInfrastructureSummary(filters?: DashboardFilterInput): Promise<Envelope<InfrastructureSummary>>;
  getIndicatorLineage(code: string, filters?: DashboardFilterInput): Promise<Envelope<IndicatorLineage | null>>;
}

/** Thrown by the live provider when the API cannot serve a request. */
export class DashboardDataUnavailable extends Error {
  constructor(
    message: string,
    readonly endpoint: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "DashboardDataUnavailable";
  }
}
