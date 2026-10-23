import { sql } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import { asAccount } from "@/db/rls";
import { getCurrentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

const THEMES = new Set(["light", "dark"]);

export async function PATCH(req: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;

  const theme = typeof b.theme === "string" && THEMES.has(b.theme) ? b.theme : null;
  const sound = typeof b.sound === "boolean" ? b.sound : null;
  const volume =
    typeof b.volume === "number" ? Math.max(0, Math.min(100, Math.round(b.volume))) : null;
  const shake = typeof b.shake === "boolean" ? b.shake : null;
  const skin = typeof b.skin === "string" ? b.skin : null;
  const trail = typeof b.trail === "string" ? b.trail : null;
  const taunt = typeof b.taunt === "string" ? b.taunt : null;

  const row = await asAccount(account.id, async (tx) => {
    // cosmetics may only be equipped if actually owned (price 0 items are free)
    for (const [val, kind] of [
      [skin, "skin"],
      [trail, "trail"],
      [taunt, "taunt"],
    ] as const) {
      if (!val) continue;
      const r = await tx.query(sql`
        select 1 from shop_items si
        where si.id = ${val} and si.category = ${kind}
          and (si.price = 0 or exists (
            select 1 from purchases p
            where p.account_id = ${account.id}::uuid and p.item_id = si.id and p.qty > 0))
        limit 1`);
      if (r.rows.length === 0) {
        throw new Error(`not owned: ${val}`);
      }
    }

    const res = await tx.query(sql`
      update settings set
        theme  = coalesce(${theme}, theme),
        sound  = coalesce(${sound}, sound),
        volume = coalesce(${volume}, volume),
        shake  = coalesce(${shake}, shake),
        skin   = coalesce(${skin}, skin),
        trail  = coalesce(${trail}, trail),
        taunt  = coalesce(${taunt}, taunt),
        updated_at = now()
      where account_id = ${account.id}::uuid
      returning theme, sound, volume, shake, skin, trail, taunt`);
    return res.rows[0] ?? null;
  }).catch((e: Error) => ({ error: e.message }) as const);

  if (row && "error" in row) {
    return NextResponse.json({ error: row.error }, { status: 400 });
  }
  return NextResponse.json({ settings: row });
}
