import { sql } from "@/db";
import { NextRequest, NextResponse } from "next/server";
import { asService } from "@/db/rls";
import {
  clearGuestCookie,
  createSession,
  destroySession,
  getCurrentAccount,
  getGuestAccountId,
  hashPassword,
  setGuestCookie,
  verifyPassword,
} from "@/lib/auth";
import { sendVerificationEmail, sendWelcomeEmail } from "@/lib/email";
import {
  MSG,
  validateGuestSignUp,
  validateSignIn,
  validateSignUp,
} from "@/lib/validation";

export const dynamic = "force-dynamic";

type FieldErrors = Record<string, string>;

const fail = (errors: FieldErrors, status = 400) =>
  NextResponse.json({ ok: false, errors }, { status });

export async function GET() {
  const account = await getCurrentAccount();
  const guestId = await getGuestAccountId();
  return NextResponse.json({
    account,
    hasGuest: guestId !== null,
  });
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as {
    action?: string;
    email?: string;
    displayName?: string;
    username?: string;
    password?: string;
  };
  const action = String(body.action || "");
  const ua = req.headers.get("user-agent");

  // ───────────────────────────── SIGN UP ─────────────────────────────
  if (action === "signup") {
    const input = {
      email: String(body.email ?? ""),
      displayName: String(body.displayName ?? ""),
      username: String(body.username ?? ""),
      password: String(body.password ?? ""),
    };
    const errors = validateSignUp(input) as FieldErrors;
    if (Object.keys(errors).length) return fail(errors);

    const username = input.username.trim();
    const email = input.email.trim().toLowerCase();
    const displayName = input.displayName.trim() || null;

    const taken = await asService(async (tx) => {
      const r = await tx.query(sql`
        select
          exists(select 1 from accounts where username = ${username}) as u,
          exists(select 1 from accounts where lower(email) = ${email}) as e`);
      return r.rows[0] as { u: boolean; e: boolean };
    });
    const conflict: FieldErrors = {};
    if (taken.u) conflict.username = MSG.usernameTaken;
    if (taken.e) conflict.email = MSG.emailTaken;
    if (Object.keys(conflict).length) return fail(conflict, 409);

    const { hash, salt } = await hashPassword(input.password);
    const account = await asService(async (tx) => {
      const r = await tx.query(sql`
        insert into accounts (username, email, display_name, password_hash, password_salt, is_guest)
        values (${username}, ${email}, ${displayName}, ${hash}, ${salt}, false)
        returning id, username, email, display_name, is_guest, created_at`);
      const row = r.rows[0] as Record<string, unknown>;
      await tx.query(sql`select fn_bootstrap_account(${String(row.id)}::uuid)`);
      return row;
    });

    const accountId = String(account.id);

    // Create email verification token (72h expiry)
    const verifyToken = await asService(async (tx) => {
      const r = await tx.query(
        sql`select fn_create_verification_token(${accountId}::uuid, 72) as token`,
      );
      return String(r.rows[0].token);
    });

    const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL ?? "https://devilexotix.com"}/verify?token=${verifyToken}`;

    // Fire-and-forget verification email (non-fatal)
    if (account.email) {
      sendVerificationEmail(
        String(account.email),
        String(account.username),
        verifyUrl,
      ).catch((e) => console.error("[email] verification failed:", e));
    }

    return NextResponse.json({ ok: true, needsVerification: true });
  }

  // ───────────────────────────── SIGN IN ─────────────────────────────
  if (action === "signin") {
    const input = {
      username: String(body.username ?? ""),
      password: String(body.password ?? ""),
    };
    const errors = validateSignIn(input) as FieldErrors;
    if (Object.keys(errors).length) return fail(errors);

    const username = input.username.trim();
    const row = await asService(async (tx) => {
      const r = await tx.query(sql`
        select id, username, password_hash, password_salt, is_guest, email_verified
        from accounts where username = ${username} limit 1`);
      return r.rows[0] as Record<string, unknown> | undefined;
    });

    // exact-match username lookup — guests cannot be signed into with a password
    if (!row || row.is_guest === true) {
      return fail({ username: MSG.usernameNotRegistered }, 404);
    }
    if (row.email_verified !== true) {
      return fail({ form: "Verify your email before signing in. Check your inbox." }, 403);
    }
    const good = await verifyPassword(
      input.password,
      String(row.password_hash),
      String(row.password_salt),
    );
    if (!good) return fail({ password: MSG.passwordIncorrect }, 401);

    await asService(async (tx) => {
      await tx.query(sql`update accounts set last_seen_at = now() where id = ${String(row.id)}::uuid`);
    });
    await createSession(String(row.id), ua);
    return NextResponse.json({ ok: true });
  }

  // ─────────────────────── GUEST: CREATE / RESUME ────────────────────
  if (action === "guest-signup") {
    const existing = await getGuestAccountId();
    if (existing) return fail({ form: MSG.guestExists }, 409);

    const input = {
      username: String(body.username ?? ""),
      displayName: String(body.displayName ?? ""),
    };
    const errors = validateGuestSignUp(input) as FieldErrors;
    if (Object.keys(errors).length) return fail(errors);

    const username = input.username.trim();
    const displayName = input.displayName.trim() || null;

    const account = await asService(async (tx) => {
      const r = await tx.query(sql`
        insert into accounts (username, display_name, is_guest)
        values (${username}, ${displayName}, true)
        on conflict (username) do nothing
        returning id, username, display_name, is_guest, created_at`);
      const row = r.rows[0] as Record<string, unknown> | undefined;
      if (!row) return null;
      await tx.query(sql`select fn_bootstrap_account(${String(row.id)}::uuid)`);
      return row;
    });
    if (!account) return fail({ username: MSG.usernameTaken }, 409);

    await setGuestCookie(String(account.id));
    await createSession(String(account.id), ua);
    return NextResponse.json({ ok: true, account });
  }

  if (action === "guest-signin") {
    const guestId = await getGuestAccountId();
    if (!guestId) return fail({ form: MSG.guestNone }, 404);
    await asService(async (tx) => {
      await tx.query(sql`update accounts set last_seen_at = now() where id = ${guestId}::uuid`);
    });
    await createSession(guestId, ua);
    return NextResponse.json({ ok: true });
  }

  // ───────────────────────────── SIGN OUT ────────────────────────────
  if (action === "signout") {
    await destroySession();
    return NextResponse.json({ ok: true });
  }

  if (action === "delete-guest") {
    const guestId = await getGuestAccountId();
    if (!guestId) return fail({ form: MSG.guestNone }, 404);
    await asService(async (tx) => {
      await tx.query(sql`delete from accounts where id = ${guestId}::uuid and is_guest = true`);
    });
    await clearGuestCookie();
    await destroySession();
    return NextResponse.json({ ok: true });
  }

  return fail({ form: "Unknown action" }, 400);
}
