/**
 * Development fixtures only. Never imported by a production migration or the
 * default seed path — enable with SEED_DEV_FIXTURES=true.
 */
import type { PrismaClient } from "@prisma/client";

export async function seedDevFixtures(prisma: PrismaClient): Promise<void> {
  const [source] = await Promise.all([
    prisma.dataSource.upsert({
      where: { code: "SRC-FARMER-REGISTRY" },
      create: {
        code: "SRC-FARMER-REGISTRY",
        name: "AVDP Farmer Registry",
        description: "Consolidated farmer registration spreadsheets maintained by the field teams.",
        ownerUnit: "M&E Unit",
        sourceType: "excel",
        connectionType: "upload",
        frequency: "quarterly",
        status: "active",
        dataClassification: "confidential",
        contactPerson: "M&E Officer",
        containsPersonalData: true,
        onboardingStatus: "assessed",
        repositoryLocation: "AVDP shared drive / M&E / Farmer Registry",
      },
      update: {},
    }),
    prisma.dataSource.upsert({
      where: { code: "SRC-TRAINING-RECORDS" },
      create: {
        code: "SRC-TRAINING-RECORDS",
        name: "Training Attendance Records",
        description: "Attendance sheets digitised by implementing partners.",
        ownerUnit: "Capacity Development",
        sourceType: "csv",
        connectionType: "upload",
        frequency: "monthly",
        status: "attention_required",
        dataClassification: "internal",
        containsPersonalData: true,
        onboardingStatus: "discovered",
      },
      update: {},
    }),
    prisma.dataSource.upsert({
      where: { code: "SRC-INFRASTRUCTURE" },
      create: {
        code: "SRC-INFRASTRUCTURE",
        name: "Infrastructure Delivery Tracker",
        description: "Civil works progress tracker maintained by the engineering unit.",
        ownerUnit: "Infrastructure Unit",
        sourceType: "excel",
        connectionType: "upload",
        frequency: "quarterly",
        status: "active",
        dataClassification: "internal",
        onboardingStatus: "mapped",
      },
      update: {},
    }),
  ]);

  await prisma.dataset.upsert({
    where: { code: "DS-FARMER-REGISTRY" },
    create: {
      dataSourceId: source.id,
      code: "DS-FARMER-REGISTRY",
      name: "Farmer Registry",
      description: "One row per registered farmer with geography and value chain.",
      domain: "beneficiaries",
      ownerUnit: "M&E Unit",
      primaryIdentifier: "beneficiary.project_id",
      frequency: "quarterly",
      onboardingStatus: "assessed",
    },
    update: {},
  });

  const trainingSource = await prisma.dataSource.findUniqueOrThrow({ where: { code: "SRC-TRAINING-RECORDS" } });
  await prisma.dataset.upsert({
    where: { code: "DS-TRAINING-ATTENDANCE" },
    create: {
      dataSourceId: trainingSource.id,
      code: "DS-TRAINING-ATTENDANCE",
      name: "Training Attendance",
      description: "One row per participant per training event.",
      domain: "training",
      ownerUnit: "Capacity Development",
      frequency: "monthly",
    },
    update: {},
  });

  const infraSource = await prisma.dataSource.findUniqueOrThrow({ where: { code: "SRC-INFRASTRUCTURE" } });
  await prisma.dataset.upsert({
    where: { code: "DS-INFRASTRUCTURE" },
    create: {
      dataSourceId: infraSource.id,
      code: "DS-INFRASTRUCTURE",
      name: "Infrastructure Assets",
      description: "One row per delivered or ongoing infrastructure asset.",
      domain: "infrastructure",
      ownerUnit: "Infrastructure Unit",
      frequency: "quarterly",
    },
    update: {},
  });

  console.log("Development fixtures seeded (data sources and datasets only).");
}

/**
 * Optional indicator targets for development. Targets are planning values, not
 * observed results, and are only seeded alongside the other dev fixtures.
 */
export async function seedDevTargets(prisma: PrismaClient): Promise<void> {
  const period = await prisma.reportingPeriod.findFirst({ where: { status: "open" }, orderBy: { startDate: "desc" } });
  if (!period) return;

  const targets: Array<[string, number]> = [
    ["AVDP-OUT-001", 30000],
    ["AVDP-OUT-002", 15000],
    ["AVDP-OUT-003", 9000],
    ["AVDP-OUT-004", 22000],
    ["AVDP-OUT-005", 18000],
    ["AVDP-OUT-006", 240],
    ["AVDP-OUC-001", 52000],
  ];

  for (const [code, value] of targets) {
    const indicator = await prisma.indicator.findUnique({ where: { code } });
    if (!indicator) continue;
    // A composite unique containing NULLs cannot be addressed via upsert.
    const existing = await prisma.indicatorTarget.findFirst({
      where: { indicatorId: indicator.id, reportingPeriodId: period.id, districtId: null, valueChainId: null },
    });
    if (existing) {
      await prisma.indicatorTarget.update({ where: { id: existing.id }, data: { targetValue: value } });
    } else {
      await prisma.indicatorTarget.create({
        data: { indicatorId: indicator.id, reportingPeriodId: period.id, fiscalYear: period.fiscalYear, targetValue: value },
      });
    }
  }
  console.log("Development indicator targets seeded.");
}
