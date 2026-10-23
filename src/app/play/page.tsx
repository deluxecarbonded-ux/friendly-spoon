"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { GameScreen } from "@/components/game-screen";
import { useApp } from "@/components/providers";
import { getLevel } from "@/game/levels";


function PlayInner() {
  const sp = useSearchParams();
  const { progress, unlockedLevel, maxCompleted, levels } = useApp();

  let target = Number(sp.get("level") || 0);
  if (!target || !getLevel(target)) {
    // continue at the first unfinished level
    const completed = new Set(progress.filter((p) => p.completed).map((p) => p.levelId));
    const ids = levels.map((m) => m.id);
    const firstOpen = ids.find((id) => !completed.has(id)) ?? (ids.length || 6);
    target = Math.min(firstOpen, Math.max(unlockedLevel, maxCompleted + 1), ids.length || 6) || 1;
    target = Math.max(1, Math.min(ids.length || 6, target));
  }
  return <GameScreen levelId={target} key={target} />;
}

export default function PlayPage() {
  return (
    <Suspense
      fallback={
        <div className="relative z-10 grid min-h-screen place-items-center">
          <p className="animate-blink font-mono text-xs tracking-[0.35em] text-mut">WARMING UP SPIKES…</p>
        </div>
      }
    >
      <PlayInner />
    </Suspense>
  );
}
