import { sql } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import { asService } from "@/db/rls";

export const dynamic = "force-dynamic";

/**
 * Verify an email address using a token sent to the user's inbox.
 * On success, marks the account email_verified = true and creates a session.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { token?: string };
    const token = String(body.token ?? "").trim();
    if (!token) {
      return NextResponse.json({ ok: false, error: "token required" }, { status: 400 });
    }

    const accountId = await asService(async (tx) => {
      const r = await tx.query(sql`select fn_verify_email(${token}) as account_id`);
      const row = r.rows[0] as { account_id: string | null };
      return row.account_id;
    });

    if (!accountId) {
      return NextResponse.json(
        { ok: false, error: "invalid or expired token" },
        { status: 400 },
      );
    }

    return NextResponse.json({ ok: true, accountId });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[verify] error:", err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}