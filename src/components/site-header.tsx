import Link from "next/link";
import { env } from "@/lib/env";
import { Badge } from "./ui";

export function SiteHeader({ current }: { current: "dashboard" | "manager" }) {
  const mode = env.dataMode();
  return (
    <header className="border-b border-[color:var(--color-line)] bg-[color:var(--color-avdp-900)] text-white">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-6 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded bg-[color:var(--color-gold-500)] text-sm font-bold text-[color:var(--color-avdp-900)]">
            A
          </span>
          <span className="text-sm font-semibold leading-tight">
            AVDP
            <span className="block text-xs font-normal text-white/70">Data &amp; Analytics Platform</span>
          </span>
        </Link>

        <nav className="ml-4 flex items-center gap-1 text-sm">
          <Link
            href="/"
            className={`rounded px-3 py-1.5 ${current === "dashboard" ? "bg-white/15 font-medium" : "text-white/80 hover:bg-white/10"}`}
          >
            Dashboard
          </Link>
          <Link
            href="/data-manager"
            className={`rounded px-3 py-1.5 ${current === "manager" ? "bg-white/15 font-medium" : "text-white/80 hover:bg-white/10"}`}
          >
            Data Manager
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <Badge tone={mode === "live" ? "success" : "gold"}>
            {mode === "live" ? "Live data" : "Mock data"}
          </Badge>
        </div>
      </div>
    </header>
  );
}
