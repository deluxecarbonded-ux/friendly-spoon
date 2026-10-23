"use client";

import { Ghost, Medal, Skull, Timer, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { GuestLock, ScreenShell } from "@/components/screen-shell";
import { PillButton } from "@/components/pill-button";
import { useApp } from "@/components/providers";
import { fetchLeaderboard, type BoardRow } from "@/lib/client-api";
import { cn, fmtTime } from "@/lib/utils";

type Tab = "cleared" | "deaths" | "speed";

const TABS: Array<{ key: Tab; label: string; icon: typeof Trophy }> = [
  { key: "cleared", label: "MOST CLEARED", icon: Trophy },
  { key: "deaths", label: "FEWEST DEATHS", icon: Skull },
  { key: "speed", label: "FASTEST", icon: Timer },
];

export default function LeaderboardPage() {
  const { account, isGuest, signedIn, bumpBoards } = useApp();
  type Boards = { cleared: BoardRow[]; deaths: BoardRow[]; speed: BoardRow[] };
  const [boards, setBoards] = useState<Boards | null>(null);
  const [tab, setTab] = useState<Tab>("cleared");

  useEffect(() => {
    if (isGuest) return;
    fetchLeaderboard()
      .then((r) => setBoards(r.boards))
      .catch(() => setBoards({ cleared: [], deaths: [], speed: [] }));
    // bumpBoards ticks on every realtime run from any player
  }, [isGuest, bumpBoards]);

  const rows: BoardRow[] = boards ? boards[tab] : [];

  return (
    <ScreenShell
      title="LEADERBOARDS"
      sub="REAL PLAYERS ONLY. NO BOTS, NO FAKES — EVERY ROW HERE EARNED ITS TRAUMA."
    >
      <div className="mb-8 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            data-sfx="select"
            className={cn(
              "focus-ring flex h-11 cursor-pointer items-center gap-2 rounded-full px-6 font-mono text-[11px] font-bold tracking-widest transition-[background-color,transform] duration-150 hover:-translate-y-0.5",
              tab === t.key ? "bg-fg text-bg" : "bg-pan text-fg hover:bg-pan2",
            )}
          >
            <t.icon className="size-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {isGuest || !signedIn ? (
        <GuestLock what="LEADERBOARDS" />
      ) : !boards ? (
        <p className="animate-blink font-mono text-xs tracking-[0.35em] text-mut">RANKING THE SUFFERING…</p>
      ) : rows.length === 0 ? (
        <div className="grid place-items-center rounded-3xl bg-pan px-8 py-20 text-center">
          <span className="grid size-16 place-items-center rounded-full bg-pan2">
            <Ghost className="size-7" />
          </span>
          <h3 className="mt-6 text-2xl font-bold tracking-tight">NO RUNS YET.</h3>
          <p className="mt-2 max-w-sm font-mono text-[11px] tracking-[0.2em] text-mut">
            THIS BOARD IS EMPTY. BE THE FIRST TO SUFFER PUBLICLY.
          </p>
          <PillButton href="/play" className="mt-6" icon={<Trophy className="size-4" />}>
            Claim First Place
          </PillButton>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => {
            const me = row.accountId === account?.id;
            const top = i < 3;
            return (
              <div
                key={`${row.accountId}-${i}`}
                style={{ animationDelay: `${i * 45}ms` }}
                className={cn(
                  "flex animate-fade-up items-center gap-4 rounded-full py-3 pr-6 pl-5 sm:gap-6",
                  top ? "bg-fg text-bg" : "bg-pan",
                )}
              >
                <span className="w-10 shrink-0 font-mono text-lg font-bold tracking-tight">
                  {String(i + 1).padStart(2, "0")}
                </span>
                {top && <Medal className="size-4 shrink-0 opacity-80" />}
                <span className="min-w-0 flex-1 truncate font-mono text-sm font-bold tracking-wider">
                  {row.name}
                  {me && (
                    <span className={cn("ml-2 rounded-full px-3 py-1 text-[9px] tracking-[0.25em]", top ? "bg-bg text-fg" : "bg-fg text-bg")}>
                      YOU
                    </span>
                  )}
                </span>
                <span className={cn("font-mono text-[11px] tracking-[0.2em]", top ? "opacity-70" : "text-mut")}>
                  {row.detail}
                </span>
                <span className="w-20 text-right font-mono text-sm font-bold">
                  {tab === "speed" ? fmtTime(row.value) : row.value}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-8 text-center font-mono text-[10px] tracking-[0.25em] text-mut">
        BOARDS UPDATE AFTER EVERY RUN. DEATH COUNT INCLUDED, FOREVER.
      </p>
    </ScreenShell>
  );
}
