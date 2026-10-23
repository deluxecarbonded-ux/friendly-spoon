import { sql } from "@/db";
import { NextResponse } from "next/server";
import { asAccount, asService } from "@/db/rls";
import { getCurrentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getCurrentAccount();

  const defs = await asService(async (tx) => {
    const r = await tx.query(sql`select key, name, description from achievements order by sort`);
    return r.rows as Array<{ key: string; name: string; description: string }>;
  });

  // Guests have achievements disabled by design — nothing is ever unlocked.
  if (!account || account.isGuest) {
    return NextResponse.json({
      achievements: defs.map((d) => ({ ...d, unlocked: false, unlockedAt: null })),
      disabled: account?.isGuest ?? false,
      signedIn: account !== null,
    });
  }

  const unlocked = await asAccount(account.id, async (tx) => {
    const r = await tx.query(
      sql`select achievement_key, unlocked_at from account_achievements
          where account_id = ${account.id}::uuid`,
    );
    return new Map(
      (r.rows as Array<{ achievement_key: string; unlocked_at: string }>).map((x) => [
        x.achievement_key,
        x.unlocked_at,
      ]),
    );
  });

  return NextResponse.json({
    achievements: defs.map((d) => ({
      ...d,
      unlocked: unlocked.has(d.key),
      unlockedAt: unlocked.get(d.key) ?? null,
    })),
    disabled: false,
    signedIn: true,
  });
}
