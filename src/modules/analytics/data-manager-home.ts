import "server-only";
import { prisma } from "@/lib/db";
import { lastRefreshAt } from "./refresh";

/**
 * Read model for the AVDP Data Manager home screen.
 *
 * Scope is deliberately narrow: data governance and dashboard-feed health.
 * Nothing here reports on procurement, finance, HR or project operations —
 * those belong in the AVDP source systems, not in this platform.
 *
 * Counts are counted, never derived from the length of a `take`-limited list,
 * so a capped preview list can never under-report a headline figure.
 */

export interface QualityTrendPoint {
  periodId: string;
  periodCode: string;
  periodName: string;
  importCount: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  /** Share of rows that passed validation; null when the period has no rows. */
  passRatePercent: number | null;
  /** Mean composite quality score across the period's imports. */
  qualityScore: number | null;
}

interface TrendAggregate {
  reportingPeriodId: string;
  importCount: number;
  totalRows: number;
  validRows: number;
  errorRows: number;
  warningRows: number;
  qualityScoreSum: number;
  qualityScoreCount: number;
}

export interface PeriodRef {
  id: string;
  code: string;
  name: string;
  startDate: Date;
}

/**
 * Joins per-period import aggregates onto the reporting-period calendar,
 * oldest first. Periods with no imports are omitted rather than plotted as
 * zero: no data is not the same as a pass rate of nothing.
 */
export function buildQualityTrend(
  aggregates: TrendAggregate[],
  periods: PeriodRef[],
  limit = 8,
): QualityTrendPoint[] {
  const byPeriod = new Map(aggregates.map((a) => [a.reportingPeriodId, a]));

  const points = periods
    .filter((period) => byPeriod.has(period.id))
    .map((period) => {
      const a = byPeriod.get(period.id)!;
      return {
        periodId: period.id,
        periodCode: period.code,
        periodName: period.name,
        importCount: a.importCount,
        totalRows: a.totalRows,
        validRows: a.validRows,
        errorRows: a.errorRows,
        warningRows: a.warningRows,
        passRatePercent: a.totalRows > 0 ? Math.round((a.validRows / a.totalRows) * 1000) / 10 : null,
        qualityScore:
          a.qualityScoreCount > 0 ? Math.round((a.qualityScoreSum / a.qualityScoreCount) * 10) / 10 : null,
        startDate: period.startDate,
      };
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime());

  // Keep the most recent `limit` periods, still in chronological order.
  return points.slice(-limit).map(({ startDate: _startDate, ...point }) => point);
}

async function loadQualityTrend(limit = 8): Promise<QualityTrendPoint[]> {
  const [grouped, scores, periods] = await Promise.all([
    prisma.importJob.groupBy({
      by: ["reportingPeriodId"],
      _count: { _all: true },
      _sum: { rowCount: true, validRowCount: true, errorRowCount: true, warningRowCount: true },
    }),
    prisma.importJob.groupBy({
      by: ["reportingPeriodId"],
      where: { qualityScore: { not: null } },
      _count: { qualityScore: true },
      _sum: { qualityScore: true },
    }),
    prisma.reportingPeriod.findMany({
      orderBy: { startDate: "asc" },
      select: { id: true, code: true, name: true, startDate: true },
    }),
  ]);

  const scoreByPeriod = new Map(scores.map((s) => [s.reportingPeriodId, s]));

  const aggregates: TrendAggregate[] = grouped.map((g) => {
    const score = scoreByPeriod.get(g.reportingPeriodId);
    return {
      reportingPeriodId: g.reportingPeriodId,
      importCount: g._count._all,
      totalRows: g._sum.rowCount ?? 0,
      validRows: g._sum.validRowCount ?? 0,
      errorRows: g._sum.errorRowCount ?? 0,
      warningRows: g._sum.warningRowCount ?? 0,
      qualityScoreSum: score?._sum.qualityScore ? Number(score._sum.qualityScore) : 0,
      qualityScoreCount: score?._count.qualityScore ?? 0,
    };
  });

  return buildQualityTrend(aggregates, periods, limit);
}

export async function loadDataManagerHome() {
  const currentPeriod = await prisma.reportingPeriod.findFirst({
    where: { status: "open" },
    orderBy: { startDate: "desc" },
  });

  const [
    sourceCount,
    activeSourceCount,
    attentionSourceCount,
    attentionSources,
    datasetCount,
    importsThisPeriod,
    pendingReviewCount,
    pendingApprovalCount,
    pendingApprovals,
    publishedDatasetCount,
    openErrorCount,
    recentImports,
    latestPublication,
    latestImport,
    qualityAgg,
    trend,
    refreshedAt,
  ] = await Promise.all([
    prisma.dataSource.count({ where: { archivedAt: null } }),
    prisma.dataSource.count({ where: { archivedAt: null, status: "active" } }),
    prisma.dataSource.count({ where: { archivedAt: null, status: "attention_required" } }),
    prisma.dataSource.findMany({
      where: { archivedAt: null, status: "attention_required" },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    prisma.dataset.count({ where: { archivedAt: null } }),
    currentPeriod
      ? prisma.importJob.count({ where: { reportingPeriodId: currentPeriod.id } })
      : Promise.resolve(0),
    prisma.importJob.count({ where: { status: "ready_for_review" } }),
    prisma.approvalRequest.count({ where: { status: { in: ["pending", "in_review"] } } }),
    prisma.approvalRequest.findMany({
      where: { status: { in: ["pending", "in_review"] } },
      orderBy: { submittedAt: "asc" },
      take: 8,
      include: {
        importJob: { include: { dataset: true, dataSource: true, reportingPeriod: true } },
        requester: { select: { fullName: true } },
      },
    }),
    prisma.publicationRecord.count({ where: { status: "published" } }),
    prisma.validationResult.count({ where: { severity: "error", resolved: false } }),
    prisma.importJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        dataset: { select: { name: true } },
        dataSource: { select: { name: true } },
        reportingPeriod: { select: { code: true } },
      },
    }),
    prisma.publicationRecord.findFirst({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      include: { dataset: { select: { name: true } } },
    }),
    prisma.importJob.findFirst({
      where: { status: { in: ["published", "approved"] } },
      orderBy: { updatedAt: "desc" },
      include: { dataset: { select: { name: true } } },
    }),
    prisma.importJob.aggregate({ _avg: { qualityScore: true } }),
    loadQualityTrend(),
    lastRefreshAt(),
  ]);

  return {
    currentPeriod,
    sourceCount,
    activeSourceCount,
    attentionSourceCount,
    attentionSources,
    datasetCount,
    importsThisPeriod,
    pendingReviewCount,
    pendingApprovalCount,
    pendingApprovals,
    publishedDatasetCount,
    openErrorCount,
    recentImports,
    latestPublication,
    latestImport,
    qualityScore: qualityAgg._avg.qualityScore ? Number(qualityAgg._avg.qualityScore) : null,
    trend,
    refreshedAt,
  };
}
