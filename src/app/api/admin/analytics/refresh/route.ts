import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { refreshAnalytics } from "@/modules/analytics/refresh";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withPermission(PERMISSIONS.ANALYTICS_REFRESH, async (user, request) => {
  const outcomes = await refreshAnalytics(user.id, "manual");
  const failed = outcomes.filter((o) => o.status === "failed");
  await recordAudit(
    user,
    {
      action: "analytics.refresh",
      entityType: "analytics",
      summary: `${outcomes.length - failed.length}/${outcomes.length} views refreshed`,
      changes: outcomes,
    },
    request,
  );
  return NextResponse.json({ data: outcomes }, { status: failed.length > 0 ? 207 : 200 });
});
