import "server-only";
import { Prisma, type PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";
import { formatBeneficiaryReference } from "@/modules/identity/reference";
import { findMatches, type IdentityRecord } from "@/modules/identity/matching";

type Tx = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
type Values = Record<string, string | number | boolean | null>;

function text(values: Values, key: string): string | null {
  const value = values[key];
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

function num(values: Values, key: string): number | null {
  const value = values[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function bool(values: Values, key: string): boolean | null {
  const value = values[key];
  return typeof value === "boolean" ? value : null;
}

function dec(value: number | null): Prisma.Decimal | null {
  return value === null ? null : new Prisma.Decimal(value);
}

async function nextBeneficiaryReference(tx: Tx): Promise<string> {
  const count = await tx.beneficiary.count({ where: { avdpReference: { not: null } } });
  return formatBeneficiaryReference(count + 1, env.beneficiaryRefFormat(), env.beneficiaryRefSeqWidth());
}

interface GeoIds {
  districtId: string | null;
  chiefdomId: string | null;
  communityId: string | null;
}

async function resolveGeography(tx: Tx, values: Values): Promise<GeoIds> {
  const districtName = text(values, "geography.district");
  const chiefdomName = text(values, "geography.chiefdom");
  const communityName = text(values, "geography.community");

  const district = districtName
    ? await tx.district.findFirst({ where: { name: { equals: districtName, mode: "insensitive" } } })
    : null;
  const chiefdom =
    chiefdomName && district
      ? await tx.chiefdom.findFirst({
          where: { districtId: district.id, name: { equals: chiefdomName, mode: "insensitive" } },
        })
      : null;
  const community =
    communityName && district
      ? await tx.community.findFirst({
          where: { districtId: district.id, name: { equals: communityName, mode: "insensitive" } },
        })
      : null;

  return { districtId: district?.id ?? null, chiefdomId: chiefdom?.id ?? null, communityId: community?.id ?? null };
}

async function resolveValueChainId(tx: Tx, values: Values): Promise<string | null> {
  const name = text(values, "value_chain.name");
  if (!name) return null;
  const vc = await tx.valueChain.findFirst({
    where: { OR: [{ name: { equals: name, mode: "insensitive" } }, { code: { equals: name, mode: "insensitive" } }] },
  });
  return vc?.id ?? null;
}

/**
 * Resolves a row to a canonical beneficiary. Deterministic matches link to the
 * existing record; probable matches create a review item and never merge.
 */
async function upsertBeneficiary(
  tx: Tx,
  values: Values,
  ctx: { importJobId: string; reportingPeriodId: string; userId: string | null; geo: GeoIds },
): Promise<string | null> {
  const fullName = text(values, "beneficiary.full_name");
  if (!fullName) return null;

  const identifiers: IdentityRecord["identifiers"] = [];
  const nationalId = text(values, "beneficiary.national_id");
  const projectId = text(values, "beneficiary.project_id");
  const externalId = text(values, "beneficiary.external_source_id");
  const membershipId = text(values, "beneficiary.group_membership_id");
  if (nationalId) identifiers.push({ type: "national_id", value: nationalId, trusted: true });
  if (projectId) identifiers.push({ type: "project_id", value: projectId, trusted: true });
  if (membershipId) identifiers.push({ type: "group_membership_id", value: membershipId, trusted: true });
  if (externalId) identifiers.push({ type: "external_source_id", value: externalId, source: ctx.importJobId });

  const phone = text(values, "beneficiary.phone");
  const districtName = text(values, "geography.district");
  const dob = text(values, "beneficiary.date_of_birth");

  // Candidate pool: same district or a shared identifier value.
  const candidates = await tx.beneficiary.findMany({
    where: {
      status: { not: "merged" },
      OR: [
        identifiers.length > 0 ? { identifiers: { some: { value: { in: identifiers.map((i) => i.value) } } } } : {},
        ctx.geo.districtId ? { locations: { some: { districtId: ctx.geo.districtId } } } : {},
      ].filter((clause) => Object.keys(clause).length > 0),
    },
    include: { identifiers: true, locations: { include: { district: true } } },
    take: 500,
  });

  const incoming: IdentityRecord = {
    id: "incoming",
    fullName,
    phone,
    dateOfBirth: dob,
    districtName,
    identifiers,
  };
  const existing: IdentityRecord[] = candidates.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    dateOfBirth: c.dateOfBirth ? c.dateOfBirth.toISOString().slice(0, 10) : null,
    districtName: c.locations[0]?.district?.name ?? null,
    identifiers: c.identifiers.map((i) => ({ type: i.identifierType, value: i.value, source: i.issuingSource })),
  }));

  const matches = findMatches(incoming, existing);
  const deterministic = matches.find((m) => m.matchType === "deterministic");

  let beneficiaryId: string;
  if (deterministic) {
    beneficiaryId = deterministic.candidateId;
    await tx.beneficiary.update({
      where: { id: beneficiaryId },
      data: {
        phone: phone ?? undefined,
        sex: (text(values, "beneficiary.sex") as never) ?? undefined,
        updatedBy: ctx.userId,
      },
    });
  } else {
    const created = await tx.beneficiary.create({
      data: {
        fullName,
        firstName: text(values, "beneficiary.first_name"),
        lastName: text(values, "beneficiary.last_name"),
        sex: (text(values, "beneficiary.sex") as never) ?? "unknown",
        dateOfBirth: dob ? new Date(dob) : null,
        ageGroup: text(values, "beneficiary.age_group"),
        phone,
        beneficiaryType: text(values, "beneficiary.beneficiary_type"),
        isYouth: bool(values, "beneficiary.is_youth"),
        disability: bool(values, "beneficiary.disability"),
        status: "confirmed",
        avdpReference: await nextBeneficiaryReference(tx),
        sourceImportJobId: ctx.importJobId,
        firstSeenPeriodId: ctx.reportingPeriodId,
        createdBy: ctx.userId,
      },
    });
    beneficiaryId = created.id;

    if (phone) identifiers.push({ type: "phone", value: phone });
    for (const identifier of identifiers) {
      await tx.beneficiaryIdentifier.upsert({
        where: {
          identifierType_value_issuingSource: {
            identifierType: identifier.type as never,
            value: identifier.value,
            issuingSource: identifier.source ?? "",
          },
        },
        create: {
          beneficiaryId,
          identifierType: identifier.type as never,
          value: identifier.value,
          issuingSource: identifier.source ?? "",
          isTrusted: identifier.trusted ?? false,
        },
        update: {},
      });
    }

    if (ctx.geo.districtId || ctx.geo.chiefdomId || ctx.geo.communityId) {
      await tx.beneficiaryLocation.create({
        data: {
          beneficiaryId,
          districtId: ctx.geo.districtId,
          chiefdomId: ctx.geo.chiefdomId,
          communityId: ctx.geo.communityId,
          latitude: dec(num(values, "geography.latitude")),
          longitude: dec(num(values, "geography.longitude")),
          isPrimary: true,
        },
      });
    }
  }

  // Probable matches always go to human review — never auto-merged.
  for (const probable of matches.filter((m) => m.matchType === "probable").slice(0, 3)) {
    if (probable.candidateId === beneficiaryId) continue;
    await tx.duplicateCandidate.upsert({
      where: {
        primaryId_candidateId_ruleCode: {
          primaryId: probable.candidateId,
          candidateId: beneficiaryId,
          ruleCode: probable.ruleCode,
        },
      },
      create: {
        primaryId: probable.candidateId,
        candidateId: beneficiaryId,
        matchType: "probable",
        ruleCode: probable.ruleCode,
        score: new Prisma.Decimal(probable.score),
        evidence: probable.evidence as Prisma.InputJsonValue,
      },
      update: {},
    });
  }

  const valueChainId = await resolveValueChainId(tx, values);
  if (valueChainId) {
    await tx.beneficiaryValueChain.upsert({
      where: { beneficiaryId_valueChainId: { beneficiaryId, valueChainId } },
      create: { beneficiaryId, valueChainId, isPrimary: true },
      update: {},
    });
  }

  return beneficiaryId;
}

export interface MaterialiseResult {
  beneficiariesCreated: number;
  recordsWritten: number;
}

/**
 * Writes validated rows into the core data layer. Only rows with no
 * error-severity findings are materialised; the rest stay in the raw layer
 * with their validation results intact.
 */
export async function materialiseImport(
  tx: Tx,
  importJobId: string,
  userId: string | null,
): Promise<MaterialiseResult> {
  const job = await tx.importJob.findUniqueOrThrow({
    where: { id: importJobId },
    include: { dataset: true },
  });
  const rows = await tx.importRow.findMany({
    where: { importJobId, isValid: true },
    orderBy: { rowNumber: "asc" },
  });

  const before = await tx.beneficiary.count();
  let recordsWritten = 0;

  for (const row of rows) {
    const values = (row.mappedData ?? {}) as Values;
    const geo = await resolveGeography(tx, values);
    const valueChainId = await resolveValueChainId(tx, values);
    const beneficiaryId = await upsertBeneficiary(tx, values, {
      importJobId,
      reportingPeriodId: job.reportingPeriodId,
      userId,
      geo,
    });

    switch (job.dataset.domain) {
      case "training": {
        const title = text(values, "training.title") ?? job.dataset.name;
        const event = await tx.trainingEvent.upsert({
          where: { code: `${importJobId}:${title}`.slice(0, 190) },
          create: {
            code: `${importJobId}:${title}`.slice(0, 190),
            title,
            trainingType: text(values, "training.type"),
            reportingPeriodId: job.reportingPeriodId,
            districtId: geo.districtId,
            chiefdomId: geo.chiefdomId,
            valueChainId,
            durationDays: dec(num(values, "training.duration_days")),
            startDate: text(values, "training.start_date") ? new Date(text(values, "training.start_date")!) : null,
            endDate: text(values, "training.end_date") ? new Date(text(values, "training.end_date")!) : null,
            sourceImportJobId: importJobId,
          },
          update: {},
        });
        if (beneficiaryId) {
          await tx.trainingAttendance.upsert({
            where: { trainingEventId_beneficiaryId: { trainingEventId: event.id, beneficiaryId } },
            create: {
              trainingEventId: event.id,
              beneficiaryId,
              attended: bool(values, "training.attended") ?? true,
              certified: bool(values, "training.certified") ?? false,
            },
            update: {},
          });
        }
        recordsWritten += 1;
        break;
      }
      case "production": {
        if (!valueChainId) break;
        await tx.productionRecord.create({
          data: {
            beneficiaryId,
            valueChainId,
            reportingPeriodId: job.reportingPeriodId,
            districtId: geo.districtId,
            season: text(values, "production.season"),
            cultivatedAreaHa: dec(num(values, "production.cultivated_area_ha")),
            quantity: dec(num(values, "production.quantity")),
            sourceImportJobId: importJobId,
          },
        });
        recordsWritten += 1;
        break;
      }
      case "infrastructure": {
        const name = text(values, "infrastructure.name") ?? `${job.dataset.code}-${row.rowNumber}`;
        await tx.infrastructureAsset.upsert({
          where: { code: `${importJobId}:${row.rowNumber}`.slice(0, 190) },
          create: {
            code: `${importJobId}:${row.rowNumber}`.slice(0, 190),
            name,
            assetType: text(values, "infrastructure.asset_type") ?? "unspecified",
            status: text(values, "infrastructure.status"),
            districtId: geo.districtId,
            chiefdomId: geo.chiefdomId,
            communityId: geo.communityId,
            valueChainId,
            reportingPeriodId: job.reportingPeriodId,
            quantity: dec(num(values, "infrastructure.quantity")),
            completionPercent: dec(num(values, "infrastructure.completion_percent")),
            beneficiariesServed: num(values, "infrastructure.beneficiaries_served"),
            latitude: dec(num(values, "geography.latitude")),
            longitude: dec(num(values, "geography.longitude")),
            sourceImportJobId: importJobId,
          },
          update: {},
        });
        recordsWritten += 1;
        break;
      }
      default:
        // beneficiaries / other: the beneficiary record itself is the output.
        if (beneficiaryId) recordsWritten += 1;
        break;
    }
  }

  const after = await tx.beneficiary.count();
  return { beneficiariesCreated: after - before, recordsWritten };
}
