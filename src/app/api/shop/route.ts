import { sql } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import { asAccount, asService } from "@/db/rls";
import { getCurrentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  const account = await getCurrentAccount();
  const items = await asService(async (tx) => {
    const r = await tx.query(
      sql`select id, category, name, blurb, price, consumable from shop_items order by sort`,
    );
    return r.rows;
  });
  if (!account) return NextResponse.json({ items, owned: {}, coins: 0 });

  const data = await asAccount(account.id, async (tx) => {
    const owned = await tx.query(
      sql`select item_id, qty from purchases where account_id = ${account.id}::uuid`,
    );
    const p = await tx.query(
      sql`select coins from profiles where account_id = ${account.id}::uuid`,
    );
    return { owned: owned.rows, coins: (p.rows[0] as { coins: number } | undefined)?.coins ?? 0 };
  });

  const ownedMap: Record<string, number> = {};
  for (const row of data.owned as Array<{ item_id: string; qty: number }>) {
    ownedMap[row.item_id] = row.qty;
  }
  return NextResponse.json({ items, owned: ownedMap, coins: data.coins });
}

export async function POST(req: NextRequest) {
  const account = await getCurrentAccount();
  if (!account) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const b = (await req.json().catch(() => ({}))) as { itemId?: string; action?: string };
  const itemId = String(b.itemId || "");
  if (!itemId) return NextResponse.json({ error: "itemId required" }, { status: 400 });
  const fn = b.action === "use" ? "use" : "buy";

  const result = (await asAccount(account.id, async (tx) => {
    const r =
      fn === "use"
        ? await tx.query(sql`select fn_use_item(${account.id}::uuid, ${itemId}) as result`)
        : await tx.query(sql`select fn_purchase(${account.id}::uuid, ${itemId}) as result`);
    return (r.rows[0] as { result: Record<string, unknown> }).result;
  })) as Record<string, unknown>;

  if (result.ok === false) {
    return NextResponse.json({ error: String(result.error ?? "failed") }, { status: 400 });
  }
  return NextResponse.json(result);
}
