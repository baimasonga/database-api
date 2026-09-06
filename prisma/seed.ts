/**
 * Seeds reference/master data only. No fictitious production data is written
 * here — development fixtures are guarded behind SEED_DEV_FIXTURES=true.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { DEFAULT_ROLES, PERMISSIONS } from "../src/lib/auth/permissions";

const prisma = new PrismaClient();

const DISTRICTS: Array<{ code: string; name: string; province: string; lat: number; lon: number }> = [
  { code: "SL-BO", name: "Bo", province: "Southern", lat: 7.9647, lon: -11.7383 },
  { code: "SL-BN", name: "Bonthe", province: "Southern", lat: 7.5264, lon: -12.505 },
  { code: "SL-MO", name: "Moyamba", province: "Southern", lat: 8.1594, lon: -12.4331 },
  { code: "SL-PU", name: "Pujehun", province: "Southern", lat: 7.3578, lon: -11.7208 },
  { code: "SL-KA", name: "Kailahun", province: "Eastern", lat: 8.2789, lon: -10.5736 },
  { code: "SL-KE", name: "Kenema", province: "Eastern", lat: 7.8767, lon: -11.19 },
  { code: "SL-KO", name: "Kono", province: "Eastern", lat: 8.6503, lon: -10.9711 },
  { code: "SL-BM", name: "Bombali", province: "Northern", lat: 9.2233, lon: -12.1856 },
  { code: "SL-FA", name: "Falaba", province: "Northern", lat: 9.8167, lon: -11.4333 },
  { code: "SL-KD", name: "Koinadugu", province: "Northern", lat: 9.5333, lon: -11.3667 },
  { code: "SL-TO", name: "Tonkolili", province: "Northern", lat: 8.7833, lon: -11.8 },
  { code: "SL-KM", name: "Kambia", province: "North West", lat: 9.1256, lon: -12.9178 },
  { code: "SL-KR", name: "Karene", province: "North West", lat: 9.2, lon: -12.55 },
  { code: "SL-PL", name: "Port Loko", province: "North West", lat: 8.7667, lon: -12.7833 },
  { code: "SL-WAR", name: "Western Area Rural", province: "Western Area", lat: 8.3, lon: -13.1 },
  { code: "SL-WAU", name: "Western Area Urban", province: "Western Area", lat: 8.4844, lon: -13.2344 },
];

const VALUE_CHAINS = [
  { code: "VC-RICE", name: "Rice", category: "Staple crop" },
  { code: "VC-CASSAVA", name: "Cassava", category: "Staple crop" },
  { code: "VC-VEG", name: "Vegetables", category: "Horticulture" },
  { code: "VC-PALM", name: "Oil Palm", category: "Tree crop" },
  { code: "VC-COCOA", name: "Cocoa", category: "Tree crop" },
  { code: "VC-GNUT", name: "Groundnut", category: "Legume" },
  { code: "VC-POULTRY", name: "Poultry", category: "Livestock" },
  { code: "VC-AQUA", name: "Aquaculture", category: "Fisheries" },
];

const UNITS = [
  { code: "KG", name: "Kilogram", dimension: "mass", baseUnitCode: "KG", factorToBase: 1 },
  { code: "MT", name: "Metric Tonne", dimension: "mass", baseUnitCode: "KG", factorToBase: 1000 },
  { code: "BAG50", name: "Bag (50kg)", dimension: "mass", baseUnitCode: "KG", factorToBase: 50 },
  { code: "HA", name: "Hectare", dimension: "area", baseUnitCode: "HA", factorToBase: 1 },
  { code: "ACRE", name: "Acre", dimension: "area", baseUnitCode: "HA", factorToBase: 0.404686 },
  { code: "EA", name: "Each", dimension: "count", baseUnitCode: "EA", factorToBase: 1 },
  { code: "L", name: "Litre", dimension: "volume", baseUnitCode: "L", factorToBase: 1 },
];

const INDICATORS = [
  { code: "AVDP-OUT-001", name: "Farmers reached with AVDP support", shortName: "Farmers Reached", unit: "farmers", resultLevel: "output", calculationRef: "beneficiaries.total", definition: "Unique beneficiaries recorded in published AVDP datasets for the reporting period." },
  { code: "AVDP-OUT-002", name: "Women reached with AVDP support", shortName: "Women Reached", unit: "farmers", resultLevel: "output", calculationRef: "beneficiaries.female", definition: "Unique female beneficiaries in published datasets." },
  { code: "AVDP-OUT-003", name: "Youth reached with AVDP support", shortName: "Youth Reached", unit: "farmers", resultLevel: "output", calculationRef: "beneficiaries.youth", definition: "Unique beneficiaries flagged as youth in published datasets." },
  { code: "AVDP-OUT-004", name: "Participants trained", shortName: "Participants Trained", unit: "participants", resultLevel: "output", calculationRef: "training.participants", definition: "Attendance records from published training datasets." },
  { code: "AVDP-OUT-005", name: "Area under improved production", shortName: "Area Cultivated", unit: "ha", resultLevel: "output", calculationRef: "production.area", definition: "Cultivated area reported in published production datasets." },
  { code: "AVDP-OUT-006", name: "Infrastructure assets delivered", shortName: "Infrastructure Delivered", unit: "assets", resultLevel: "output", calculationRef: "infrastructure.assets", definition: "Assets recorded in published infrastructure datasets." },
  { code: "AVDP-OUC-001", name: "Production volume of supported value chains", shortName: "Production Volume", unit: "MT", resultLevel: "outcome", calculationRef: "production.quantity", definition: "Total production quantity from published production datasets." },
] as const;

function quarters(year: number) {
  return [
    { q: 1, start: `${year}-01-01`, end: `${year}-03-31` },
    { q: 2, start: `${year}-04-01`, end: `${year}-06-30` },
    { q: 3, start: `${year}-07-01`, end: `${year}-09-30` },
    { q: 4, start: `${year}-10-01`, end: `${year}-12-31` },
  ];
}

async function seedPermissionsAndRoles() {
  for (const code of Object.values(PERMISSIONS)) {
    await prisma.permission.upsert({ where: { code }, create: { code }, update: {} });
  }
  for (const role of DEFAULT_ROLES) {
    const created = await prisma.role.upsert({
      where: { code: role.code },
      create: { code: role.code, name: role.name, description: role.description, isSystem: true },
      update: { name: role.name, description: role.description },
    });
    const permissions = await prisma.permission.findMany({ where: { code: { in: role.permissions } } });
    for (const permission of permissions) {
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId: created.id, permissionId: permission.id } },
        create: { roleId: created.id, permissionId: permission.id },
        update: {},
      });
    }
  }
}

async function seedAdminUser() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@avdp.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe!2026";
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  const user = await prisma.user.create({
    data: {
      email,
      fullName: "AVDP Administrator",
      unit: "M&E Unit",
      passwordHash: await bcrypt.hash(password, 12),
      status: "active",
    },
  });
  const role = await prisma.role.findUniqueOrThrow({ where: { code: "administrator" } });
  await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });
  console.log(`Seeded administrator ${email} — change this password immediately.`);
}

async function main() {
  await seedPermissionsAndRoles();
  await seedAdminUser();

  for (const d of DISTRICTS) {
    await prisma.district.upsert({
      where: { code: d.code },
      create: { code: d.code, name: d.name, province: d.province, region: d.province, latitude: d.lat, longitude: d.lon },
      update: { name: d.name, province: d.province, latitude: d.lat, longitude: d.lon },
    });
  }

  for (const vc of VALUE_CHAINS) {
    await prisma.valueChain.upsert({
      where: { code: vc.code },
      create: vc,
      update: { name: vc.name, category: vc.category },
    });
  }

  for (const u of UNITS) {
    await prisma.unitOfMeasure.upsert({ where: { code: u.code }, create: u, update: { name: u.name } });
  }

  const currentYear = new Date().getUTCFullYear();
  for (const year of [currentYear - 1, currentYear]) {
    for (const q of quarters(year)) {
      const code = `${year}-Q${q.q}`;
      const isCurrent =
        year === currentYear && Math.floor(new Date().getUTCMonth() / 3) + 1 === q.q;
      await prisma.reportingPeriod.upsert({
        where: { code },
        create: {
          code,
          name: `Q${q.q} ${year}`,
          periodType: "quarter",
          fiscalYear: year,
          startDate: new Date(q.start),
          endDate: new Date(q.end),
          status: isCurrent ? "open" : year < currentYear ? "closed" : "planned",
        },
        update: {},
      });
    }
    await prisma.reportingPeriod.upsert({
      where: { code: `${year}-ANNUAL` },
      create: {
        code: `${year}-ANNUAL`,
        name: `Annual ${year}`,
        periodType: "year",
        fiscalYear: year,
        startDate: new Date(`${year}-01-01`),
        endDate: new Date(`${year}-12-31`),
        status: year < currentYear ? "closed" : "planned",
      },
      update: {},
    });
  }

  for (const indicator of INDICATORS) {
    await prisma.indicator.upsert({
      where: { code: indicator.code },
      create: {
        code: indicator.code,
        name: indicator.name,
        shortName: indicator.shortName,
        definition: indicator.definition,
        unit: indicator.unit,
        resultLevel: indicator.resultLevel,
        calculationRef: indicator.calculationRef,
        calculationMethod: `Derived from published AVDP datasets via analytics reference "${indicator.calculationRef}".`,
        frequency: "quarterly",
        responsibleUnit: "M&E Unit",
      },
      update: { name: indicator.name, definition: indicator.definition, calculationRef: indicator.calculationRef },
    });
  }

  // Controlled lookup aliases seen in existing AVDP spreadsheets.
  const districtLookup = await prisma.lookupSet.upsert({
    where: { code: "district" },
    create: { code: "district", name: "District aliases", description: "Maps spreadsheet district spellings onto AVDP master data." },
    update: {},
  });
  const aliases: Array<[string, string]> = [
    ["BO DISTRICT", "Bo"], ["BO", "Bo"], ["PORTLOKO", "Port Loko"], ["PORT-LOKO", "Port Loko"],
    ["WESTERN RURAL", "Western Area Rural"], ["WESTERN URBAN", "Western Area Urban"],
    ["WA RURAL", "Western Area Rural"], ["WA URBAN", "Western Area Urban"],
    ["KOINADUGU DISTRICT", "Koinadugu"], ["TONKOLILI DISTRICT", "Tonkolili"],
  ];
  for (const [external, canonical] of aliases) {
    await prisma.lookupValue.upsert({
      where: { lookupSetId_externalValue: { lookupSetId: districtLookup.id, externalValue: external } },
      create: { lookupSetId: districtLookup.id, externalValue: external, canonicalValue: canonical },
      update: { canonicalValue: canonical },
    });
  }

  const sexLookup = await prisma.lookupSet.upsert({
    where: { code: "sex" },
    create: { code: "sex", name: "Sex aliases", description: "Maps inbound sex/gender values onto the canonical enumeration." },
    update: {},
  });
  for (const [external, canonical] of [["M", "male"], ["MALE", "male"], ["F", "female"], ["FEMALE", "female"], ["W", "female"], ["WOMAN", "female"], ["MAN", "male"]] as Array<[string, string]>) {
    await prisma.lookupValue.upsert({
      where: { lookupSetId_externalValue: { lookupSetId: sexLookup.id, externalValue: external } },
      create: { lookupSetId: sexLookup.id, externalValue: external, canonicalValue: canonical },
      update: { canonicalValue: canonical },
    });
  }

  if (process.env.SEED_DEV_FIXTURES === "true") {
    const { seedDevFixtures, seedDevTargets } = await import("./seed-dev-fixtures");
    await seedDevFixtures(prisma);
    await seedDevTargets(prisma);
  }

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
