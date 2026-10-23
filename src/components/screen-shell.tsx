"use client";

import { ArrowLeft, Coins, Ghost, Moon, Skull, Sun } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { sfx } from "@/game/audio";
import { useApp } from "./providers";
import { PillButton } from "./pill-button";

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useApp();
  return (
    <button
      onClick={() => {
        sfx.toggle();
        toggleTheme();
      }}
      data-sfx="none"
      aria-label="toggle theme"
      className={`focus-ring grid size-11 cursor-pointer place-items-center rounded-full bg-pan text-fg transition-[background-color,transform] duration-200 hover:-translate-y-0.5 hover:bg-pan2 active:translate-y-0 ${className ?? ""}`}
    >
      {theme === "dark" ? <Sun className="size-4.5" /> : <Moon className="size-4.5" />}
    </button>
  );
}

export function PlayerChip() {
  const { account, profile, ready, isGuest } = useApp();

  if (!ready) {
    return (
      <div className="flex h-11 items-center rounded-full bg-pan px-5 font-mono text-[11px] tracking-widest text-mut">
        LOADING…
      </div>
    );
  }
  if (!account) {
    return (
      <PillButton href="/signin" size="sm" className="h-11">
        Sign In
      </PillButton>
    );
  }
  return (
    <Link
      href="/settings"
      className="focus-ring flex h-11 items-center gap-4 rounded-full bg-pan px-5 transition-colors hover:bg-pan2"
    >
      <span className="flex max-w-32 items-center gap-2 truncate font-mono text-[11px] font-bold tracking-widest">
        {isGuest ? <Ghost className="size-3.5 shrink-0" /> : null}
        {account.displayName || account.username}
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-mut">
        <Coins className="size-3.5" />
        {profile.coins}
      </span>
      <span className="flex items-center gap-1.5 font-mono text-[11px] text-mut">
        <Skull className="size-3.5" />
        {profile.totalDeaths}
      </span>
    </Link>
  );
}

export function ScreenShell({
  title,
  sub,
  children,
  rightExtra,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  rightExtra?: ReactNode;
}) {
  return (
    <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-5 pt-5 pb-16 sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <PillButton href="/" variant="ghost" size="sm" icon={<ArrowLeft className="size-3.5" />}>
          Menu
        </PillButton>
        <div className="flex items-center gap-3">
          {rightExtra}
          <PlayerChip />
          <ThemeToggle />
        </div>
      </header>

      <div className="mt-10 mb-8">
        <div className="mb-3 flex items-center gap-3">
          <svg width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
            <rect x="9" y="6" width="14" height="14" fill="currentColor" />
            <rect x="12" y="11" width="4" height="2" fill="var(--bg)" />
            <rect x="18" y="11" width="4" height="2" fill="var(--bg)" />
          </svg>
          <span className="font-mono text-[10px] tracking-[0.3em] text-mut">
            EXOTIC PLATFORMING UNIT
          </span>
        </div>
        <h1 className="animate-fade-up text-[clamp(2.6rem,7vw,5rem)] leading-[0.95] font-bold tracking-tight">
          {title}
        </h1>
        {sub ? (
          <p className="mt-3 max-w-2xl animate-fade-up font-mono text-xs tracking-[0.2em] text-mut [animation-delay:80ms]">
            {sub}
          </p>
        ) : null}
      </div>
      {children}

      <footer className="mt-auto flex items-center justify-between pt-16 font-mono text-[10px] tracking-[0.3em] text-mut">
        <span>EXOTIC CO.</span>
        <span className="hidden sm:block">THE FLOOR IS A LIE</span>
        <span>EST. RAGE</span>
      </footer>
    </div>
  );
}

/** Live-updating guest notice used on gated screens. */
export function GuestLock({ what }: { what: string }) {
  return (
    <div className="grid place-items-center rounded-3xl bg-pan px-8 py-20 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-pan2">
        <Ghost className="size-7" />
      </span>
      <h3 className="mt-6 text-2xl font-bold tracking-tight">{what} ARE GUEST-LOCKED.</h3>
      <p className="mt-2 max-w-sm font-mono text-[11px] leading-relaxed tracking-[0.2em] text-mut">
        GUEST ACCOUNTS CAN PLAY EVERYTHING, BUT {what} REQUIRE A REAL ACCOUNT. YOUR PAIN DESERVES A
        PERMANENT RECORD.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <PillButton href="/signup">Create Account</PillButton>
        <PillButton href="/signin" variant="soft">
          Sign In
        </PillButton>
      </div>
    </div>
  );
}
