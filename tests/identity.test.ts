import { describe, expect, it } from "vitest";
import {
  DETERMINISTIC_RULES,
  PROBABLE_RULES,
  findMatches,
  nameSimilarity,
  normalisePhone,
  type IdentityRecord,
} from "@/modules/identity/matching";
import { formatBeneficiaryReference, parseReferenceSequence } from "@/modules/identity/reference";

const base = (over: Partial<IdentityRecord> & { id: string }): IdentityRecord => ({
  fullName: "Aminata Kamara",
  identifiers: [],
  ...over,
});

describe("beneficiary reference", () => {
  it("formats a padded human-readable reference", () => {
    expect(formatBeneficiaryReference(1234, "AVDP-FRM-{seq}", 8)).toBe("AVDP-FRM-00001234");
    expect(parseReferenceSequence("AVDP-FRM-00001234")).toBe(1234);
  });
});

describe("normalisation", () => {
  it("compares phone numbers on their significant digits", () => {
    expect(normalisePhone("+232 76 111222")).toBe(normalisePhone("076111222"));
  });

  it("scores name similarity, tolerating reordering and spelling variants", () => {
    expect(nameSimilarity("Aminata Kamara", "Kamara Aminata")).toBe(1);
    expect(nameSimilarity("Aminata Kamara", "Aminata Kamarah")).toBeGreaterThan(0.9);
    // Unrelated names score near zero (a stray shared bigram is not a match).
    expect(nameSimilarity("Aminata Kamara", "Mohamed Sesay")).toBeLessThan(0.3);
  });
});

describe("deterministic matching", () => {
  it("matches on a shared trusted identifier", () => {
    const matches = findMatches(
      base({ id: "incoming", identifiers: [{ type: "national_id", value: "SL12345", trusted: true }] }),
      [base({ id: "existing", fullName: "A. Kamara", identifiers: [{ type: "national_id", value: "sl12345" }] })],
    );
    expect(matches[0].matchType).toBe("deterministic");
    expect(matches[0].ruleCode).toBe(DETERMINISTIC_RULES.TRUSTED_ID);
  });

  it("matches on the same phone plus the same name", () => {
    const matches = findMatches(
      base({ id: "incoming", phone: "+232 76 111222" }),
      [base({ id: "existing", phone: "076111222" })],
    );
    expect(matches[0].ruleCode).toBe(DETERMINISTIC_RULES.PHONE_NAME);
  });

  it("does not match on the same phone with a different name", () => {
    const matches = findMatches(
      base({ id: "incoming", phone: "076111222" }),
      [base({ id: "existing", fullName: "Mohamed Sesay", phone: "076111222" })],
    );
    expect(matches).toHaveLength(0);
  });

  it("requires the same source for external source IDs", () => {
    const sameSource = findMatches(
      base({ id: "incoming", identifiers: [{ type: "external_source_id", value: "42", source: "kobo" }] }),
      [base({ id: "existing", identifiers: [{ type: "external_source_id", value: "42", source: "kobo" }] })],
    );
    expect(sameSource[0].ruleCode).toBe(DETERMINISTIC_RULES.EXTERNAL_ID);

    const differentSource = findMatches(
      base({ id: "incoming", identifiers: [{ type: "external_source_id", value: "42", source: "kobo" }] }),
      [base({ id: "existing", identifiers: [{ type: "external_source_id", value: "42", source: "odk" }] })],
    );
    expect(differentSource).toHaveLength(0);
  });
});

describe("probable matching", () => {
  it("proposes a review item for a similar name in the same district", () => {
    const matches = findMatches(
      base({ id: "incoming", fullName: "Aminata Kamara", districtName: "Bo" }),
      [base({ id: "existing", fullName: "Aminata Kamara Sesay", districtName: "BO" })],
    );
    expect(matches[0].matchType).toBe("probable");
    expect(matches[0].ruleCode).toBe(PROBABLE_RULES.NAME_DISTRICT);
    expect(matches[0].score).toBeLessThan(1);
  });

  it("never proposes a probable match on names alone", () => {
    const matches = findMatches(
      base({ id: "incoming", fullName: "Aminata Kamara" }),
      [base({ id: "existing", fullName: "Aminata Kamara" })],
    );
    expect(matches).toHaveLength(0);
  });
});
