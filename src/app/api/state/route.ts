import { sql } from "@/db";
import { NextResponse } from "next/server";
import { asAccount, asService } from "@/db/rls";
import { getCurrentAccount, getGuestAccountId } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Single bootstrap payload — everything the client needs, straight from Postgres. */
export async function GET() {
  const account = await getCurrentAccount();
  const hasGuest = (await getGuestAccountId()) !== null;

  const content = await asService(async (tx) => {
    const levels = await tx.query(
      sql`select id, name, sub, par_seconds, deathless_bonus from levels order by sort`,
    );
    const items = await tx.query(
      sql`select id, category, name, blurb, price, consumable from shop_items order by sort`,
    );
    const achs = await tx.query(
      sql`select key, name, description from achievements order by sort`,
    );
    return { levels: levels.rows, items: items.rows, achievements: achs.rows };
  });

  if (!account) {
    return NextResponse.json({ account: null, hasGuest, content });
  }

  const data = await asAccount(account.id, async (tx) => {
    const profile = await tx.query(
      sql`select coins, total_deaths, unlock_boost from profiles where account_id = ${account.id}::uuid`,
    );
    const settings = await tx.query(
      sql`select theme, sound, volume, shake, skin, trail, taunt from settings where account_id = ${account.id}::uuid`,
    );
    const progress = await tx.query(
      sql`select level_id, completed, attempts, best_deaths, best_time_ms
          from level_progress where account_id = ${account.id}::uuid`,
    );
    const owned = await tx.query(
      sql`select item_id, qty from purchases where account_id = ${account.id}::uuid`,
    );
    const unlocked = await tx.query(
      sql`select achievement_key, unlocked_at from account_achievements where account_id = ${account.id}::uuid`,
    );
    return {
      profile: profile.rows[0] ?? null,
      settings: settings.rows[0] ?? null,
      progress: progress.rows,
      owned: owned.rows,
      unlocked: unlocked.rows,
    };
  });

  return NextResponse.json({ account, hasGuest, content, ...data });
}
