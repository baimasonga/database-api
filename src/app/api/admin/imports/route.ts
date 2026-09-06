import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { createImportJob, DuplicateImportError } from "@/modules/ingestion/pipeline";
import { UploadRejected } from "@/modules/ingestion/storage";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = withPermission(PERMISSIONS.IMPORT_READ, async (_user, request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status");
  const jobs = await prisma.importJob.findMany({
    where: status ? { status: status as never } : {},
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      dataSource: { select: { name: true, code: true } },
      dataset: { select: { name: true, code: true, domain: true } },
      reportingPeriod: { select: { code: true, name: true } },
      file: { select: { fileName: true, sizeBytes: true } },
    },
  });
  return NextResponse.json({ data: jobs });
});

const uploadSchema = z.object({
  dataSourceId: z.string().uuid(),
  datasetId: z.string().uuid(),
  reportingPeriodId: z.string().uuid(),
});

export const POST = withPermission(PERMISSIONS.IMPORT_WRITE, async (user, request) => {
  const form = await request.formData();
  const parsed = uploadSchema.safeParse({
    dataSourceId: form.get("dataSourceId"),
    datasetId: form.get("datasetId"),
    reportingPeriodId: form.get("reportingPeriodId"),
  });
  if (!parsed.success) return ApiError.badRequest("Select a source, dataset and reporting period.", parsed.error.flatten().fieldErrors);

  const file = form.get("file");
  if (!(file instanceof File)) return ApiError.badRequest("A file is required.");
  if (file.size > env.uploadMaxBytes()) {
    return ApiError.tooLarge(`File exceeds the ${Math.floor(env.uploadMaxBytes() / (1024 * 1024))} MB limit.`);
  }

  const dataset = await prisma.dataset.findUnique({ where: { id: parsed.data.datasetId } });
  if (!dataset || dataset.dataSourceId !== parsed.data.dataSourceId) {
    return ApiError.badRequest("The selected dataset does not belong to the selected data source.");
  }
  const period = await prisma.reportingPeriod.findUnique({ where: { id: parsed.data.reportingPeriodId } });
  if (!period) return ApiError.badRequest("Unknown reporting period.");
  if (period.status === "locked") return ApiError.conflict(`Reporting period ${period.code} is locked.`);

  try {
    const importJobId = await createImportJob({
      ...parsed.data,
      fileName: file.name,
      mimeType: file.type,
      buffer: Buffer.from(await file.arrayBuffer()),
      userId: user.id,
    });
    await recordAudit(
      user,
      { action: "import.create", entityType: "import_job", entityId: importJobId, summary: `${file.name} → ${dataset.code} (${period.code})` },
      request,
    );
    return NextResponse.json({ data: { importJobId } }, { status: 201 });
  } catch (error) {
    if (error instanceof UploadRejected) return ApiError.badRequest(error.message);
    if (error instanceof DuplicateImportError) {
      return ApiError.conflict(error.message, { existingImportJobId: error.existingImportJobId });
    }
    throw error;
  }
});
