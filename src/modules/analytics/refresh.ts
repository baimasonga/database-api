import "server-only";
import { prisma } from "@/lib/db";

export const ANALYTICS_VIEWS = [
  "analytics_beneficiary_summary",
  "analytics_beneficiaries_by_district",
  "analytics_beneficiaries_by_value_chain",
  "analytics_beneficiaries_by_sex",
  "analytics_training_summary",
  "analytics_production_summary",
  "analytics_infrastructure_summary",
  "analytics_value_chain_summary",
  "analytics_geographic_summary",
  "analytics_indicator_performance",
  "analytics_data_quality_summary",
] as const;

export type AnalyticsView = (typeof ANALYTICS_VIEWS)[number];

export interface RefreshOutcome {
  view: string;
  status: "succeeded" | "failed";
  rowCount: number | null;
  durationMs: number;
  error?: string;
}

/**
 * Refreshes the analytics layer and records lineage for each view.
 *
 * The layer is currently built from standard views, which are always current,
 * so a "refresh" verifies each view and records the calculation time. When a
 * view is promoted to a materialised view, only this function changes.
 */
export async function refreshAnalytics(
  triggeredBy: string | null,
  trigger: "manual" | "publication" | "scheduled" = "manual",
  views: readonly string[] = ANALYTICS_VIEWS,
): Promise<RefreshOutcome[]> {
  const outcomes: RefreshOutcome[] = [];

  for (const view of views) {
    if (!ANALYTICS_VIEWS.includes(view as AnalyticsView)) continue;
    const log = await prisma.analyticsRefreshLog.create({
      data: { viewName: view, status: "running", trigger, triggeredBy },
    });
    const startedAt = Date.now();
    try {
      // View names come from the constant allow-list above, never user input.
      const result = await prisma.$queryRawUnsafe<Array<{ count: bigint }>>(
        `SELECT COUNT(*)::bigint AS count FROM analytics.${view}`,
      );
      const rowCount = Number(result[0]?.count ?? 0);
      const durationMs = Date.now() - startedAt;
      await prisma.analyticsRefreshLog.update({
        where: { id: log.id },
        data: { status: "succeeded", rowCount, durationMs, completedAt: new Date() },
      });
      outcomes.push({ view, status: "succeeded", rowCount, durationMs });
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const message = error instanceof Error ? error.message : String(error);
      await prisma.analyticsRefreshLog.update({
        where: { id: log.id },
        data: { status: "failed", durationMs, errorMessage: message, completedAt: new Date() },
      });
      outcomes.push({ view, status: "failed", rowCount: null, durationMs, error: message });
    }
  }
  return outcomes;
}

export async function lastRefreshAt(): Promise<Date | null> {
  const last = await prisma.analyticsRefreshLog.findFirst({
    where: { status: "succeeded" },
    orderBy: { completedAt: "desc" },
    select: { completedAt: true },
  });
  return last?.completedAt ?? null;
}
