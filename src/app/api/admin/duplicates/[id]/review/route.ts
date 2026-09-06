import { NextResponse } from "next/server";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ApiError } from "@/lib/api/envelope";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  decision: z.enum(["merge", "reject"]),
  /** Which of the pair survives; defaults to the primary record. */
  survivor: z.enum(["primary", "candidate"]).default("primary"),
  comment: z.string().trim().max(1000).optional(),
});

/**
 * Human review of a potential duplicate. A merge preserves the full source
 * lineage: the merged record is retained, its identifiers are retired rather
 * than deleted, and a snapshot is written to the merge history.
 */
export const POST = withPermission(PERMISSIONS.BENEFICIARY_MERGE, async (user, request, params) => {
  const id = params.id;
  const parsed = bodySchema.safeParse(await request.json());
  if (!parsed.success) return ApiError.badRequest("Invalid review decision.", parsed.error.flatten().fieldErrors);

  const candidate = await prisma.duplicateCandidate.findUnique({
    where: { id },
    include: {
      primary: { include: { identifiers: true, locations: true } },
      candidate: { include: { identifiers: true, locations: true } },
    },
  });
  if (!candidate) return ApiError.notFound("Duplicate candidate not found.");
  if (candidate.status !== "pending") return ApiError.conflict("This candidate has already been reviewed.");

  if (parsed.data.decision === "reject") {
    const updated = await prisma.duplicateCandidate.update({
      where: { id },
      data: { status: "rejected", reviewedBy: user.id, reviewedAt: new Date(), reviewComment: parsed.data.comment },
    });
    await recordAudit(user, { action: "duplicate.reject", entityType: "duplicate_candidate", entityId: id }, request);
    return NextResponse.json({ data: updated });
  }

  const survivor = parsed.data.survivor === "primary" ? candidate.primary : candidate.candidate;
  const merged = parsed.data.survivor === "primary" ? candidate.candidate : candidate.primary;
  if (survivor.id === merged.id) return ApiError.badRequest("A record cannot be merged into itself.");

  await prisma.$transaction(async (tx) => {
    await tx.beneficiaryMerge.create({
      data: {
        survivorId: survivor.id,
        mergedId: merged.id,
        matchType: candidate.matchType,
        ruleCode: candidate.ruleCode,
        decision: parsed.data.comment ?? "Confirmed duplicate on review.",
        reviewerId: user.id,
        mergedSnapshot: JSON.parse(JSON.stringify(merged)) as Prisma.InputJsonValue,
        retiredIdentifiers: JSON.parse(JSON.stringify(merged.identifiers)) as Prisma.InputJsonValue,
      },
    });

    // Move relationships onto the survivor, keeping the merged record intact.
    await tx.beneficiaryIdentifier.updateMany({
      where: { beneficiaryId: merged.id },
      data: { retiredAt: new Date() },
    });
    await tx.activityParticipant.updateMany({ where: { beneficiaryId: merged.id }, data: { beneficiaryId: survivor.id } });
    await tx.inputDistribution.updateMany({ where: { beneficiaryId: merged.id }, data: { beneficiaryId: survivor.id } });
    await tx.productionRecord.updateMany({ where: { beneficiaryId: merged.id }, data: { beneficiaryId: survivor.id } });
    await tx.harvestRecord.updateMany({ where: { beneficiaryId: merged.id }, data: { beneficiaryId: survivor.id } });
    await tx.salesRecord.updateMany({ where: { beneficiaryId: merged.id }, data: { beneficiaryId: survivor.id } });

    await tx.beneficiary.update({
      where: { id: merged.id },
      data: { status: "merged", mergedIntoId: survivor.id, updatedBy: user.id },
    });
    await tx.duplicateCandidate.update({
      where: { id },
      data: { status: "merged", reviewedBy: user.id, reviewedAt: new Date(), reviewComment: parsed.data.comment },
    });
  });

  await recordAudit(
    user,
    {
      action: "beneficiary.merge",
      entityType: "beneficiary",
      entityId: survivor.id,
      summary: `Merged ${merged.avdpReference ?? merged.id} into ${survivor.avdpReference ?? survivor.id}`,
    },
    request,
  );
  return NextResponse.json({ data: { survivorId: survivor.id, mergedId: merged.id } });
});
