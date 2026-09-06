import "server-only";
import type { PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/db";
import { advanceOnboarding, type OnboardingEvent, type OnboardingStatus } from "./onboarding";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Advances the onboarding status of a dataset and its data source in step with
 * the ingestion lifecycle. Both are advanced together: a source is only as far
 * along as the furthest dataset it owns.
 *
 * Writes are skipped when the status would not change, and onboarding is never
 * allowed to break the operation that triggered it — it is bookkeeping, not
 * part of the data path.
 */
export async function recordOnboardingEvent(
  datasetId: string,
  event: OnboardingEvent,
  client: Tx = prisma,
): Promise<OnboardingStatus | null> {
  try {
    const dataset = await client.dataset.findUnique({
      where: { id: datasetId },
      select: { id: true, dataSourceId: true, onboardingStatus: true },
    });
    if (!dataset) return null;

    const next = advanceOnboarding(dataset.onboardingStatus, event);
    if (next !== dataset.onboardingStatus) {
      await client.dataset.update({ where: { id: dataset.id }, data: { onboardingStatus: next } });
    }

    const source = await client.dataSource.findUnique({
      where: { id: dataset.dataSourceId },
      select: { id: true, onboardingStatus: true },
    });
    if (source) {
      const sourceNext = advanceOnboarding(source.onboardingStatus, event);
      if (sourceNext !== source.onboardingStatus) {
        await client.dataSource.update({ where: { id: source.id }, data: { onboardingStatus: sourceNext } });
      }
    }

    return next;
  } catch (error) {
    console.error("[onboarding] could not record event", event, datasetId, error);
    return null;
  }
}
