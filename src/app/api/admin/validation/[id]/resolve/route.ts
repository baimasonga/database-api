import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  resolution: z.enum(["corrected_at_source", "accepted_with_warning", "not_an_issue", "record_excluded"]),
  comment: z.string().trim().max(1000).optional(),
});

/**
 * Records a human decision on a validation finding. Resolving never rewrites
 * the underlying raw value — corrections happen at the source and are
 * re-imported.
 */
export const POST = withPermission(PERMISSIONS.QUALITY_RESOLVE, async (user, request, params) => {
  const id = params.id;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return ApiError.badRequest("Invalid resolution.", parsed.error.flatten().fieldErrors);

  const finding = await prisma.validationResult.findUnique({ where: { id } });
  if (!finding) return ApiError.notFound("Validation finding not found.");

  const resolution = [parsed.data.resolution, parsed.data.comment].filter(Boolean).join(": ");
  const updated = await prisma.validationResult.update({
    where: { id },
    data: { resolved: true, resolution, resolvedBy: user.id, resolvedAt: new Date() },
  });

  // A cleared error may unblock the import; recompute the outstanding count.
  const remainingErrors = await prisma.validationResult.count({
    where: { importJobId: finding.importJobId, severity: "error", resolved: false },
  });
  if (remainingErrors === 0) {
    await prisma.importJob.updateMany({
      where: { id: finding.importJobId, status: "validation_failed" },
      data: { status: "ready_for_review" },
    });
  }

  await recordAudit(
    user,
    {
      action: "quality.resolve",
      entityType: "validation_result",
      entityId: id,
      summary: `${finding.ruleCode} row ${finding.rowNumber ?? "-"}: ${parsed.data.resolution}`,
    },
    request,
  );
  return NextResponse.json({ data: { finding: updated, remainingErrors } });
});
