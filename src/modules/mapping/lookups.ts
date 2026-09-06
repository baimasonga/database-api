import "server-only";
import { prisma } from "@/lib/db";
import type { LookupTables } from "./transformations";

/**
 * Builds the controlled lookup tables and reference sets used by mapping and
 * validation. Master data doubles as the authoritative reference set, so a
 * district added to master data is immediately accepted by validation.
 */
export async function loadLookupContext(): Promise<{
  lookups: LookupTables;
  referenceSets: Record<string, Set<string>>;
}> {
  const [districts, chiefdoms, valueChains, units, sets] = await Promise.all([
    prisma.district.findMany({ where: { isActive: true }, select: { name: true, code: true } }),
    prisma.chiefdom.findMany({ where: { isActive: true }, select: { name: true } }),
    prisma.valueChain.findMany({ where: { isActive: true }, select: { name: true, code: true } }),
    prisma.unitOfMeasure.findMany({ where: { isActive: true }, select: { name: true, code: true } }),
    prisma.lookupSet.findMany({ include: { values: true } }),
  ]);

  const lookups: LookupTables = {};
  // Master data provides identity mappings (BO -> Bo) before configured aliases.
  lookups.district = Object.fromEntries(districts.flatMap((d) => [[d.name.toUpperCase(), d.name], [d.code.toUpperCase(), d.name]]));
  lookups.chiefdom = Object.fromEntries(chiefdoms.map((c) => [c.name.toUpperCase(), c.name]));
  lookups.value_chain = Object.fromEntries(valueChains.flatMap((v) => [[v.name.toUpperCase(), v.name], [v.code.toUpperCase(), v.name]]));
  lookups.unit = Object.fromEntries(units.flatMap((u) => [[u.name.toUpperCase(), u.code], [u.code.toUpperCase(), u.code]]));
  lookups.sex = {
    M: "male", MALE: "male", "1": "male",
    F: "female", FEMALE: "female", "2": "female",
    O: "other", OTHER: "other",
    U: "unknown", UNKNOWN: "unknown",
  };

  // Administrator-configured aliases override the defaults above.
  for (const set of sets) {
    lookups[set.code] = {
      ...(lookups[set.code] ?? {}),
      ...Object.fromEntries(set.values.map((v) => [v.externalValue.toUpperCase(), v.canonicalValue])),
    };
  }

  const referenceSets: Record<string, Set<string>> = {
    district: new Set(districts.map((d) => d.name.toUpperCase())),
    chiefdom: new Set(chiefdoms.map((c) => c.name.toUpperCase())),
    value_chain: new Set(valueChains.map((v) => v.name.toUpperCase())),
    unit: new Set(units.map((u) => u.code.toUpperCase())),
  };

  return { lookups, referenceSets };
}
