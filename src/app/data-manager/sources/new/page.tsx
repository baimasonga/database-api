import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { PERMISSIONS } from "@/lib/auth/permissions";
import { recordAudit } from "@/lib/audit";

export const dynamic = "force-dynamic";

async function createSource(formData: FormData) {
  "use server";
  const user = await getCurrentUser();
  if (!user?.permissions.includes(PERMISSIONS.SOURCE_WRITE)) redirect("/data-manager/sources");

  const value = (key: string) => {
    const raw = formData.get(key);
    const text = typeof raw === "string" ? raw.trim() : "";
    return text === "" ? null : text;
  };

  const code = (value("code") ?? "").toUpperCase();
  const name = value("name");
  if (!code || !name) redirect("/data-manager/sources/new?error=missing");

  const source = await prisma.dataSource.create({
    data: {
      code,
      name,
      description: value("description"),
      ownerUnit: value("ownerUnit"),
      sourceType: (value("sourceType") ?? "excel") as never,
      connectionType: (value("connectionType") ?? "upload") as never,
      frequency: (value("frequency") ?? "ad_hoc") as never,
      status: (value("status") ?? "active") as never,
      dataClassification: (value("dataClassification") ?? "internal") as never,
      contactPerson: value("contactPerson"),
      contactEmail: value("contactEmail"),
      containsPersonalData: formData.get("containsPersonalData") === "on",
      repositoryLocation: value("repositoryLocation"),
      notes: value("notes"),
      createdBy: user.id,
      updatedBy: user.id,
    },
  });
  await recordAudit(user, { action: "source.create", entityType: "data_source", entityId: source.id, summary: source.name });
  redirect(`/data-manager/sources/${source.id}`);
}

const SOURCE_TYPES = ["excel", "csv", "database", "api", "odk", "kobo", "gis", "manual", "other"];
const CONNECTION_TYPES = ["upload", "api", "database", "scheduled", "manual"];
const FREQUENCIES = ["ad_hoc", "daily", "weekly", "monthly", "quarterly", "semi_annual", "annual"];
const CLASSIFICATIONS = ["public", "internal", "confidential", "restricted"];
const STATUSES = ["active", "inactive", "attention_required"];

function Select({ name, label, options, defaultValue }: { name: string; label: string; options: string[]; defaultValue?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      <select name={name} defaultValue={defaultValue} className="input mt-1 capitalize">
        {options.map((option) => (
          <option key={option} value={option}>
            {option.replace(/_/g, " ")}
          </option>
        ))}
      </select>
    </label>
  );
}

export default async function NewDataSourcePage() {
  const user = await getCurrentUser();
  const canWrite = user?.permissions.includes(PERMISSIONS.SOURCE_WRITE) ?? false;

  return (
    <div className="flex max-w-3xl flex-col gap-6">
      <div>
        <Link href="/data-manager/sources" className="text-xs text-[color:var(--color-avdp-700)] hover:underline">
          ← Data Sources
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight text-[color:var(--color-avdp-900)]">Register data source</h1>
        <p className="mt-1 text-sm text-[color:var(--color-ink-600)]">
          Record the source metadata. External connectors are configured separately under Integrations.
        </p>
      </div>

      {!canWrite ? (
        <p className="card text-sm text-red-700">You do not have permission to register data sources.</p>
      ) : (
        <form action={createSource} className="card grid gap-4 sm:grid-cols-2">
          <label className="block">
            <span className="label">Name</span>
            <input name="name" required maxLength={200} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Code</span>
            <input name="code" required maxLength={50} placeholder="SRC-FARMER-REGISTRY" className="input mt-1 font-mono uppercase" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Description</span>
            <textarea name="description" rows={3} maxLength={2000} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Owning unit</span>
            <input name="ownerUnit" maxLength={120} className="input mt-1" />
          </label>
          <label className="block">
            <span className="label">Responsible officer</span>
            <input name="contactPerson" maxLength={160} className="input mt-1" />
          </label>
          <Select name="sourceType" label="Source type" options={SOURCE_TYPES} defaultValue="excel" />
          <Select name="connectionType" label="Connection type" options={CONNECTION_TYPES} defaultValue="upload" />
          <Select name="frequency" label="Update frequency" options={FREQUENCIES} defaultValue="quarterly" />
          <Select name="dataClassification" label="Data classification" options={CLASSIFICATIONS} defaultValue="internal" />
          <Select name="status" label="Status" options={STATUSES} defaultValue="active" />
          <label className="block">
            <span className="label">Contact email</span>
            <input name="contactEmail" type="email" maxLength={200} className="input mt-1" />
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Repository location</span>
            <input name="repositoryLocation" maxLength={500} className="input mt-1" />
          </label>
          <label className="flex items-center gap-2 sm:col-span-2">
            <input name="containsPersonalData" type="checkbox" className="h-4 w-4" />
            <span className="text-sm">This source contains personal data</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="label">Notes</span>
            <textarea name="notes" rows={2} maxLength={2000} className="input mt-1" />
          </label>
          <div className="sm:col-span-2">
            <button type="submit" className="btn-primary">
              Register source
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
