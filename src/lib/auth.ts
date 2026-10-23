import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies } from "next/headers";
import { sql } from "@/db";
import { asService } from "@/db/rls";

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = "exotic_session";
export const GUEST_COOKIE = "exotic_guest";
const SESSION_DAYS = 60;
const GUEST_DAYS = 365;

// ───────────────────────────── passwords ─────────────────────────────

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return { hash: buf.toString("hex"), salt };
}

export async function verifyPassword(password: string, hash: string, salt: string) {
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  const known = Buffer.from(hash, "hex");
  if (known.length !== buf.length) return false;
  return timingSafeEqual(known, buf);
}

// ───────────────────────────── sessions ──────────────────────────────

const hashToken = (t: string) => createHash("sha256").update(t).digest("hex");

export async function createSession(accountId: string, userAgent?: string | null) {
  const token = randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5);
  await asService(async (tx) => {
    await tx.query(
      sql`insert into sessions (account_id, token_hash, user_agent, expires_at)
          values (${accountId}, ${hashToken(token)}, ${userAgent ?? null}, ${expires.toISOString()})`,
    );
  });
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return token;
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await asService(async (tx) => {
      await tx.query(sql`delete from sessions where token_hash = ${hashToken(token)}`);
    });
  }
  jar.delete(SESSION_COOKIE);
}

export interface AuthedAccount {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
  emailVerified: boolean;
  createdAt: string;
}

/** Resolve the signed-in account from the session cookie (null when signed out). */
  export async function getCurrentAccount(): Promise<AuthedAccount | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const rows = await asService(async (tx) => {
    const r = await tx.query(sql`
      select a.id, a.username, a.email, a.display_name, a.is_guest, a.email_verified, a.created_at
      from sessions s
      join accounts a on a.id = s.account_id
      where s.token_hash = ${hashToken(token)} and s.expires_at > now()
      limit 1`);
    return r.rows as Array<Record<string, unknown>>;
  });

  const row = rows[0];
  if (!row) return null;
  return {
    id: String(row.id),
    username: String(row.username),
    email: (row.email as string | null) ?? null,
    displayName: (row.display_name as string | null) ?? null,
    isGuest: row.is_guest === true,
    emailVerified: row.email_verified === true,
    createdAt: new Date(row.created_at as string).toISOString(),
  };
}

export async function requireAccount(): Promise<AuthedAccount> {
  const a = await getCurrentAccount();
  if (!a) throw new UnauthorizedError();
  return a;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("unauthorized");
  }
}

// ───────────────────────────── guest device ──────────────────────────
// The guest identity lives in an httpOnly cookie — no web storage anywhere.

export async function getGuestAccountId(): Promise<string | null> {
  const jar = await cookies();
  const id = jar.get(GUEST_COOKIE)?.value;
  if (!id) return null;
  const rows = await asService(async (tx) => {
    const r = await tx.query(
      sql`select id from accounts where id = ${id}::uuid and is_guest = true limit 1`,
    );
    return r.rows as Array<{ id: string }>;
  });
  return rows[0]?.id ?? null;
}

export async function setGuestCookie(accountId: string) {
  const jar = await cookies();
  jar.set(GUEST_COOKIE, accountId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: new Date(Date.now() + GUEST_DAYS * 864e5),
  });
}

export async function clearGuestCookie() {
  const jar = await cookies();
  jar.delete(GUEST_COOKIE);
}
