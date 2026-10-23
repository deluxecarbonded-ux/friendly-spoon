import { Client } from "pg";
import { NextRequest } from "next/server";
import { getCurrentAccount } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Realtime subscription endpoint (Server-Sent Events).
 *
 * A dedicated Postgres connection LISTENs on `exotic_rt`; the triggers defined
 * in db/full-schema.sql push a NOTIFY on every mutation. Events for the current
 * account are forwarded to the browser, plus global board-affecting events, so
 * the whole UI live-updates with no refresh and no navigation.
 */
export async function GET(req: NextRequest) {
  const account = await getCurrentAccount();
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          closed = true;
        }
      };

      const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false },
      });
      let heartbeat: ReturnType<typeof setInterval> | undefined;

      const cleanup = async () => {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        try {
          await client.end();
        } catch {
          /* already gone */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        await client.connect();
        await client.query("LISTEN exotic_rt");
      } catch {
        send("error", { message: "realtime unavailable" });
        await cleanup();
        return;
      }

      client.on("notification", (msg) => {
        if (!msg.payload) return;
        let payload: { table?: string; op?: string; account?: string | null };
        try {
          payload = JSON.parse(msg.payload);
        } catch {
          return;
        }
        const mine = account && payload.account === account.id;
        // boards aggregate across everyone — these are broadcast to all clients
        const global =
          payload.table === "level_progress" ||
          payload.table === "profiles" ||
          payload.table === "accounts" ||
          payload.table === "activity" ||
          payload.table === "levels" ||
          payload.table === "shop_items" ||
          payload.table === "achievements" ||
          payload.table === "sessions" ||
          payload.table === "settings" ||
          payload.table === "purchases" ||
          payload.table === "account_achievements";

        if (mine) send("self", payload);
        if (global) send("global", payload);
      });
      client.on("error", () => void cleanup());

      send("ready", { account: account?.id ?? null, at: Date.now() });
      heartbeat = setInterval(() => send("ping", { at: Date.now() }), 25000);
      req.signal.addEventListener("abort", () => void cleanup());
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
