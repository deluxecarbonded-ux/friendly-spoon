"use client";

import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Coins,
  Crosshair,
  Flag,
  Lock,
  Pause,
  Play,
  RotateCcw,
  Skull,
  Volume2,
  VolumeX,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Engine, PALETTES } from "@/game/engine";
import { getLevel } from "@/game/levels";
import { sfx } from "@/game/audio";
import { DEFAULT_SKIN, DEFAULT_TAUNT, DEFAULT_TRAIL } from "@/lib/catalog";
import { submitRun as postRun, useItem } from "@/lib/client-api";
import { fmtClock, fmtTime } from "@/lib/utils";
import { PillButton } from "./pill-button";
import { PlayerChip, ThemeToggle } from "./screen-shell";
import { useApp } from "./providers";

interface HudState {
  deaths: number;
  coins: number;
  timeMs: number;
  reversed: boolean;
}

interface WinInfo {
  stats: { timeMs: number; deaths: number; coins: number };
  coinsEarned: number;
  firstClear: boolean;
}

export function GameScreen({ levelId }: { levelId: number }) {
  const {
    account,
    ready,
    owned,
    unlockedLevel,
    settings,
    theme,
    levels,
    updateSettings,
    applyRunResult,
    refresh,
    tell,
  } = useApp();
  const router = useRouter();

  const level = getLevel(levelId);
  const meta = levels.find((l) => l.id === levelId);
  const locked = !level || levelId > unlockedLevel;
  const levelCount = levels.length || 6;

  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const submittedRef = useRef(false);
  const toastTimer = useRef<number | undefined>(undefined);

  const [hud, setHud] = useState<HudState>({ deaths: 0, coins: 0, timeMs: 0, reversed: false });
  const [toast, setToast] = useState<{ text: string; key: number } | null>(null);
  const [paused, setPaused] = useState(false);
  const [intro, setIntro] = useState(true);
  const [winInfo, setWinInfo] = useState<WinInfo | null>(null);

  const showToast = useCallback((text: string) => {
    setToast({ text, key: Date.now() });
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2300);
  }, []);

  const submitRun = useCallback(
    async (won: boolean, deaths: number, timeMs: number, coins: number) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      try {
        const res = await postRun({ levelId, won, runDeaths: deaths, timeMs, coins });
        applyRunResult(res);
        if (won) {
          // Pull the freshly recorded progress before offering "Next Level" —
          // otherwise the link navigates using the previous (still locked) snapshot.
          await refresh().catch(() => undefined);
          setWinInfo({ stats: { timeMs, deaths, coins }, coinsEarned: res.coinsEarned, firstClear: res.firstClear });
        }
      } catch {
        submittedRef.current = false;
        tell("SYNC FAILED", "YOUR PAIN WAS NOT RECORDED", "error");
      }
    },
    [levelId, applyRunResult, refresh, tell],
  );

  const restart = useCallback(() => {
    const eng = engineRef.current;
    if (!eng) return;
    sfx.restart();
    const d = eng.deaths;
    const alreadyBanked = eng.won; // a finished run was already submitted
    setWinInfo(null);
    setPaused(false);
    eng.paused = false;
    eng.rebuild();
    setHud({ deaths: 0, coins: 0, timeMs: 0, reversed: false });
    setToast(null);
    // re-arm submission, then bank the abandoned run's deaths
    submittedRef.current = false;
    if (d > 0 && !alreadyBanked) {
      submittedRef.current = true;
      void postRun({ levelId, won: false, runDeaths: d, timeMs: 0, coins: 0 })
        .then((res) => applyRunResult(res))
        .catch(() => undefined)
        .finally(() => {
          submittedRef.current = false;
        });
    }
  }, [levelId, applyRunResult]);

  const togglePause = useCallback(() => {
    const eng = engineRef.current;
    if (!eng || eng.won) return;
    eng.paused = !eng.paused;
    setPaused(eng.paused);
    if (eng.paused) sfx.pause();
    else sfx.resume();
  }, []);

  const useRevealGear = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng || eng.won) return;
    if ((owned["gear:reveal"] ?? 0) <= 0) {
      tell("NO TRAP-SCOPE", "THE SHOP SELLS MORE", "error");
      return;
    }
    try {
      await useItem("gear:reveal");
      eng.useReveal();
      await refresh();
    } catch {
      tell("NO TRAP-SCOPE", "THE SHOP SELLS MORE", "error");
    }
  }, [owned, refresh, tell]);

  const useAnchorGear = useCallback(async () => {
    const eng = engineRef.current;
    if (!eng || eng.won) return;
    if ((owned["gear:pass"] ?? 0) <= 0) {
      tell("NO ANCHOR", "THE SHOP SELLS MORE", "error");
      return;
    }
    if (!eng.placeCheckpoint()) {
      sfx.denied();
      return;
    } // needs solid ground
    try {
      await useItem("gear:pass");
      await refresh();
    } catch {
      tell("ANCHOR LOST", "SYNC HICCUP", "error");
    }
  }, [owned, refresh, tell]);

  // intro self-dismiss
  useEffect(() => {
    const t = window.setTimeout(() => setIntro(false), 2100);
    return () => window.clearTimeout(t);
  }, [levelId]);

  // engine lifecycle
  useEffect(() => {
    if (!level || locked || !ready || !account) return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, Math.floor(rect.width * dpr));
      canvas.height = Math.max(2, Math.floor(rect.height * dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const engine = new Engine(
      level,
      PALETTES[document.documentElement.classList.contains("dark") ? "dark" : "light"],
      {
        onDeath: ({ count }) => setHud((h) => ({ ...h, deaths: count })),
        onWin: (stats) => {
          void submitRun(true, stats.deaths, stats.timeMs, stats.coins);
        },
        onToast: showToast,
      },
      {
        skin: settings.skin,
        trail: settings.trail,
        tauntKey: settings.taunt.replace("taunt:", ""),
        shakeEnabled: settings.shake,
        keyboard: true,
      },
    );
    engine.attach(canvas);
    engine.start();
    sfx.levelStart();
    engineRef.current = engine;
    submittedRef.current = false;
    setPaused(false);
    setWinInfo(null);
    setIntro(true);
    setHud({ deaths: 0, coins: 0, timeMs: 0, reversed: false });

    const tick = window.setInterval(() => {
      if (!engine.paused) {
        const h = engine.hud();
        setHud({ deaths: h.deaths, coins: h.coins, timeMs: h.timeMs, reversed: h.reversed });
      }
    }, 120);

    return () => {
      window.clearInterval(tick);
      ro.disconnect();
      const d = engine.deaths;
      engine.destroy();
      engineRef.current = null;
      if (!submittedRef.current && d > 0) {
        submittedRef.current = true;
        void fetch("/api/progress", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ levelId, won: false, runDeaths: d, timeMs: 0, coins: 0 }),
          keepalive: true,
        }).catch(() => undefined);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [levelId, locked, ready, account?.id]);

  // live cosmetic / theme / settings sync
  useEffect(() => {
    engineRef.current?.setPalette(PALETTES[theme]);
  }, [theme]);
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    eng.opts.shakeEnabled = settings.shake;
  }, [settings.shake]);
  useEffect(() => {
    const eng = engineRef.current;
    if (!eng) return;
    const ok = (id: string, fallback: string) =>
      (owned[id] ?? 0) > 0 || id.endsWith(":solid") || id.endsWith(":none") || id.endsWith(":classic")
        ? id
        : fallback;
    eng.setSkin(ok(settings.skin, DEFAULT_SKIN));
    eng.setTrail(ok(settings.trail, DEFAULT_TRAIL));
    eng.tauntKey = ok(settings.taunt, DEFAULT_TAUNT).replace("taunt:", "");
  }, [settings.skin, settings.trail, settings.taunt, owned]);

  // hotkeys (movement + jump are owned by the engine input layer)
  useEffect(() => {
    const kd = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const eng = engineRef.current;
      if (!eng) return;
      switch (e.code) {
        case "KeyR":
          restart();
          break;
        case "Escape":
        case "KeyP":
          togglePause();
          break;
        case "Digit1":
          void useRevealGear();
          break;
        case "Digit2":
          void useAnchorGear();
          break;
      }
    };
    window.addEventListener("keydown", kd);
    return () => window.removeEventListener("keydown", kd);
  }, [restart, togglePause, useRevealGear, useAnchorGear]);

  const quit = useCallback(() => {
    router.push("/levels");
  }, [router]);

  const useSkip = useCallback(async () => {
    try {
      await useItem("gear:skip");
      await refresh();
      sfx.buy();
      tell("LEVEL UNLOCKED", "THE SUFFERING EXTENDS", "silent");
    } catch {
      tell("NO SKIP TOKEN", "THE SHOP SELLS THEM", "error");
    }
  }, [refresh, tell]);

  const hold = (key: "left" | "right" | "jump") => {
    const code = key === "jump" ? "Space" : key === "left" ? "ArrowLeft" : "ArrowRight";
    const set = (down: boolean) => () => {
      engineRef.current?.press(code, down);
    };
    return {
      onPointerDown: (e: React.PointerEvent) => {
        e.preventDefault();
        set(true)();
      },
      onPointerUp: set(false),
      onPointerLeave: set(false),
      onPointerCancel: set(false),
      onContextMenu: (e: React.MouseEvent) => e.preventDefault(),
    };
  };

  // ————— RENDER —————

  if (!ready) {
    return (
      <div className="relative z-10 grid min-h-screen place-items-center">
        <p className="animate-blink font-mono text-xs tracking-[0.35em] text-mut">
          CONTACTING THE PAIN FACTORY…
        </p>
      </div>
    );
  }

  if (locked) {
    return (
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-3xl flex-col items-center justify-center px-6 text-center">
        <span className="grid size-20 animate-pop-in place-items-center rounded-full bg-pan">
          <Lock className="size-8" />
        </span>
        <h1 className="mt-8 text-[clamp(2.4rem,7vw,4.5rem)] font-bold tracking-tight">LOCKED.</h1>
        <p className="mt-3 max-w-md font-mono text-xs tracking-[0.2em] text-mut">
          {!level
            ? "THIS LEVEL DOES NOT EXIST. OR DOES IT?"
            : `CLEAR LEVEL ${Math.max(1, unlockedLevel - 1)} FIRST. OR PAY TO SKIP.`}
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <PillButton
            onClick={() => router.push("/levels")}
            sound="nav"
            icon={<ArrowLeft className="size-4" />}
          >
            Level Select
          </PillButton>
          {level && (owned["gear:skip"] ?? 0) > 0 ? (
            <PillButton variant="soft" onClick={useSkip} icon={<Flag className="size-4" />}>
                Use Skip Token · {owned["gear:skip"]}
            </PillButton>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pt-4 pb-6 sm:px-8">
      {/* top bar */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <PillButton onClick={quit} variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />}>
            Quit
          </PillButton>
          <span className="hidden h-9 items-center rounded-full bg-fg px-4 font-mono text-[10px] font-bold tracking-[0.25em] text-bg sm:flex">
            LV {String(levelId).padStart(2, "0")} — {level.name}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-24 items-center justify-center rounded-full bg-pan font-mono text-[11px] font-bold tracking-widest">
            {fmtClock(hud.timeMs)}
          </span>
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-pan px-4 font-mono text-[11px] font-bold">
            <Skull className="size-3.5" />
            {hud.deaths}
          </span>
          <span className="flex h-9 items-center gap-1.5 rounded-full bg-pan px-4 font-mono text-[11px] font-bold">
            <Coins className="size-3.5" />
            {hud.coins}
          </span>
          <button
            onClick={togglePause}
            data-sfx="none"
            aria-label="pause"
            className="focus-ring grid size-9 cursor-pointer place-items-center rounded-full bg-pan transition-colors hover:bg-pan2"
          >
            <Pause className="size-4" />
          </button>
          <ThemeToggle className="!size-9" />
        </div>
      </header>

      {/* stage */}
      <div className="flex flex-1 items-center py-4">
        <div
          ref={wrapRef}
          className="relative mx-auto w-full max-w-full overflow-hidden rounded-3xl bg-pan aspect-video"
        >
          <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />

          {/* canvas toast */}
          {toast && (
            <div
              key={toast.key}
              className="pointer-events-none absolute inset-x-0 top-[12%] flex justify-center"
            >
              <span className="animate-pop-in rounded-full bg-fg px-6 py-2.5 font-mono text-xs font-bold tracking-[0.2em] text-bg sm:text-sm">
                {toast.text}
              </span>
            </div>
          )}

          {/* reversed indicator */}
          {hud.reversed && (
            <div className="pointer-events-none absolute top-4 left-4">
              <span className="animate-blink rounded-full bg-fg px-4 py-2 font-mono text-[10px] font-bold tracking-[0.25em] text-bg">
                CONTROLS REVERSED
              </span>
            </div>
          )}

          {/* gear chips */}
          <div className="pointer-events-none absolute right-3 bottom-3 flex gap-2">
            <button
              onClick={() => void useRevealGear()}
              className="focus-ring pointer-events-auto flex h-9 cursor-pointer items-center gap-2 rounded-full bg-bg/80 px-4 font-mono text-[10px] font-bold tracking-widest text-fg backdrop-blur-sm transition-transform hover:-translate-y-0.5"
              title="Trap-scope (1)"
            >
              <Crosshair className="size-3.5" />
              SCOPE ×{owned["gear:reveal"] ?? 0}
            </button>
            <button
              onClick={() => void useAnchorGear()}
              className="focus-ring pointer-events-auto flex h-9 cursor-pointer items-center gap-2 rounded-full bg-bg/80 px-4 font-mono text-[10px] font-bold tracking-widest text-fg backdrop-blur-sm transition-transform hover:-translate-y-0.5"
              title="Anchor checkpoint (2)"
            >
              <Flag className="size-3.5" />
              ANCHOR ×{owned["gear:pass"] ?? 0}
            </button>
          </div>

          {/* controls hint */}
          <p className="pointer-events-none absolute bottom-3 left-4 hidden font-mono text-[10px] tracking-[0.25em] text-fg/50 md:block">
            WASD / ARROWS MOVE · SPACE JUMP · R RESTART · 1 SCOPE · 2 ANCHOR
          </p>

          {/* touch controls */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 hidden justify-between px-3 touch-none select-none [@media(pointer:coarse)]:flex">
            <div className="flex gap-2">
              <button
                {...hold("left")}
                aria-label="left"
                className="focus-ring pointer-events-auto grid size-14 cursor-pointer touch-none place-items-center rounded-full bg-bg/70 text-fg"
              >
                <ChevronLeft className="size-6" />
              </button>
              <button
                {...hold("right")}
                aria-label="right"
                className="focus-ring pointer-events-auto grid size-14 cursor-pointer touch-none place-items-center rounded-full bg-bg/70 text-fg"
              >
                <ChevronRight className="size-6" />
              </button>
            </div>
            <button
              {...hold("jump")}
              aria-label="jump"
              className="focus-ring pointer-events-auto flex h-14 cursor-pointer touch-none items-center rounded-full bg-fg px-7 font-mono text-xs font-bold tracking-widest text-bg"
            >
              JUMP
            </button>
          </div>

          {/* intro overlay */}
          {intro && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg/95 text-center">
              <p className="animate-fade-up font-mono text-[11px] tracking-[0.4em] text-mut">
                LEVEL {String(levelId).padStart(2, "0")}
              </p>
              <h2 className="mt-3 animate-fade-up px-4 text-[clamp(2.2rem,6vw,4.5rem)] font-bold tracking-tight [animation-delay:80ms]">
                {level.name}
              </h2>
              <p className="mt-4 animate-fade-up font-mono text-[11px] tracking-[0.25em] text-mut [animation-delay:160ms]">
                {level.tip}
              </p>
              <p className="mt-8 animate-blink font-mono text-[10px] tracking-[0.3em] text-fg">
                GET READY
              </p>
            </div>
          )}

          {/* pause overlay */}
          {paused && !winInfo && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg/90 text-center">
              <h2 className="animate-pop-in text-[clamp(2.5rem,7vw,5rem)] font-bold tracking-tight">
                PAUSED.
              </h2>
              <p className="mt-2 font-mono text-[11px] tracking-[0.3em] text-mut">
                THE SPIKES ARE RESTING. ENJOY IT.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <PillButton onClick={togglePause} icon={<Play className="size-4" />} silent>
                  Resume
                </PillButton>
                <PillButton variant="soft" onClick={restart} icon={<RotateCcw className="size-4" />} silent>
                  Restart
                </PillButton>
                <PillButton variant="ghost" onClick={quit} icon={<ArrowLeft className="size-4" />}>
                  Quit
                </PillButton>
              </div>
              <div className="mt-8 flex items-center gap-2">
                <PillButton
                  variant="ghost"
                  size="sm"
                  sound="toggle"
                  onClick={() => {
                    const next = !settings.sound;
                    void updateSettings({ sound: next });
                    if (next) window.setTimeout(() => sfx.toggle(), 0);
                  }}
                  icon={settings.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
                >
                  {settings.sound ? "Sound On" : "Sound Off"}
                </PillButton>
              </div>
            </div>
          )}

          {/* win overlay */}
          {winInfo && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-bg/95 text-center">
              <p className="animate-fade-up font-mono text-[11px] tracking-[0.4em] text-mut">
                IMPOSSIBLE. YOU ACTUALLY DID IT.
              </p>
              <h2 className="mt-3 animate-pop-in px-4 text-[clamp(2.4rem,7vw,5rem)] font-bold tracking-tight">
                LEVEL CLEARED
              </h2>
              <div className="mt-6 flex flex-wrap justify-center gap-2 font-mono text-[11px] font-bold tracking-widest">
                <span className="rounded-full bg-pan px-5 py-2.5">TIME {fmtTime(winInfo.stats.timeMs)}</span>
                <span className="rounded-full bg-pan px-5 py-2.5">
                  <Skull className="mr-1 inline size-3.5" />
                  {winInfo.stats.deaths} DEATHS
                </span>
                <span className="rounded-full bg-fg px-5 py-2.5 text-bg">
                  <Coins className="mr-1 inline size-3.5" />+{winInfo.coinsEarned}
                </span>
                {winInfo.firstClear && (
                  <span className="rounded-full bg-pan px-5 py-2.5">FIRST CLEAR</span>
                )}
              </div>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                {levelId < levelCount ? (
                  <PillButton href={`/play?level=${levelId + 1}`} icon={<Flag className="size-4" />}>
                    Next Level
                  </PillButton>
                ) : (
                  <PillButton href="/achievements" icon={<Flag className="size-4" />}>
                    View Scars
                  </PillButton>
                )}
                <PillButton variant="soft" onClick={restart} icon={<RotateCcw className="size-4" />} silent>
                  Replay
                </PillButton>
                <PillButton
                  variant="ghost"
                  onClick={() => router.push("/levels")}
                  sound="nav"
                  icon={<ArrowLeft className="size-4" />}
                >
                  Levels
                </PillButton>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* bottom strip */}
      <div className="flex items-center justify-between">
        <p className="font-mono text-[10px] tracking-[0.25em] text-mut">
          PAR {meta ? `${meta.parSeconds}S` : "—"} · DEATHLESS +{meta?.deathlessBonus ?? 0} · SPEED +40
        </p>
        <PlayerChip />
      </div>
    </div>
  );
}
