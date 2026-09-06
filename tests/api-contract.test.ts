import { beforeEach, describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimits } from "@/lib/api/rate-limit";
import { dashboardFilterSchema, paginationSchema } from "@/lib/api/filters";
import { assertUploadAllowed, extensionOf, sanitiseFileName, UploadRejected } from "@/modules/ingestion/storage";

describe("API filter validation", () => {
  it("accepts the documented filters", () => {
    const parsed = dashboardFilterSchema.safeParse({ reporting_period: "2026-Q2", district: "Bo", sex: "female" });
    expect(parsed.success).toBe(true);
  });

  it("rejects an out-of-domain sex value", () => {
    expect(dashboardFilterSchema.safeParse({ sex: "unspecified" }).success).toBe(false);
  });

  it("bounds pagination", () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, page_size: 50 });
    expect(paginationSchema.safeParse({ page: 0 }).success).toBe(false);
    expect(paginationSchema.safeParse({ page_size: 5000 }).success).toBe(false);
  });
});

describe("rate limiting", () => {
  beforeEach(() => resetRateLimits());

  it("allows requests up to the limit then rejects", () => {
    const limit = checkRateLimit("test-key").limit;
    for (let i = 1; i < limit; i += 1) expect(checkRateLimit("test-key").allowed).toBe(true);
    const blocked = checkRateLimit("test-key");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("tracks clients independently", () => {
    checkRateLimit("client-a");
    expect(checkRateLimit("client-b").remaining).toBe(checkRateLimit("client-c").remaining);
  });
});

describe("upload security", () => {
  it("accepts CSV and XLSX", () => {
    expect(() => assertUploadAllowed("registry.csv", "text/csv", 1024)).not.toThrow();
    expect(() =>
      assertUploadAllowed("registry.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", 1024),
    ).not.toThrow();
  });

  it("rejects executables regardless of configuration", () => {
    expect(() => assertUploadAllowed("payload.exe", "application/octet-stream", 10)).toThrow(UploadRejected);
    expect(() => assertUploadAllowed("payload.sh", "text/plain", 10)).toThrow(/Executable files are not accepted/);
    expect(() => assertUploadAllowed("payload.svg", "text/plain", 10)).toThrow(UploadRejected);
  });

  it("rejects empty and oversized files", () => {
    expect(() => assertUploadAllowed("a.csv", "text/csv", 0)).toThrow(/empty/);
    expect(() => assertUploadAllowed("a.csv", "text/csv", 1024 * 1024 * 1024)).toThrow(/limit/);
  });

  it("strips path traversal from file names", () => {
    expect(sanitiseFileName("../../etc/passwd.csv")).toBe("passwd.csv");
    expect(sanitiseFileName("re port (final).csv")).toBe("re_port__final_.csv");
    expect(extensionOf("Registry.XLSX")).toBe("xlsx");
  });
});
