import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { SiteHeader } from "@/components/site-header";
import { logoutAction } from "@/app/login/actions";

const NAV = [
  { href: "/data-manager", label: "Dashboard" },
  { href: "/data-manager/sources", label: "Data Sources" },
  { href: "/data-manager/datasets", label: "Datasets" },
  { href: "/data-manager/imports", label: "Imports" },
  { href: "/data-manager/quality", label: "Data Quality" },
  { href: "/data-manager/duplicates", label: "Beneficiary Identity" },
  { href: "/data-manager/master-data", label: "Master Data" },
  { href: "/data-manager/indicators", label: "Indicators" },
  { href: "/data-manager/periods", label: "Reporting Periods" },
  { href: "/data-manager/approvals", label: "Approval Workflow" },
  { href: "/data-manager/published", label: "Published Data" },
  { href: "/data-manager/integrations", label: "Integrations" },
  { href: "/data-manager/audit", label: "Audit Logs" },
  { href: "/data-manager/administration", label: "Administration" },
];

export default async function DataManagerLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="min-h-screen">
      <SiteHeader current="manager" />
      <div className="mx-auto flex max-w-7xl gap-6 px-6 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <nav className="flex flex-col gap-0.5 text-sm">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-3 py-1.5 text-[color:var(--color-ink-600)] hover:bg-white hover:text-[color:var(--color-avdp-800)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 border-t border-[color:var(--color-line)] pt-4 text-xs text-[color:var(--color-ink-600)]">
            <p className="font-medium text-[color:var(--color-ink-900)]">{user.fullName}</p>
            <p>{user.email}</p>
            <p className="mt-1">{user.roles.join(", ") || "No role assigned"}</p>
            <form action={logoutAction} className="mt-3">
              <button type="submit" className="text-[color:var(--color-avdp-700)] hover:underline">
                Sign out
              </button>
            </form>
          </div>
        </aside>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
