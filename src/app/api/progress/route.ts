import { sql } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import { asAccount } from "@/db/rls";
import { getCurrentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Submit a run. All rewards/achievements are computed by fn_submit_run in SQL. */
export async function POST(req: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const levelId = Number(b.levelId ?? 0);
  if (!Number.isInteger(levelId) || levelId <= 0) {
    return NextResponse.json({ error: "invalid level" }, { status: 400 });
  }

  const result = await asAccount(account.id, async (tx) => {
    const r = await tx.query(sql`
      select fn_submit_run(
        ${account.id}::uuid,
        ${levelId}::int,
        ${b.won === true}::boolean,
        ${Number(b.runDeaths ?? 0)}::int,
        ${Number(b.timeMs ?? 0)}::int,
        ${Number(b.coins ?? 0)}::int
      ) as result`);
    return (r.rows[0] as { result: unknown }).result;
  });

  return NextResponse.json({ ...(result as object), isGuest: account.isGuest });
}
