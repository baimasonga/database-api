import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Liveness and readiness probe.
 *
 * Reports database reachability, because an AVDP instance that cannot reach
 * PostgreSQL can serve no dashboard figure and should not receive traffic.
 * Deliberately unauthenticated and free of any detail an attacker could use:
 * no versions, hostnames or error text.
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json(
      { status: "ok", database: "reachable", checked_at: new Date().toISOString() },
      { headers: { "cache-control": "no-store" } },
    );
  } catch {
    return NextResponse.json(
      { status: "degraded", database: "unreachable", checked_at: new Date().toISOString() },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
