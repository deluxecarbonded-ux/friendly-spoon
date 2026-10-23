import { NextRequest, NextResponse } from "next/server";
import { checkEmail, checkPassword, checkUsername } from "@/lib/validation";

// Edge function: pure, DB-free field validation running at the edge for
// instant feedback while the user types.
export const runtime = "edge";

export async function POST(req: NextRequest) {
  const b = (await req.json().catch(() => ({}))) as {
    username?: string;
    email?: string;
    password?: string;
  };
  const errors: Record<string, string> = {};
  if (b.username !== undefined) {
    const e = checkUsername(b.username);
    if (e) errors.username = e;
  }
  if (b.email !== undefined) {
    const e = checkEmail(b.email);
    if (e) errors.email = e;
  }
  if (b.password !== undefined) {
    const e = checkPassword(b.password);
    if (e) errors.password = e;
  }
  return NextResponse.json({ ok: Object.keys(errors).length === 0, errors });
}
