"use client";

import { useEffect, useRef, useState } from "react";
import { sfx } from "@/game/audio";
import { cn } from "@/lib/utils";

const LINES = [
  "LOADING RAGE",
  "CALIBRATING BETRAYAL PHYSICS",
  "HIDING BLOCKS IN PLAIN SIGHT",
  "TEACHING FLAGS TO LIE",
  "POLISHING 1,204 SPIKES",
  "BRIEFING THE FLOOR",
  "READY. PROBABLY.",
];

const LETTERS = ["E", "X", "O", "T", "I", "C"];

export function Splash({ onDone }: { onDone: () => void }) {
  const [progress, setProgress] = useState(0);
  const [leaving, setLeaving] = useState(false);
  const doneRef = useRef(false);

  useEffect(() => {
    const start = performance.now();
    const DURATION = 2600;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / DURATION);
      setProgress(t);
      if (t >= 1 && !doneRef.current) {
        doneRef.current = true;
        setLeaving(true);
        window.setTimeout(onDone, 450);
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const skip = () => {
      if (doneRef.current) return;
      doneRef.current = true;
      cancelAnimationFrame(raf);
      sfx.boot();
      setLeaving(true);
      window.setTimeout(onDone, 250);
    };
    window.addEventListener("pointerdown", skip);
    window.addEventListener("keydown", skip);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("pointerdown", skip);
      window.removeEventListener("keydown", skip);
    };
  }, [onDone]);

  const lineIdx = Math.min(LINES.length - 1, Math.floor(progress * LINES.length));

  return (
    <div
      className={cn(
        "fixed inset-0 z-[200] flex flex-col items-center justify-center bg-bg text-fg transition-opacity duration-500",
        leaving && "pointer-events-none opacity-0",
      )}
    >
      {/* corner meta */}
      <div className="absolute top-6 left-6 font-mono text-[10px] tracking-[0.3em] text-mut">
        EXOTIC PLATFORMING UNIT
      </div>
      <div className="absolute top-6 right-6 font-mono text-[10px] tracking-[0.3em] text-mut">
        V6.6.6
      </div>
      <div className="absolute bottom-6 left-6 font-mono text-[10px] tracking-[0.3em] text-mut">
        MONOCHROME BUILD
      </div>
      <div className="absolute right-6 bottom-6 font-mono text-[10px] tracking-[0.3em] text-mut">
        TAP TO SKIP
      </div>

      <div className="mb-2 flex overflow-hidden">
        {LETTERS.map((l, i) => (
          <span
            key={i}
            className="animate-rise text-[clamp(4rem,16vw,10rem)] leading-none font-bold tracking-tight"
            style={{ animationDelay: `${i * 70}ms`, animationDuration: "0.9s" }}
          >
            {l}
          </span>
        ))}
      </div>

      <div className="mb-8 flex items-center gap-4">
        <svg width="48" height="48" viewBox="0 0 32 32" aria-hidden="true">
          <rect x="9" y="6" width="14" height="14" fill="currentColor" />
          <rect x="12" y="11" width="4" height="2" fill="var(--bg)" />
          <rect x="18" y="11" width="4" height="2" fill="var(--bg)" />
        </svg>
        <p className="font-mono text-[11px] tracking-[0.4em] text-mut">
          A GAME THAT HATES YOU BACK
        </p>
      </div>

      <div className="h-2 w-64 overflow-hidden rounded-full bg-pan">
        <div
          className="h-full rounded-full bg-fg transition-[width] duration-100"
          style={{ width: `${Math.round(progress * 100)}%` }}
        />
      </div>
      <div className="mt-4 flex h-5 items-center gap-2 font-mono text-[11px] tracking-widest text-mut">
        <span className="inline-block size-1.5 animate-blink bg-fg" />
        {LINES[lineIdx]}
        <span className="text-fg">{Math.round(progress * 100)}%</span>
      </div>
    </div>
  );
}
