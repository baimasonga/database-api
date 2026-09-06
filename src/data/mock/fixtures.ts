/**
 * Fictitious AVDP dashboard fixtures.
 *
 * These are the prototype's illustrative figures. They are retained
 * deliberately: MOCK mode must keep the dashboard fully usable until live
 * AVDP datasets are approved and published. They are never merged with, or
 * substituted for, live data.
 */
import type {
  DashboardSummary,
  DistrictSummary,
  IndicatorLineage,
  IndicatorPerformance,
  InfrastructureSummary,
  ProductionSummary,
  TrainingSummary,
  ValueChainSummary,
} from "@/data/types";

export const MOCK_REPORTING_PERIOD = "2026-Q2";
export const MOCK_LAST_UPDATED = "2026-09-02T00:00:00.000Z";

export const MOCK_INDICATORS: IndicatorPerformance[] = [
  { code: "AVDP-OUT-001", name: "Farmers reached with AVDP support", shortName: "Farmers Reached", unit: "farmers", resultLevel: "output", actual: 24682, target: 30000, achievementPercent: 82.3, lastUpdated: MOCK_LAST_UPDATED },
  { code: "AVDP-OUT-002", name: "Women reached with AVDP support", shortName: "Women Reached", unit: "farmers", resultLevel: "output", actual: 12341, target: 15000, achievementPercent: 82.3, lastUpdated: MOCK_LAST_UPDATED },
  { code: "AVDP-OUT-003", name: "Youth reached with AVDP support", shortName: "Youth Reached", unit: "farmers", resultLevel: "output", actual: 7898, target: 9000, achievementPercent: 87.8, lastUpdated: MOCK_LAST_UPDATED },
  { code: "AVDP-OUT-004", name: "Participants trained", shortName: "Participants Trained", unit: "participants", resultLevel: "output", actual: 18420, target: 22000, achievementPercent: 83.7, lastUpdated: MOCK_LAST_UPDATED },
  { code: "AVDP-OUT-005", name: "Area under improved production", shortName: "Area Cultivated", unit: "ha", resultLevel: "output", actual: 14260, target: 18000, achievementPercent: 79.2, lastUpdated: MOCK_LAST_UPDATED },
  { code: "AVDP-OUT-006", name: "Infrastructure assets delivered", shortName: "Infrastructure Delivered", unit: "assets", resultLevel: "output", actual: 186, target: 240, achievementPercent: 77.5, lastUpdated: MOCK_LAST_UPDATED },
  { code: "AVDP-OUC-001", name: "Production volume of supported value chains", shortName: "Production Volume", unit: "MT", resultLevel: "outcome", actual: 42870, target: 52000, achievementPercent: 82.4, lastUpdated: MOCK_LAST_UPDATED },
];

export const MOCK_DISTRICTS: DistrictSummary[] = [
  { id: "mock-bo", code: "SL-BO", name: "Bo", latitude: 7.9647, longitude: -11.7383, beneficiaries: 3120, female: 1580, areaHa: 1840, participantsTrained: 2310, infrastructureAssets: 24 },
  { id: "mock-bombali", code: "SL-BM", name: "Bombali", latitude: 9.2233, longitude: -12.1856, beneficiaries: 2740, female: 1362, areaHa: 1610, participantsTrained: 2010, infrastructureAssets: 19 },
  { id: "mock-kenema", code: "SL-KE", name: "Kenema", latitude: 7.8767, longitude: -11.19, beneficiaries: 2610, female: 1305, areaHa: 1520, participantsTrained: 1940, infrastructureAssets: 21 },
  { id: "mock-kailahun", code: "SL-KA", name: "Kailahun", latitude: 8.2789, longitude: -10.5736, beneficiaries: 2180, female: 1120, areaHa: 1290, participantsTrained: 1610, infrastructureAssets: 16 },
  { id: "mock-portloko", code: "SL-PL", name: "Port Loko", latitude: 8.7667, longitude: -12.7833, beneficiaries: 2050, female: 1010, areaHa: 1180, participantsTrained: 1520, infrastructureAssets: 15 },
  { id: "mock-tonkolili", code: "SL-TO", name: "Tonkolili", latitude: 8.7833, longitude: -11.8, beneficiaries: 1980, female: 968, areaHa: 1140, participantsTrained: 1470, infrastructureAssets: 14 },
  { id: "mock-moyamba", code: "SL-MO", name: "Moyamba", latitude: 8.1594, longitude: -12.4331, beneficiaries: 1720, female: 880, areaHa: 990, participantsTrained: 1280, infrastructureAssets: 12 },
  { id: "mock-pujehun", code: "SL-PU", name: "Pujehun", latitude: 7.3578, longitude: -11.7208, beneficiaries: 1560, female: 792, areaHa: 910, participantsTrained: 1160, infrastructureAssets: 11 },
  { id: "mock-kono", code: "SL-KO", name: "Kono", latitude: 8.6503, longitude: -10.9711, beneficiaries: 1490, female: 730, areaHa: 860, participantsTrained: 1090, infrastructureAssets: 10 },
  { id: "mock-kambia", code: "SL-KM", name: "Kambia", latitude: 9.1256, longitude: -12.9178, beneficiaries: 1420, female: 700, areaHa: 820, participantsTrained: 1040, infrastructureAssets: 9 },
  { id: "mock-koinadugu", code: "SL-KD", name: "Koinadugu", latitude: 9.5333, longitude: -11.3667, beneficiaries: 1290, female: 626, areaHa: 740, participantsTrained: 950, infrastructureAssets: 8 },
  { id: "mock-bonthe", code: "SL-BN", name: "Bonthe", latitude: 7.5264, longitude: -12.505, beneficiaries: 1180, female: 604, areaHa: 680, participantsTrained: 870, infrastructureAssets: 7 },
  { id: "mock-karene", code: "SL-KR", name: "Karene", latitude: 9.2, longitude: -12.55, beneficiaries: 1042, female: 512, areaHa: 610, participantsTrained: 790, infrastructureAssets: 7 },
  { id: "mock-falaba", code: "SL-FA", name: "Falaba", latitude: 9.8167, longitude: -11.4333, beneficiaries: 940, female: 452, areaHa: 540, participantsTrained: 700, infrastructureAssets: 6 },
  { id: "mock-war", code: "SL-WAR", name: "Western Area Rural", latitude: 8.3, longitude: -13.1, beneficiaries: 610, female: 320, areaHa: 340, participantsTrained: 470, infrastructureAssets: 4 },
  { id: "mock-wau", code: "SL-WAU", name: "Western Area Urban", latitude: 8.4844, longitude: -13.2344, beneficiaries: 400, female: 220, areaHa: 190, participantsTrained: 310, infrastructureAssets: 3 },
];

export const MOCK_VALUE_CHAINS: ValueChainSummary[] = [
  { id: "mock-rice", code: "VC-RICE", name: "Rice", beneficiaries: 9840, areaHa: 6120, quantity: 18420, avgYieldPerHa: 3.01, participantsTrained: 7320 },
  { id: "mock-cassava", code: "VC-CASSAVA", name: "Cassava", beneficiaries: 5210, areaHa: 3180, quantity: 12640, avgYieldPerHa: 3.97, participantsTrained: 3910 },
  { id: "mock-veg", code: "VC-VEG", name: "Vegetables", beneficiaries: 3480, areaHa: 1240, quantity: 5210, avgYieldPerHa: 4.2, participantsTrained: 2860 },
  { id: "mock-palm", code: "VC-PALM", name: "Oil Palm", beneficiaries: 2610, areaHa: 2140, quantity: 3860, avgYieldPerHa: 1.8, participantsTrained: 1920 },
  { id: "mock-cocoa", code: "VC-COCOA", name: "Cocoa", beneficiaries: 1740, areaHa: 1080, quantity: 1420, avgYieldPerHa: 1.31, participantsTrained: 1180 },
  { id: "mock-gnut", code: "VC-GNUT", name: "Groundnut", beneficiaries: 1120, areaHa: 380, quantity: 890, avgYieldPerHa: 2.34, participantsTrained: 740 },
  { id: "mock-poultry", code: "VC-POULTRY", name: "Poultry", beneficiaries: 682, areaHa: 120, quantity: 430, avgYieldPerHa: null, participantsTrained: 490 },
];

export const MOCK_TRAINING: TrainingSummary = {
  trainingEvents: 642,
  participantsTrained: 18420,
  uniqueParticipants: 14980,
  certified: 11240,
  totalTrainingDays: 1284,
};

export const MOCK_PRODUCTION: ProductionSummary = {
  records: 21460,
  totalAreaHa: 14260,
  totalQuantity: 42870,
  avgYieldPerHa: 3.01,
  producingBeneficiaries: 16240,
};

export const MOCK_INFRASTRUCTURE: InfrastructureSummary = {
  assetCount: 186,
  completedCount: 142,
  ongoingCount: 44,
  beneficiariesServed: 78600,
  byType: [
    { assetType: "Feeder road (km)", assetCount: 58, completedCount: 46 },
    { assetType: "Irrigation scheme", assetCount: 34, completedCount: 25 },
    { assetType: "Storage facility", assetCount: 31, completedCount: 24 },
    { assetType: "Processing centre", assetCount: 27, completedCount: 21 },
    { assetType: "Market structure", assetCount: 22, completedCount: 16 },
    { assetType: "Water point", assetCount: 14, completedCount: 10 },
  ],
};

export const MOCK_SUMMARY: DashboardSummary = {
  beneficiaries: {
    total: 24682,
    female: 12341,
    male: 12341,
    youth: 7898,
    femaleSharePercent: 50,
    districtsCovered: 16,
  },
  training: { participantsTrained: 18420, trainingEvents: 642, certified: 11240 },
  production: { totalAreaHa: 14260, totalQuantity: 42870, avgYieldPerHa: 3.01 },
  infrastructure: { assetCount: 186, completedCount: 142, beneficiariesServed: 78600 },
  headlineIndicators: MOCK_INDICATORS.slice(0, 6),
};

export function mockLineage(code: string): IndicatorLineage | null {
  const indicator = MOCK_INDICATORS.find((i) => i.code === code);
  if (!indicator) return null;
  return {
    indicatorCode: indicator.code,
    indicatorName: indicator.name,
    definition: "Illustrative definition supplied by the dashboard prototype.",
    calculationMethod: "Mock fixture — not derived from published AVDP data.",
    calculationVersion: 1,
    reportingPeriod: MOCK_REPORTING_PERIOD,
    lastUpdated: MOCK_LAST_UPDATED,
    dataQualityStatus: "unavailable",
    primaryDataSource: "Prototype fixtures",
    publications: [],
  };
}
