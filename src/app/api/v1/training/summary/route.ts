import { ok } from "@/lib/api/envelope";
import { filtersToEnvelope } from "@/lib/api/filters";
import { withApi } from "@/lib/api/handler";
import { getTrainingSummary } from "@/modules/analytics/queries";
import type { TrainingSummary } from "@/data/types";

export const dynamic = "force-dynamic";

export const GET = withApi(async ({ filters, resolved }) => {
  const s = await getTrainingSummary(resolved);
  const payload: TrainingSummary = {
    trainingEvents: s.training_events,
    participantsTrained: s.participants_trained,
    uniqueParticipants: s.unique_participants,
    certified: s.certified_count,
    totalTrainingDays: s.total_training_days,
  };
  return ok(payload, { filters: filtersToEnvelope(filters), reportingPeriod: resolved.reportingPeriodCode });
});
