"use client";

import { Check, Flag, Layers, Lock, Play, Skull, Timer } from "lucide-react";
import { useRouter } from "next/navigation";
import { ScreenShell } from "@/components/screen-shell";
import { PreviewCanvas } from "@/components/preview-canvas";
import { PillButton } from "@/components/pill-button";
import { useApp } from "@/components/providers";
import { useItem } from "@/lib/client-api";

import { sfx } from "@/game/audio";
import { cn, fmtTime } from "@/lib/utils";

export default function LevelsPage() {
  const { progress, unlockedLevel, maxCompleted, owned, levels, refresh, tell } = useApp();
  const router = useRouter();

  return (
    <ScreenShell
      title="LEVELS"
      sub="SIX STAGES OF PROFESSIONALLY-ENGINEERED BETRAYAL. EVERY TRAP IS INVISIBLE UNTIL IT SPRINGS — WATCH THEM POP IN THE LIVE PREVIEWS."
    >
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
        {levels.map((m, i) => {
          const row = progress.find((p) => p.levelId === m.id);
          const cleared = row?.completed === true;
          const unlocked = m.id <= unlockedLevel;
          const status = cleared ? "cleared" : unlocked ? "next" : "locked";
          return (
            <div
              key={m.id}
              style={{ animationDelay: `${i * 70}ms` }}
              className="group flex animate-fade-up flex-col overflow-hidden rounded-3xl bg-pan"
            >
              {/* live video preview */}
              <div className="relative aspect-video w-full overflow-hidden">
                <PreviewCanvas levelId={m.id} />
                <span className="absolute top-3 left-3 rounded-full bg-bg px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.25em] text-fg">
                  LV {String(m.id).padStart(2, "0")}
                </span>
                <span
                  className={cn(
                    "absolute top-3 right-3 flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.25em]",
                    status === "cleared" && "bg-fg text-bg",
                    status === "next" && "bg-bg text-fg",
                    status === "locked" && "bg-bg/70 text-mut",
                  )}
                >
                  {status === "cleared" ? (
                    <>
                      <Check className="size-3" /> CLEARED
                    </>
                  ) : status === "next" ? (
                    <>
                      <Play className="size-3" /> OPEN
                    </>
                  ) : (
                    <>
                      <Lock className="size-3" /> LOCKED
                    </>
                  )}
                </span>
                {status === "locked" && (
                  <div className="absolute inset-0 grid place-items-center bg-bg/60">
                    <div className="text-center">
                      <Lock className="mx-auto size-6" />
                      <p className="mt-2 font-mono text-[10px] tracking-[0.25em] text-mut">
                        CLEAR LV {String(Math.min(m.id - 1, unlockedLevel)).padStart(2, "0")} TO ENTER
                      </p>
                      {(owned["gear:skip"] ?? 0) > 0 && m.id === unlockedLevel + 1 ? (
                        <button
                          onClick={async () => {
                            try {
                              await useItem("gear:skip");
                              await refresh();
                              sfx.buy();
                              tell("LEVEL UNLOCKED", "THE SUFFERING EXTENDS", "silent");
                            } catch {
                              tell("NO SKIP TOKEN", "THE SHOP SELLS THEM", "error");
                            }
                          }}
                          className="focus-ring mt-3 cursor-pointer rounded-full bg-fg px-5 py-2 font-mono text-[10px] font-bold tracking-[0.2em] text-bg transition-transform hover:-translate-y-0.5"
                        >
                          <Flag className="mr-1.5 inline size-3" />
                          USE SKIP TOKEN
                        </button>
                      ) : null}
                    </div>
                  </div>
                )}
              </div>

              {/* meta */}
              <div className="flex flex-1 flex-col p-5">
                <h3 className="text-xl font-bold tracking-tight">{m.name}</h3>
                <p className="mt-1 text-sm text-mut">{m.sub}</p>
                <div className="mt-4 mb-4 flex flex-wrap gap-x-4 gap-y-1.5 font-mono text-[10px] tracking-[0.2em] text-mut">
                  <span className="flex items-center gap-1.5">
                    <Timer className="size-3" /> PAR {m.parSeconds}S
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Layers className="size-3" /> ATTEMPTS {row?.attempts ?? 0}
                  </span>
                  {cleared && row ? (
                    <>
                      <span className="flex items-center gap-1.5">
                        <Timer className="size-3" /> BEST {fmtTime(row.bestTimeMs)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Skull className="size-3" /> BEST {row.bestDeaths ?? 0}
                      </span>
                    </>
                  ) : null}
                </div>
                <div className="mt-auto">
                  {unlocked ? (
                    <PillButton
                      size="sm"
                      className="w-full"
                      sound="nav"
                      icon={<Play className="size-3.5" />}
                      onClick={() => router.push(`/play?level=${m.id}`)}
                    >
                      {cleared ? "Replay" : "Play"}
                    </PillButton>
                  ) : (
                    <PillButton size="sm" className="w-full" variant="soft" disabled icon={<Lock className="size-3.5" />}>
                      Locked
                    </PillButton>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {levels.length > 0 && maxCompleted >= levels.length ? (
        <p className="mt-8 rounded-3xl bg-fg px-8 py-5 text-center font-mono text-xs font-bold tracking-[0.25em] text-bg">
          YOU CLEARED EVERYTHING. THE GAME IS SORRY. IT IS ALSO LYING.
        </p>
      ) : null}
    </ScreenShell>
  );
}
