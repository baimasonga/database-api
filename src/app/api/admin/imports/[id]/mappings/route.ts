import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { CANONICAL_FIELD_MAP } from "@/modules/mapping/canonical-fields";
import { transformationsSchema } from "@/modules/mapping/transformations";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  mappings: z
    .array(
      z.object({
        sourceColumn: z.string().min(1),
        canonicalField: z.string().nullable(),
        isRequired: z.boolean().default(false),
        transformations: transformationsSchema.default([]),
      }),
    )
    .max(500),
  saveAsTemplate: z.object({ code: z.string().trim().min(3).max(60), name: z.string().trim().min(3).max(120) }).optional(),
});

export const PUT = withPermission(PERMISSIONS.MAPPING_WRITE, async (user, request, params) => {
  const id = params.id;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return ApiError.badRequest("Invalid mapping.", parsed.error.flatten().fieldErrors);

  const job = await prisma.importJob.findUnique({ where: { id }, include: { dataset: true } });
  if (!job) return ApiError.notFound("Import job not found.");
  if (["published", "approved"].includes(job.status)) {
    return ApiError.conflict("Mappings cannot be changed after approval.");
  }

  const unknown = parsed.data.mappings
    .map((m) => m.canonicalField)
    .filter((f): f is string => !!f)
    .filter((f) => !CANONICAL_FIELD_MAP.has(f));
  if (unknown.length > 0) return ApiError.badRequest(`Unknown canonical field(s): ${unknown.join(", ")}.`);

  await prisma.$transaction(async (tx) => {
    for (const mapping of parsed.data.mappings) {
      await tx.importFieldMapping.update({
        where: { importJobId_sourceColumn: { importJobId: id, sourceColumn: mapping.sourceColumn } },
        data: {
          canonicalField: mapping.canonicalField,
          isRequired: mapping.isRequired,
          transformations: mapping.transformations,
          status: mapping.canonicalField ? "mapped" : "unmapped",
        },
      });
    }

    if (parsed.data.saveAsTemplate) {
      const template = await tx.mappingTemplate.upsert({
        where: { code: parsed.data.saveAsTemplate.code },
        create: {
          code: parsed.data.saveAsTemplate.code,
          name: parsed.data.saveAsTemplate.name,
          datasetId: job.datasetId,
          targetEntity: job.dataset.domain,
          createdBy: user.id,
        },
        update: { name: parsed.data.saveAsTemplate.name, datasetId: job.datasetId, isActive: true },
      });
      await tx.mappingTemplateField.deleteMany({ where: { mappingTemplateId: template.id } });
      await tx.mappingTemplateField.createMany({
        data: parsed.data.mappings
          .filter((m) => m.canonicalField)
          .map((m) => ({
            mappingTemplateId: template.id,
            sourceColumn: m.sourceColumn,
            canonicalField: m.canonicalField!,
            isRequired: m.isRequired,
            transformations: m.transformations,
          })),
      });
    }
  });

  await recordAudit(
    user,
    { action: "mapping.update", entityType: "import_job", entityId: id, summary: `${parsed.data.mappings.length} column mappings saved` },
    request,
  );
  return NextResponse.json({ data: { updated: parsed.data.mappings.length } });
});
