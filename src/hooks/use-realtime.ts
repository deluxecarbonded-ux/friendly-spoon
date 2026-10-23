"use client";

import { useEffect, useRef } from "react";

export interface RealtimeEvent {
  table: string;
  op: string;
  account: string | null;
  scope: "self" | "global";
}

/**
 * Subscribe to the server's Postgres LISTEN/NOTIFY stream over SSE.
 * Fires for this account's mutations ("self") and for board-affecting
 * mutations from anyone ("global") — the UI updates with no refresh.
 */
export function useRealtime(onEvent: (e: RealtimeEvent) => void, enabled = true) {
  const handler = useRef(onEvent);
  handler.current = onEvent;

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let source: EventSource | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;
    let backoff = 1000;

    const connect = () => {
      if (closed) return;
      source = new EventSource("/api/realtime");

      const relay = (scope: "self" | "global") => (ev: MessageEvent) => {
        try {
          const data = JSON.parse(ev.data) as Omit<RealtimeEvent, "scope">;
          handler.current({ ...data, scope });
        } catch {
          /* malformed frame — ignore */
        }
      };

      source.addEventListener("self", relay("self"));
      source.addEventListener("global", relay("global"));
      source.addEventListener("ready", () => {
        backoff = 1000;
      });
      source.onerror = () => {
        source?.close();
        source = null;
        if (closed) return;
        retry = setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 15000);
      };
    };

    connect();
    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      source?.close();
    };
  }, [enabled]);
}
