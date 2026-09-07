import Link from "next/link";

export const dynamic = "force-dynamic";

export default function AccessDeniedPage() {
  return (
    <div className="card max-w-lg">
      <h1 className="text-lg font-semibold text-[color:var(--color-avdp-900)]">Access denied</h1>
      <p className="mt-2 text-sm text-[color:var(--color-ink-600)]">
        Your role does not include permission for this area of the AVDP Data Manager. If you need it for your work, ask
        an administrator to review your role assignment.
      </p>
      <Link href="/data-manager" className="btn-secondary mt-4">
        Back to the dashboard
      </Link>
    </div>
  );
}
