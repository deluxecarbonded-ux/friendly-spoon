"use client";

import {
  BadgeInfo,
  BarChart3,
  Layers,
  MoveRight,
  Play,
  Settings,
  ShoppingBag,
  Trophy,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PlayerChip, ThemeToggle } from "@/components/screen-shell";
import { Splash } from "@/components/splash";
import { useApp } from "@/components/providers";
import { TAUNTS } from "@/lib/catalog";
import { sfx } from "@/game/audio";

function PlayerLogo() {
  return (
    <svg width="22" height="22" viewBox="0 0 32 32" aria-hidden="true">
      <rect x="9" y="6" width="14" height="14" fill="currentColor" />
      <rect x="12" y="11" width="4" height="2" fill="var(--fg)" />
      <rect x="18" y="11" width="4" height="2" fill="var(--fg)" />
    </svg>
  );
}

const NAV = [
  { key: "1", n: "01", label: "PLAY", href: "/play", desc: "CONTINUE THE SUFFERING", icon: Play },
  { key: "2", n: "02", label: "LEVELS", href: "/levels", desc: "SIX WAYS TO REGRET", icon: Layers },
  { key: "3", n: "03", label: "SHOP", href: "/shop", desc: "SPEND COINS. STILL DIE.", icon: ShoppingBag },
  { key: "4", n: "04", label: "SETTINGS", href: "/settings", desc: "MAKE IT YOURS", icon: Settings },
  { key: "5", n: "05", label: "ACHIEVEMENTS", href: "/achievements", desc: "SCARS, FRAMED", icon: Trophy },
  { key: "6", n: "06", label: "LEADERBOARDS", href: "/leaderboard", desc: "REAL PAIN, RANKED", icon: BarChart3 },
  { key: "7", n: "07", label: "CREDITS", href: "/credits", desc: "WHO TO BLAME", icon: BadgeInfo },
];

const TICKER = [...TAUNTS.classic, ...TAUNTS.corporate].join("  ·  ") + "  ·  ";

export default function HomePage() {
  const [splash, setSplash] = useState(true);
  const { profile, maxCompleted, levels, account, ready } = useApp();
  const router = useRouter();

  useEffect(() => {
    if (ready && !account) router.replace("/signin");
  }, [ready, account, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (splash) return;
      const item = NAV.find((n) => n.key === e.key);
      if (item) {
        sfx.nav();
        router.push(item.href);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [splash, router]);

  return (
    <>
      {splash && (
        <Splash onDone={() => setSplash(false)} />
      )}

      <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pt-5 sm:px-8">
        <header className="flex items-center justify-between gap-3">
          <span className="flex h-11 items-center gap-3 rounded-full bg-fg px-5 font-mono text-[11px] font-bold tracking-[0.3em] text-bg">
            <PlayerLogo />
            EXOTIC
          </span>
          <div className="flex items-center gap-3">
            <PlayerChip />
            <ThemeToggle />
          </div>
        </header>

        <div className="grid flex-1 items-center gap-10 py-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6">
          {/* hero */}
          <div>
            <p className="mb-4 animate-fade-up font-mono text-[11px] tracking-[0.35em] text-mut">
              A MONOCHROME RAGE-BAIT PLATFORMER
            </p>
            <h1 className="text-[clamp(4.5rem,15vw,11rem)] leading-[0.85] font-bold tracking-tight">
              <span className="block overflow-hidden">
                <span className="block animate-rise" style={{ animationDuration: "0.8s" }}>
                  EXOTIC
                </span>
              </span>
            </h1>
            <p className="mt-6 max-w-md animate-fade-up text-base text-mut [animation-delay:120ms]">
              The floor lies. The flags lie. Gravity lies. Six levels of lovingly
              engineered betrayal — and a real leaderboard that remembers every
              single one of your deaths.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3 animate-fade-up [animation-delay:200ms]">
              <button
                onClick={() => router.push("/play")}
                data-sfx="nav"
                className="focus-ring flex h-16 cursor-pointer items-center gap-3 rounded-full bg-fg px-10 text-base font-bold tracking-[0.2em] text-bg uppercase transition-transform duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97]"
              >
                <Play className="size-5 fill-current" />
                Play
              </button>
              <button
                onClick={() => router.push("/levels")}
                data-sfx="nav"
                className="focus-ring flex h-16 cursor-pointer items-center gap-2 rounded-full bg-pan px-8 text-sm font-semibold tracking-[0.14em] uppercase transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-pan2 active:translate-y-0 active:scale-[0.97]"
              >
                <Layers className="size-4.5" />
                Levels
              </button>
            </div>

            <div className="mt-10 flex flex-wrap gap-2 animate-fade-up font-mono text-[10px] tracking-[0.25em] text-mut [animation-delay:280ms]">
              <span className="rounded-full bg-pan px-4 py-2">2D CANVAS</span>
              <span className="rounded-full bg-pan px-4 py-2">TROLL-CLASS</span>
              <span className="rounded-full bg-pan px-4 py-2">
                {maxCompleted}/{levels.length || 6} CLEARED
              </span>
              <span className="rounded-full bg-pan px-4 py-2">
                {ready ? `${profile.totalDeaths} DEATHS SO FAR` : "DEATHS PENDING"}
              </span>
            </div>
          </div>

          {/* nav index */}
          <nav className="flex flex-col">
            {NAV.map((item, i) => (
              <button
                key={item.n}
                onClick={() => router.push(item.href)}
                data-sfx="nav"
                style={{ animationDelay: `${120 + i * 60}ms` }}
                className="group focus-ring flex cursor-pointer items-center gap-5 rounded-3xl px-4 py-4 text-left animate-fade-up transition-colors duration-200 hover:bg-pan sm:gap-7 sm:px-6"
              >
                <span className="font-mono text-xs font-bold text-mut transition-colors group-hover:text-fg">
                  {item.n}
                </span>
                <span className="flex-1">
                  <span className="block text-2xl font-bold tracking-tight transition-transform duration-200 group-hover:translate-x-1 sm:text-3xl">
                    {item.label}
                  </span>
                  <span className="block font-mono text-[10px] tracking-[0.25em] text-mut">
                    {item.desc}
                  </span>
                </span>
                <item.icon className="size-5 text-mut transition-colors group-hover:text-fg" />
                <MoveRight className="size-5 -translate-x-2 text-fg opacity-0 transition-[opacity,transform] duration-200 group-hover:translate-x-0 group-hover:opacity-100" />
              </button>
            ))}
            <p className="mt-4 px-6 font-mono text-[10px] tracking-[0.25em] text-mut">
              PRESS 1–7 TO JUMP IN
            </p>
          </nav>
        </div>

        {/* taunt ticker */}
        <div className="mt-auto -mx-5 overflow-hidden bg-fg text-bg sm:-mx-8">
          <div className="flex w-max animate-marquee whitespace-nowrap py-3 font-mono text-xs tracking-[0.3em]">
            <span className="pr-8">{TICKER}</span>
            <span className="pr-8">{TICKER}</span>
          </div>
        </div>
      </main>
    </>
  );
}
