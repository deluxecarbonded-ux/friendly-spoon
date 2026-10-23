"use client";

import {
  Bomb,
  Coins,
  Crown,
  Flag,
  Ghost,
  Layers,
  Lock,
  Repeat,
  Shield,
  ShoppingBag,
  Skull,
  Timer,
  Trophy,
} from "lucide-react";
import { useEffect, useState } from "react";
import { GuestLock, ScreenShell } from "@/components/screen-shell";
import { useApp } from "@/components/providers";
import { fetchAchievements } from "@/lib/client-api";
import { cn } from "@/lib/utils";

const ICONS: Record<string, typeof Skull> = {
  "first-death": Skull,
  "first-clear": Flag,
  "deaths-25": Repeat,
  "deaths-100": Bomb,
  "deaths-250": Ghost,
  flawless: Shield,
  speedrun: Timer,
  trio: Layers,
  "full-clear": Crown,
  hoarder: Coins,
  shopper: ShoppingBag,
};

export default function AchievementsPage() {
  const { ready, isGuest, signedIn, unlocked: unlockedMap } = useApp();
  type Row = { key: string; name: string; description: string; unlocked: boolean; unlockedAt: string | null };
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    fetchAchievements()
      .then((r) => setRows(r.achievements))
      .catch(() => setRows([]));
    // `unlocked` changes whenever realtime pushes a new achievement
  }, [ready, isGuest, unlockedMap]);

  const unlockedCount = rows?.filter((r) => r.unlocked).length ?? 0;
  const total = rows?.length ?? 0;

  return (
    <ScreenShell title="ACHIEVEMENTS" sub="EVERY SCAR, PROFESSIONALLY FRAMED.">
      {isGuest || !signedIn ? (
        <GuestLock what="ACHIEVEMENTS" />
      ) : rows ? (
        <>
          <div className="mb-8 flex items-center gap-4">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-pan">
              <div
                className="h-full rounded-full bg-fg transition-[width] duration-700"
                style={{ width: `${total ? (unlockedCount / total) * 100 : 0}%` }}
              />
            </div>
            <span className="font-mono text-xs font-bold tracking-widest">
              {unlockedCount}/{total}
            </span>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((a, i) => {
              const Icon = ICONS[a.key] ?? Trophy;
              return (
                <div
                key={a.key}
                  style={{ animationDelay: `${i * 40}ms` }}
                  className={cn(
                    "flex animate-fade-up items-center gap-4 rounded-3xl p-5",
                    a.unlocked ? "bg-fg text-bg" : "bg-pan",
                  )}
                >
                  <span
                    className={cn(
                      "grid size-14 shrink-0 place-items-center rounded-2xl",
                      a.unlocked ? "bg-bg text-fg" : "bg-pan2 text-mut",
                    )}
                  >
                    {a.unlocked ? <Icon className="size-6" /> : <Lock className="size-5" />}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-mono text-sm font-bold tracking-wider">{a.name}</p>
                    <p className={cn("mt-0.5 text-xs", a.unlocked ? "opacity-70" : "text-mut")}>{a.description}</p>
                    <p className={cn("mt-1 font-mono text-[10px] tracking-[0.25em]", a.unlocked ? "opacity-60" : "text-mut")}>
                      {a.unlocked
                        ? `UNLOCKED ${new Date(a.unlockedAt!).toLocaleDateString()}`
                        : "LOCKED"}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <p className="animate-blink font-mono text-xs tracking-[0.35em] text-mut">COUNTING YOUR SCARS…</p>
      )}
    </ScreenShell>
  );
}
