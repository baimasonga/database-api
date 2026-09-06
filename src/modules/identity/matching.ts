/**
 * Beneficiary matching. Deterministic rules run first and may auto-link;
 * probable matches are only ever queued for human review.
 */
export interface IdentityRecord {
  id: string;
  fullName: string;
  phone?: string | null;
  sex?: string | null;
  dateOfBirth?: string | null;
  districtName?: string | null;
  identifiers: Array<{ type: string; value: string; trusted?: boolean; source?: string | null }>;
}

export type MatchType = "deterministic" | "probable";

export interface MatchResult {
  candidateId: string;
  matchType: MatchType;
  ruleCode: string;
  score: number;
  evidence: Record<string, unknown>;
}

export function normaliseName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Sierra Leone numbers are compared on their last 8 significant digits. */
export function normalisePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 8 ? digits.slice(-8) : digits;
}

export function nameTokens(name: string): Set<string> {
  return new Set(normaliseName(name).split(" ").filter((t) => t.length > 1));
}

function bigrams(value: string): string[] {
  const text = value.replace(/\s+/g, " ");
  const pairs: string[] = [];
  for (let i = 0; i < text.length - 1; i += 1) pairs.push(text.slice(i, i + 2));
  return pairs;
}

/** Dice coefficient over character bigrams — tolerant of spelling variants. */
function diceSimilarity(a: string, b: string): number {
  const pa = bigrams(a);
  const pb = bigrams(b);
  if (pa.length === 0 || pb.length === 0) return 0;
  const pool = [...pb];
  let shared = 0;
  for (const pair of pa) {
    const index = pool.indexOf(pair);
    if (index !== -1) {
      shared += 1;
      pool.splice(index, 1);
    }
  }
  return (2 * shared) / (pa.length + pb.length);
}

/**
 * Name similarity for probable matching. Token-set Jaccard handles reordered
 * names ("Kamara Aminata"); Dice bigrams handle added middle names and
 * spelling variants ("Kamara" / "Kamarah"). The stronger signal wins, and a
 * probable match only ever queues a record for human review.
 */
export function nameSimilarity(a: string, b: string): number {
  const ta = nameTokens(a);
  const tb = nameTokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let intersection = 0;
  for (const token of ta) if (tb.has(token)) intersection += 1;
  const union = ta.size + tb.size - intersection;
  const jaccard = union === 0 ? 0 : intersection / union;
  const dice = diceSimilarity(normaliseName(a), normaliseName(b));
  return Math.round(Math.max(jaccard, dice) * 10000) / 10000;
}

const TRUSTED_TYPES = new Set(["national_id", "project_id", "group_membership_id", "avdp"]);

export const DETERMINISTIC_RULES = {
  TRUSTED_ID: "DET-TRUSTED-ID",
  EXTERNAL_ID: "DET-EXTERNAL-ID",
  PHONE_NAME: "DET-PHONE-NAME",
} as const;

export const PROBABLE_RULES = {
  NAME_DISTRICT: "PROB-NAME-DISTRICT",
  NAME_DOB: "PROB-NAME-DOB",
} as const;

export const PROBABLE_NAME_THRESHOLD = 0.8;

/**
 * Compares an incoming record against existing candidates.
 * Deterministic matches carry score 1; probable matches carry the similarity.
 */
export function findMatches(incoming: IdentityRecord, existing: IdentityRecord[]): MatchResult[] {
  const results: MatchResult[] = [];

  for (const candidate of existing) {
    if (candidate.id === incoming.id) continue;

    // 1. Same trusted external identifier.
    const trustedHit = incoming.identifiers.find((i) =>
      (TRUSTED_TYPES.has(i.type) || i.trusted) &&
      candidate.identifiers.some(
        (c) =>
          c.type === i.type &&
          c.value.trim().toUpperCase() === i.value.trim().toUpperCase() &&
          (i.type !== "external_source_id" || (c.source ?? null) === (i.source ?? null)),
      ),
    );
    if (trustedHit) {
      results.push({
        candidateId: candidate.id,
        matchType: "deterministic",
        ruleCode: DETERMINISTIC_RULES.TRUSTED_ID,
        score: 1,
        evidence: { identifierType: trustedHit.type, value: trustedHit.value },
      });
      continue;
    }

    // 2. Same external source identifier from the same source system.
    const externalHit = incoming.identifiers.find(
      (i) =>
        i.type === "external_source_id" &&
        candidate.identifiers.some(
          (c) =>
            c.type === "external_source_id" &&
            (c.source ?? null) === (i.source ?? null) &&
            c.value.trim().toUpperCase() === i.value.trim().toUpperCase(),
        ),
    );
    if (externalHit) {
      results.push({
        candidateId: candidate.id,
        matchType: "deterministic",
        ruleCode: DETERMINISTIC_RULES.EXTERNAL_ID,
        score: 1,
        evidence: { source: externalHit.source, value: externalHit.value },
      });
      continue;
    }

    // 3. Same phone number and the same name.
    if (incoming.phone && candidate.phone) {
      const samePhone = normalisePhone(incoming.phone) === normalisePhone(candidate.phone);
      const sameName = normaliseName(incoming.fullName) === normaliseName(candidate.fullName);
      if (samePhone && normalisePhone(incoming.phone).length >= 7 && sameName) {
        results.push({
          candidateId: candidate.id,
          matchType: "deterministic",
          ruleCode: DETERMINISTIC_RULES.PHONE_NAME,
          score: 1,
          evidence: { phone: normalisePhone(incoming.phone), name: normaliseName(incoming.fullName) },
        });
        continue;
      }
    }

    // 4. Probable: similar name in the same district, or with the same DOB.
    const similarity = nameSimilarity(incoming.fullName, candidate.fullName);
    if (similarity >= PROBABLE_NAME_THRESHOLD) {
      if (
        incoming.districtName &&
        candidate.districtName &&
        incoming.districtName.toUpperCase() === candidate.districtName.toUpperCase()
      ) {
        results.push({
          candidateId: candidate.id,
          matchType: "probable",
          ruleCode: PROBABLE_RULES.NAME_DISTRICT,
          score: similarity,
          evidence: { similarity, district: incoming.districtName },
        });
        continue;
      }
      if (incoming.dateOfBirth && candidate.dateOfBirth && incoming.dateOfBirth === candidate.dateOfBirth) {
        results.push({
          candidateId: candidate.id,
          matchType: "probable",
          ruleCode: PROBABLE_RULES.NAME_DOB,
          score: similarity,
          evidence: { similarity, dateOfBirth: incoming.dateOfBirth },
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}
