import { withPermission } from "@/lib/api/admin";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";
import { readImportFile } from "@/modules/ingestion/pipeline";

export const dynamic = "force-dynamic";

/**
 * Authenticated download of the retained source file. Uploaded files are never
 * reachable through a public URL.
 */
export const GET = withPermission(PERMISSIONS.IMPORT_READ, async (user, request, params) => {
  const id = params.id;
  const file = await readImportFile(id);
  await recordAudit(user, { action: "import.download", entityType: "import_job", entityId: id, summary: file.fileName }, request);

  return new Response(new Uint8Array(file.buffer), {
    headers: {
      "content-type": file.mimeType || "application/octet-stream",
      "content-disposition": `attachment; filename="${file.fileName.replace(/"/g, "")}"`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  }) as never;
});
