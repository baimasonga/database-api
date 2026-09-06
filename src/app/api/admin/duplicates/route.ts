import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

export const GET = withPermission(PERMISSIONS.BENEFICIARY_READ, async (_user, request) => {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";
  const candidates = await prisma.duplicateCandidate.findMany({
    where: { status: status as never },
    orderBy: [{ matchType: "asc" }, { score: "desc" }],
    take: 200,
    include: {
      primary: { select: { id: true, avdpReference: true, fullName: true, sex: true, phone: true } },
      candidate: { select: { id: true, avdpReference: true, fullName: true, sex: true, phone: true } },
    },
  });
  return NextResponse.json({ data: candidates });
});
