import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const updateSchema = z.object({
  name: z.string().trim().min(3).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  ownerUnit: z.string().trim().max(120).nullable().optional(),
  sourceType: z.enum(["excel", "csv", "database", "api", "odk", "kobo", "manual", "gis", "other"]).optional(),
  connectionType: z.enum(["upload", "api", "database", "scheduled", "manual"]).optional(),
  frequency: z.enum(["ad_hoc", "daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"]).optional(),
  status: z.enum(["active", "inactive", "attention_required"]).optional(),
  dataClassification: z.enum(["public", "internal", "confidential", "restricted"]).optional(),
  contactPerson: z.string().trim().max(160).nullable().optional(),
  contactEmail: z.string().trim().max(200).nullable().optional(),
  containsPersonalData: z.boolean().optional(),
  onboardingStatus: z.enum(["discovered", "assessed", "mapped", "tested", "validated", "approved", "live"]).optional(),
  repositoryLocation: z.string().trim().max(500).nullable().optional(),
  notes: z.string().trim().max(2000).nullable().optional(),
});

export const GET = withPermission(PERMISSIONS.SOURCE_READ, async (_user, _request, params) => {
  const id = params.id;
  const source = await prisma.dataSource.findUnique({
    where: { id },
    include: {
      datasets: { orderBy: { name: "asc" } },
      integrations: { select: { id: true, code: true, name: true, connectorType: true, status: true, lastSuccessAt: true, lastFailureAt: true, failureMessage: true } },
      importJobs: {
        orderBy: { createdAt: "desc" },
        take: 25,
        include: { dataset: true, reportingPeriod: true, file: { select: { fileName: true, sizeBytes: true } } },
      },
    },
  });
  if (!source) return ApiError.notFound("Data source not found.");

  const [quality, auditTrail] = await Promise.all([
    prisma.importJob.aggregate({
      where: { dataSourceId: id },
      _sum: { rowCount: true, validRowCount: true, errorRowCount: true, warningRowCount: true },
      _avg: { qualityScore: true },
    }),
    prisma.auditLog.findMany({
      where: { entityType: "data_source", entityId: id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return NextResponse.json({ data: { source, quality, auditTrail } });
});

export const PATCH = withPermission(PERMISSIONS.SOURCE_WRITE, async (user, request, params) => {
  const id = params.id;
  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) return ApiError.badRequest("Invalid update.", parsed.error.flatten().fieldErrors);

  const before = await prisma.dataSource.findUnique({ where: { id } });
  if (!before) return ApiError.notFound("Data source not found.");

  const source = await prisma.dataSource.update({
    where: { id },
    data: { ...parsed.data, updatedBy: user.id },
  });
  await recordAudit(
    user,
    { action: "source.update", entityType: "data_source", entityId: id, summary: source.name, changes: parsed.data },
    request,
  );
  return NextResponse.json({ data: source });
});

/**
 * Soft disable only. A source with import history is never hard-deleted, so
 * published figures stay traceable to their origin.
 */
export const DELETE = withPermission(PERMISSIONS.SOURCE_ARCHIVE, async (user, request, params) => {
  const id = params.id;
  const source = await prisma.dataSource.findUnique({
    where: { id },
    include: { _count: { select: { importJobs: true, datasets: true } } },
  });
  if (!source) return ApiError.notFound("Data source not found.");

  const archived = await prisma.dataSource.update({
    where: { id },
    data: { status: "inactive", archivedAt: new Date(), updatedBy: user.id },
  });
  await recordAudit(
    user,
    {
      action: "source.archive",
      entityType: "data_source",
      entityId: id,
      summary: `Archived ${source.name} (${source._count.importJobs} imports retained)`,
    },
    request,
  );
  return NextResponse.json({ data: archived });
});
