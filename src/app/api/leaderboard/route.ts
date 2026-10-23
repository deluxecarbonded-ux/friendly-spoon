import { sql } from "@/db";
import { NextResponse } from "next/server";
import { asService } from "@/db/rls";
import { getCurrentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

const fmt = (ms: number) => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}.${Math.floor((ms % 1000) / 100)}`;
};

/** Public boards. Guest accounts are excluded at the view level. */
export async function GET() {
  const account = await getCurrentAccount();

  const boards = await asService(async (tx) => {
    const cleared = await tx.query(sql`select * from v_leaderboard_cleared`);
    const deaths = await tx.query(sql`select * from v_leaderboard_deaths`);
    const speed = await tx.query(sql`select * from v_leaderboard_speed`);
    return {
      cleared: (cleared.rows as Array<Record<string, unknown>>).map((r) => ({
        accountId: String(r.account_id),
        name: String(r.name),
        value: Number(r.value),
        detail: `${Number(r.total_deaths)} DEATHS`,
      })),
      deaths: (deaths.rows as Array<Record<string, unknown>>).map((r) => ({
        accountId: String(r.account_id),
        name: String(r.name),
        value: Number(r.value),
        detail: `${Number(r.cleared)} CLEARED`,
      })),
      speed: (speed.rows as Array<Record<string, unknown>>).map((r) => ({
        accountId: String(r.account_id),
        name: String(r.name),
        value: Number(r.value),
        detail: fmt(Number(r.value)),
      })),
    };
  });

  return NextResponse.json({
    boards,
    isGuest: account?.isGuest ?? false,
    signedIn: account !== null,
  });
}
