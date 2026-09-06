import { NextResponse } from "next/server";
import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { runValidation } from "@/modules/ingestion/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = withPermission(PERMISSIONS.IMPORT_WRITE, async (user, request, params) => {
  const id = params.id;
  const outcome = await runValidation(id);
  await recordAudit(
    user,
    {
      action: "import.validate",
      entityType: "import_job",
      entityId: id,
      summary: `${outcome.status}: ${outcome.errorCount} error(s), ${outcome.warningCount} warning(s)`,
    },
    request,
  );
  return NextResponse.json({ data: outcome });
});
