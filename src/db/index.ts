import { Pool } from "pg";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required");
}

const globalForDb = globalThis as typeof globalThis & {
  __exoticSupabasePool?: Pool;
};

/**
 * Supabase Postgres connection (session-mode pooler).
 *
 * The app keeps its SQL functions and row-level security policies, so the
 * server uses the database directly instead of exposing privileged table
 * access to the browser. Supabase uses self-signed certs, so we disable
 * cert verification explicitly.
 */
export const pool =
  globalForDb.__exoticSupabasePool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    ssl: { rejectUnauthorized: false },
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__exoticSupabasePool = pool;
}

export interface SqlQuery {
  text: string;
  values: unknown[];
}

/** Small tagged-template helper for parameterised Postgres queries. */
export function sql(strings: TemplateStringsArray, ...values: unknown[]): SqlQuery {
  let text = strings[0];
  for (let i = 0; i < values.length; i++) {
    text += `$${i + 1}${strings[i + 1]}`;
  }
  return { text, values };
}
