import type { PoolClient } from "pg";
import { pool } from "./index";

export type Tx = PoolClient;

async function withRole<T>(
  configure: (client: PoolClient) => Promise<unknown>,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await configure(client);
    await client.query("set local role exotic_app");
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (error) {
    try {
      await client.query("rollback");
    } catch {
      /* preserve the original error */
    }
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Run queries as a specific account. Sets the transaction-local
 * `exotic.account_id` GUC that every RLS policy checks, so the database
 * itself guarantees a player can only touch their own rows.
 */
export async function asAccount<T>(
  accountId: string,
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  return withRole(
    (client) => client.query("select set_config('exotic.account_id', $1, true)", [accountId]),
    fn,
  );
}

/**
 * Trusted server-side path (authentication, public leaderboards, signup).
 * Opts into `exotic.service` so RLS policies allow cross-account reads.
 */
export async function asService<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return withRole(
    (client) => client.query("select set_config('exotic.service', 'on', true)"),
    fn,
  );
}
