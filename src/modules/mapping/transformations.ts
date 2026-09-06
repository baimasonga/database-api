import { z } from "zod";

/**
 * Declarative transformation rules. There is deliberately no "script" or
 * "expression" operation: arbitrary executable code is never stored or run.
 */
export const transformationSchema = z.discriminatedUnion("op", [
  z.object({ op: z.literal("trim") }),
  z.object({ op: z.literal("uppercase") }),
  z.object({ op: z.literal("lowercase") }),
  z.object({ op: z.literal("titlecase") }),
  z.object({ op: z.literal("null_normalise"), tokens: z.array(z.string()).optional() }),
  z.object({ op: z.literal("parse_date"), format: z.enum(["auto", "dmy", "mdy", "ymd"]).default("auto") }),
  z.object({ op: z.literal("parse_number"), decimalSeparator: z.enum([".", ","]).default(".") }),
  z.object({ op: z.literal("parse_boolean") }),
  z.object({ op: z.literal("lookup"), set: z.string().min(1), passthrough: z.boolean().default(true) }),
  z.object({ op: z.literal("default"), value: z.string() }),
]);

export type Transformation = z.infer<typeof transformationSchema>;
export const transformationsSchema = z.array(transformationSchema).max(10);

export type LookupTables = Record<string, Record<string, string>>;

export interface TransformOutcome {
  value: string | number | boolean | null;
  /** Set when the declared transformation could not be applied to the value. */
  error?: string;
}

const DEFAULT_NULL_TOKENS = ["", "n/a", "na", "null", "none", "-", "--", "nil", "unknown", "not applicable"];

function toTitleCase(value: string): string {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function parseDate(value: string, format: "auto" | "dmy" | "mdy" | "ymd"): TransformOutcome {
  const text = value.trim();
  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/.exec(text);
  if (iso && (format === "auto" || format === "ymd")) {
    return buildDate(Number(iso[1]), Number(iso[2]), Number(iso[3]), text);
  }
  const parts = /^(\d{1,4})[\/\-.](\d{1,2})[\/\-.](\d{1,4})$/.exec(text);
  if (parts) {
    const [a, b, c] = [Number(parts[1]), Number(parts[2]), Number(parts[3])];
    if (format === "ymd") return buildDate(a, b, c, text);
    if (format === "mdy") return buildDate(normaliseYear(c), a, b, text);
    if (format === "dmy") return buildDate(normaliseYear(c), b, a, text);
    // auto: day-first when unambiguous, otherwise ISO-like ordering
    if (a > 31) return buildDate(a, b, c, text);
    if (a > 12) return buildDate(normaliseYear(c), b, a, text);
    return buildDate(normaliseYear(c), b, a, text);
  }
  const parsed = Date.parse(text);
  if (Number.isFinite(parsed)) return { value: new Date(parsed).toISOString().slice(0, 10) };
  return { value: null, error: `"${value}" is not a recognised date.` };
}

function normaliseYear(year: number): number {
  if (year >= 1000) return year;
  return year < 50 ? 2000 + year : 1900 + year;
}

function buildDate(year: number, month: number, day: number, original: string): TransformOutcome {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return { value: null, error: `"${original}" is not a valid calendar date.` };
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return { value: null, error: `"${original}" is not a valid calendar date.` };
  }
  return { value: date.toISOString().slice(0, 10) };
}

const TRUE_VALUES = new Set(["true", "yes", "y", "1", "t"]);
const FALSE_VALUES = new Set(["false", "no", "n", "0", "f"]);

/** Applies a declarative transformation chain to one raw cell value. */
export function applyTransformations(
  raw: string | null,
  transformations: Transformation[],
  lookups: LookupTables = {},
): TransformOutcome {
  let current: string | number | boolean | null = raw;

  for (const step of transformations) {
    if (step.op === "default") {
      if (current === null || current === "") current = step.value;
      continue;
    }
    if (current === null) continue;

    switch (step.op) {
      case "trim":
        current = String(current).trim();
        break;
      case "uppercase":
        current = String(current).toUpperCase();
        break;
      case "lowercase":
        current = String(current).toLowerCase();
        break;
      case "titlecase":
        current = toTitleCase(String(current));
        break;
      case "null_normalise": {
        const tokens = (step.tokens ?? DEFAULT_NULL_TOKENS).map((t) => t.toLowerCase());
        if (tokens.includes(String(current).trim().toLowerCase())) current = null;
        break;
      }
      case "parse_date": {
        const outcome = parseDate(String(current), step.format);
        if (outcome.error) return outcome;
        current = outcome.value;
        break;
      }
      case "parse_number": {
        let text: string = String(current).trim();
        text = step.decimalSeparator === "," ? text.replace(/\./g, "").replace(",", ".") : text.replace(/,/g, "");
        const num: number = Number(text);
        if (!Number.isFinite(num)) return { value: null, error: `"${current}" is not numeric.` };
        current = num;
        break;
      }
      case "parse_boolean": {
        const text: string = String(current).trim().toLowerCase();
        if (TRUE_VALUES.has(text)) current = true;
        else if (FALSE_VALUES.has(text)) current = false;
        else return { value: null, error: `"${current}" is not a recognised boolean.` };
        break;
      }
      case "lookup": {
        const table = lookups[step.set] ?? {};
        const key: string = String(current).trim().toUpperCase();
        const mapped: string | undefined = table[key];
        if (mapped !== undefined) current = mapped;
        else if (!step.passthrough) {
          return { value: null, error: `"${current}" is not a recognised ${step.set} value.` };
        }
        break;
      }
    }
  }

  return { value: current };
}

/** Transformation chain applied when a mapping does not declare its own. */
export function defaultTransformationsFor(
  type: "string" | "number" | "integer" | "date" | "boolean" | "enum",
  lookupSet?: string,
): Transformation[] {
  const base: Transformation[] = [{ op: "trim" }, { op: "null_normalise" }];
  switch (type) {
    case "number":
    case "integer":
      return [...base, { op: "parse_number", decimalSeparator: "." }];
    case "date":
      return [...base, { op: "parse_date", format: "auto" }];
    case "boolean":
      return [...base, { op: "parse_boolean" }];
    case "enum":
      return lookupSet ? [...base, { op: "lookup", set: lookupSet, passthrough: true }] : base;
    default:
      return lookupSet ? [...base, { op: "lookup", set: lookupSet, passthrough: true }] : base;
  }
}
