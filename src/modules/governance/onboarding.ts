/**
 * The AVDP onboarding status system (Phase 14).
 *
 * Onboarding status answers "how far through onboarding is this dataset?".
 * It is advanced by the lifecycle itself rather than maintained by hand, so a
 * source cannot sit at `discovered` while its data is already being validated.
 *
 * Progress is monotonic: a later import for an already-live source never drags
 * its status backwards. Regressing is a deliberate act, available to
 * authorised staff through the Data Manager, not a side effect of routine work.
 */

export const ONBOARDING_STATUSES = [
  "discovered",
  "assessed",
  "mapped",
  "tested",
  "validated",
  "approved",
  "live",
] as const;

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];

const RANK: Record<OnboardingStatus, number> = Object.fromEntries(
  ONBOARDING_STATUSES.map((status, index) => [status, index]),
) as Record<OnboardingStatus, number>;

/** Lifecycle events that carry onboarding meaning. */
export type OnboardingEvent =
  /** A file was uploaded and profiled: the schema is now known. */
  | "profiled"
  /** Columns were mapped to canonical AVDP fields. */
  | "mapped"
  /** Validation ran, whatever its outcome. */
  | "validation_run"
  /** Validation completed with no unresolved error-severity findings. */
  | "validation_clean"
  /** An M&E approver approved the import. */
  | "approved"
  /** The import was published and is feeding the analytics layer. */
  | "published";

const EVENT_TARGET: Record<OnboardingEvent, OnboardingStatus> = {
  profiled: "assessed",
  mapped: "mapped",
  validation_run: "tested",
  validation_clean: "validated",
  approved: "approved",
  published: "live",
};

export function statusRank(status: OnboardingStatus): number {
  return RANK[status];
}

export function isAtLeast(status: OnboardingStatus, floor: OnboardingStatus): boolean {
  return RANK[status] >= RANK[floor];
}

/**
 * The status a lifecycle event implies, or the current status when the event
 * describes work already reflected in it.
 */
export function advanceOnboarding(current: OnboardingStatus, event: OnboardingEvent): OnboardingStatus {
  const target = EVENT_TARGET[event];
  return RANK[target] > RANK[current] ? target : current;
}

/**
 * The status update to persist, or null when nothing changed — so callers can
 * skip a pointless write.
 */
export function onboardingUpdate(
  current: OnboardingStatus,
  event: OnboardingEvent,
): { onboardingStatus: OnboardingStatus } | null {
  const next = advanceOnboarding(current, event);
  return next === current ? null : { onboardingStatus: next };
}

export const ONBOARDING_LABELS: Record<OnboardingStatus, string> = {
  discovered: "Discovered",
  assessed: "Assessed",
  mapped: "Mapped",
  tested: "Tested",
  validated: "Validated",
  approved: "Approved",
  live: "Live",
};

export const ONBOARDING_DESCRIPTIONS: Record<OnboardingStatus, string> = {
  discovered: "Listed in the inventory; schema and ownership not yet confirmed.",
  assessed: "A sample has been uploaded and profiled, so the schema is known.",
  mapped: "Columns are mapped to canonical AVDP fields.",
  tested: "A test import has run and its findings are available for review.",
  validated: "Validation passes with no unresolved errors.",
  approved: "Approved by the M&E approver, ready to publish.",
  live: "Published and feeding the analytics layer and the dashboard.",
};
