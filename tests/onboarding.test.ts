import { describe, expect, it } from "vitest";
import {
  ONBOARDING_STATUSES,
  advanceOnboarding,
  isAtLeast,
  onboardingUpdate,
  statusRank,
  type OnboardingEvent,
  type OnboardingStatus,
} from "@/modules/governance/onboarding";

describe("onboarding status ordering", () => {
  it("orders the seven statuses as the onboarding guide describes", () => {
    expect([...ONBOARDING_STATUSES]).toEqual([
      "discovered", "assessed", "mapped", "tested", "validated", "approved", "live",
    ]);
    expect(statusRank("discovered")).toBeLessThan(statusRank("live"));
  });

  it("compares against a floor", () => {
    expect(isAtLeast("validated", "mapped")).toBe(true);
    expect(isAtLeast("mapped", "validated")).toBe(false);
    expect(isAtLeast("live", "live")).toBe(true);
  });
});

describe("advancing onboarding", () => {
  const cases: Array<[OnboardingEvent, OnboardingStatus]> = [
    ["profiled", "assessed"],
    ["mapped", "mapped"],
    ["validation_run", "tested"],
    ["validation_clean", "validated"],
    ["approved", "approved"],
    ["published", "live"],
  ];

  it.each(cases)("event %s advances a new source to %s", (event, expected) => {
    expect(advanceOnboarding("discovered", event)).toBe(expected);
  });

  it("never regresses on a later import for an already-live source", () => {
    for (const event of ["profiled", "mapped", "validation_run", "validation_clean", "approved"] as OnboardingEvent[]) {
      expect(advanceOnboarding("live", event)).toBe("live");
    }
  });

  it("holds status when the event describes work already reflected", () => {
    expect(advanceOnboarding("validated", "mapped")).toBe("validated");
    expect(advanceOnboarding("approved", "validation_run")).toBe("approved");
  });

  it("walks the full pipeline in lifecycle order", () => {
    let status: OnboardingStatus = "discovered";
    const lifecycle: OnboardingEvent[] = [
      "profiled", "mapped", "validation_run", "validation_clean", "approved", "published",
    ];
    const seen = lifecycle.map((event) => (status = advanceOnboarding(status, event)));
    expect(seen).toEqual(["assessed", "mapped", "tested", "validated", "approved", "live"]);
  });

  it("skips ahead when an earlier stage produced no event", () => {
    // A dataset registered and immediately published still ends up live.
    expect(advanceOnboarding("discovered", "published")).toBe("live");
  });

  it("does not mark a failing validation as validated", () => {
    // Only "validation_clean" reaches validated; a run alone stops at tested.
    expect(advanceOnboarding("mapped", "validation_run")).toBe("tested");
  });
});

describe("onboardingUpdate", () => {
  it("returns an update only when the status changes", () => {
    expect(onboardingUpdate("discovered", "profiled")).toEqual({ onboardingStatus: "assessed" });
    expect(onboardingUpdate("live", "profiled")).toBeNull();
    expect(onboardingUpdate("assessed", "profiled")).toBeNull();
  });
});
