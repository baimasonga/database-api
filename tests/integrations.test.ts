import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { recordsToTable, restConnectorConfig } from "@/modules/integrations/connectors/rest";
import { toCsvBuffer } from "@/modules/integrations/serialise";
import { CONNECTORS, isImplemented } from "@/modules/integrations/registry";

const ORIGINAL_ENV = { ...process.env };
const KEY = Buffer.alloc(32, 7).toString("base64");

async function secrets() {
  vi.resetModules();
  return import("@/modules/integrations/secrets");
}

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("connector secret encryption", () => {
  beforeEach(() => {
    process.env.INTEGRATION_SECRET_KEY = KEY;
  });

  it("round-trips a secret", async () => {
    const { encryptSecret, decryptSecret } = await secrets();
    const secret = { token: "s3cr3t-token", username: "avdp" };
    const cipher = encryptSecret(secret);
    expect(cipher).toMatch(/^v1\./);
    expect(cipher).not.toContain("s3cr3t-token");
    expect(decryptSecret(cipher)).toEqual(secret);
  });

  it("produces a different ciphertext each time, so repeats are not detectable", async () => {
    const { encryptSecret } = await secrets();
    expect(encryptSecret({ token: "a" })).not.toBe(encryptSecret({ token: "a" }));
  });

  it("rejects a tampered payload rather than returning altered data", async () => {
    const { encryptSecret, decryptSecret, SecretDecryptionFailed } = await secrets();
    const cipher = encryptSecret({ token: "abc" });
    const [v, iv, tag, data] = cipher.split(".");
    const flipped = data.slice(0, -2) + (data.endsWith("AA") ? "BB" : "AA");
    expect(() => decryptSecret([v, iv, tag, flipped].join("."))).toThrow(SecretDecryptionFailed);
  });

  it("rejects a payload encrypted under a different key", async () => {
    const first = await secrets();
    const cipher = first.encryptSecret({ token: "abc" });
    process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(32, 9).toString("base64");
    const second = await secrets();
    expect(() => second.decryptSecret(cipher)).toThrow(second.SecretDecryptionFailed);
  });

  it("rejects malformed payloads", async () => {
    const { decryptSecret, SecretDecryptionFailed } = await secrets();
    expect(() => decryptSecret("nonsense")).toThrow(SecretDecryptionFailed);
    expect(() => decryptSecret("v2.a.b.c")).toThrow(/unsupported format/);
  });

  it("refuses to encrypt without a usable key", async () => {
    process.env.INTEGRATION_SECRET_KEY = "";
    const { encryptSecret, SecretKeyMissing, secretsConfigured } = await secrets();
    expect(secretsConfigured()).toBe(false);
    expect(() => encryptSecret({ token: "x" })).toThrow(SecretKeyMissing);
  });

  it("refuses a key of the wrong length instead of silently weakening encryption", async () => {
    process.env.INTEGRATION_SECRET_KEY = Buffer.alloc(16, 1).toString("base64");
    const { secretsConfigured } = await secrets();
    expect(secretsConfigured()).toBe(false);
  });
});

describe("redaction", () => {
  it("strips the ciphertext and reports only whether a secret exists", async () => {
    process.env.INTEGRATION_SECRET_KEY = KEY;
    const { redactIntegration } = await secrets();
    const redacted = redactIntegration({ id: "i1", name: "Kobo", secretCiphertext: "v1.a.b.c" });
    expect(redacted).not.toHaveProperty("secretCiphertext");
    expect(redacted.hasSecret).toBe(true);
    expect(JSON.stringify(redacted)).not.toContain("v1.a.b.c");
  });

  it("reports no secret when none is stored", async () => {
    const { redactIntegration } = await secrets();
    expect(redactIntegration({ id: "i1", secretCiphertext: null }).hasSecret).toBe(false);
  });
});

describe("connector registry", () => {
  it("only marks connectors implemented when an adapter exists", () => {
    expect(isImplemented("scheduled_file")).toBe(true);
    expect(isImplemented("rest_api")).toBe(true);
    // Framework-only until their API specifications are available.
    expect(isImplemented("odk")).toBe(false);
    expect(isImplemented("database")).toBe(false);
    expect(isImplemented("webhook")).toBe(false);
  });

  it("describes every connector type the phase requires", () => {
    expect(CONNECTORS.map((c) => c.type).sort()).toEqual(
      ["database", "odk", "rest_api", "scheduled_file", "webhook"].sort(),
    );
  });
});

describe("REST connector payload handling", () => {
  it("flattens records into a table, preserving every field", () => {
    const table = recordsToTable([
      { id: 1, name: "Aminata", district: "Bo" },
      { id: 2, name: "Mohamed", phone: "076111222" },
    ]);
    expect(table.columns).toEqual(["id", "name", "district", "phone"]);
    expect(table.rows[0]).toEqual({ id: "1", name: "Aminata", district: "Bo", phone: null });
    expect(table.rows[1].phone).toBe("076111222");
  });

  it("serialises nested values rather than dropping them", () => {
    const table = recordsToTable([{ id: 1, location: { district: "Bo" }, tags: ["a", "b"] }]);
    expect(table.rows[0].location).toBe('{"district":"Bo"}');
    expect(table.rows[0].tags).toBe('["a","b"]');
  });

  it("treats null and undefined as empty, not the string 'null'", () => {
    const table = recordsToTable([{ a: null, b: undefined, c: 0, d: false }]);
    expect(table.rows[0].a).toBeNull();
    expect(table.rows[0].b).toBeNull();
    // Zero and false are real values and must survive.
    expect(table.rows[0].c).toBe("0");
    expect(table.rows[0].d).toBe("false");
  });

  it("requires a valid URL and bounds the record count", () => {
    expect(restConnectorConfig.safeParse({ url: "not-a-url" }).success).toBe(false);
    const parsed = restConnectorConfig.parse({ url: "https://example.test/api" });
    expect(parsed.method).toBe("GET");
    expect(parsed.authType).toBe("none");
    expect(parsed.maxRecords).toBeLessThanOrEqual(100_000);
  });
});

describe("connector payload retention", () => {
  it("renders a table as CSV so the payload is retained verbatim", () => {
    const csv = toCsvBuffer({
      columns: ["name", "note"],
      rows: [
        { name: "Aminata", note: 'said "hello"' },
        { name: "Mohamed", note: "a,b" },
        { name: "Fatmata", note: null },
      ],
    }).toString("utf8");

    expect(csv.split("\n")[0]).toBe("name,note");
    expect(csv).toContain('"said ""hello"""');
    expect(csv).toContain('"a,b"');
    expect(csv.split("\n")[3]).toBe("Fatmata,");
  });
});
