import "server-only";
import { env } from "@/lib/env";
import type { DashboardDataProvider } from "./types";
import { MockDashboardDataProvider } from "./providers/mock";
import { LiveDashboardDataProvider } from "./providers/live";

let cached: DashboardDataProvider | undefined;

/**
 * Single entry point for dashboard data. Components call this and never care
 * whether the numbers came from fixtures or the live analytics API.
 */
export function getDashboardProvider(): DashboardDataProvider {
  if (cached && cached.mode === env.dataMode()) return cached;
  cached =
    env.dataMode() === "live"
      ? new LiveDashboardDataProvider(env.dashboardApiBaseUrl())
      : new MockDashboardDataProvider();
  return cached;
}

export { MockDashboardDataProvider, LiveDashboardDataProvider };
export * from "./types";
