/**
 * Human-readable AVDP beneficiary reference. This is an attribute, never the
 * primary key — the database key stays a UUID.
 */
export function formatBeneficiaryReference(sequence: number, format: string, width: number): string {
  const seq = String(sequence).padStart(Math.max(1, width), "0");
  return format.replace("{seq}", seq).replace("{year}", String(new Date().getUTCFullYear()));
}

export function parseReferenceSequence(reference: string): number | null {
  const digits = /(\d+)\s*$/.exec(reference.trim());
  return digits ? Number.parseInt(digits[1], 10) : null;
}
