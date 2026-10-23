"use client";

import { ScreenShell } from "@/components/screen-shell";
import { useApp } from "@/components/providers";

const ROLES = [
  ["GAME DIRECTION", "THE EXOTIC TEAM"],
  ["TROLL PHYSICS", "THE EXOTIC TEAM"],
  ["TRAP ARCHITECTURE", "THE EXOTIC TEAM"],
  ["UI & MOTION DESIGN", "THE EXOTIC TEAM"],
  ["SOUND SYNTHESIS", "THE EXOTIC TEAM — MADE OF MATH, LIVE"],
  ["QUALITY ASSURANCE", "FAILED ON PURPOSE"],
  ["PLAYER EMOTIONAL SUPPORT", "NOT AVAILABLE"],
];

export default function CreditsPage() {
  const { profile, maxCompleted, levels } = useApp();

  return (
    <ScreenShell title="CREDITS" sub="EVERY SQUARE, EVERY BETRAYAL — DESIGNED AND ENGINEERED BY HUMANS.">
      <div className="max-w-3xl">
        <p className="mb-12 animate-fade-up text-[clamp(1.3rem,3vw,1.8rem)] leading-snug font-medium">
          EXOTIC was built by hand: every tile placed to be trusted once, every
          flag raised to be doubted forever. No asset stores, no template
          levels — just humans who understand exactly where you&apos;ll jump.
        </p>

        <div className="flex flex-col gap-1">
          {ROLES.map(([role, who], i) => (
            <div
              key={role}
              style={{ animationDelay: `${i * 60}ms` }}
              className="flex animate-fade-up flex-wrap items-baseline justify-between gap-2 rounded-2xl px-5 py-4 transition-colors hover:bg-pan"
            >
              <span className="font-mono text-[11px] tracking-[0.3em] text-mut">{role}</span>
              <span className="font-mono text-xs font-bold tracking-[0.2em]">{who}</span>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-3xl bg-fg p-8 text-bg">
          <p className="font-mono text-[10px] tracking-[0.35em] opacity-60">YOUR PERMANENT RECORD</p>
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 font-mono">
            <span>
              <span className="block text-4xl font-bold tracking-tight">{profile.totalDeaths}</span>
              <span className="text-[10px] tracking-[0.3em] opacity-60">DEATHS</span>
            </span>
            <span>
              <span className="block text-4xl font-bold tracking-tight">
                {maxCompleted}/{levels.length || 6}
              </span>
              <span className="text-[10px] tracking-[0.3em] opacity-60">CLEARED</span>
            </span>
            <span>
              <span className="block text-4xl font-bold tracking-tight">{profile.coins}</span>
              <span className="text-[10px] tracking-[0.3em] opacity-60">COINS</span>
            </span>
          </div>
        </div>

        <p className="mt-12 font-mono text-[11px] leading-relaxed tracking-[0.2em] text-mut">
          DEDICATED TO EVERYONE WHO TRUSTED THE FLOOR.
          <br />
          THE FLOOR THANKS YOU. THE FLOOR IS GONE.
        </p>
        <p className="mt-6 font-mono text-[10px] tracking-[0.3em] text-mut">
          © EXOTIC CO. — NO SPIKES WERE HARMED.
        </p>
      </div>
    </ScreenShell>
  );
}
