/**
 * Central environment access. Nothing outside this module reads process.env,
 * so secrets can never leak into a client bundle by accident: every export
 * here is server-only except PUBLIC_DATA_MODE.
 */
import "server-only";

function str(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function int(key: string, fallback: number): number {
  const raw = process.env[key];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export type DataMode = "mock" | "live";

export const env = {
  databaseUrl: () => str("DATABASE_URL"),
  dataMode: (): DataMode => (process.env.DATA_MODE === "live" ? "live" : "mock"),
  dashboardApiBaseUrl: () => process.env.DASHBOARD_API_BASE_URL ?? "http://127.0.0.1:3000",
  authSecret: () => str("AUTH_SECRET", "avdp-development-secret-change-me-0123456789abcd"),
  sessionTtlHours: () => int("SESSION_TTL_HOURS", 12),
  uploadDir: () => process.env.UPLOAD_STORAGE_DIR ?? "./storage/uploads",
  uploadMaxBytes: () => int("UPLOAD_MAX_BYTES", 25 * 1024 * 1024),
  uploadAllowedExtensions: () =>
    (process.env.UPLOAD_ALLOWED_EXTENSIONS ?? "csv,xlsx,xls")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  apiRateLimit: () => int("API_RATE_LIMIT", 120),
  apiRateWindowSeconds: () => int("API_RATE_LIMIT_WINDOW_SECONDS", 60),
  beneficiaryRefFormat: () => process.env.BENEFICIARY_REF_FORMAT ?? "AVDP-FRM-{seq}",
  beneficiaryRefSeqWidth: () => int("BENEFICIARY_REF_SEQ_WIDTH", 8),
  integrationSecretKey: () => process.env.INTEGRATION_SECRET_KEY ?? "",
};
