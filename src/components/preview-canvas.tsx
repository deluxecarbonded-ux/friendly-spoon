"use client";

import { useEffect, useMemo, useRef } from "react";
import { PreviewPlayer, levelPreviewSpec, previewSpecFor } from "@/game/preview";
import { useApp } from "./providers";
import { cn } from "@/lib/utils";

/**
 * Live animated preview card. Renders the actual level (or shop item demo
 * scene) being played for real by the in-game bot — a true video preview,
 * not a screenshot.
 */
export function PreviewCanvas({
  itemId,
  levelId,
  className,
}: {
  itemId?: string;
  levelId?: number;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerRef = useRef<PreviewPlayer | null>(null);
  const { theme } = useApp();

  const spec = useMemo(() => {
    if (itemId) return previewSpecFor(itemId);
    if (levelId) return levelPreviewSpec(levelId);
    return null;
  }, [itemId, levelId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !spec) return;

    const fit = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.width = Math.max(2, Math.floor(rect.width * dpr));
      canvas.height = Math.max(2, Math.floor(rect.height * dpr));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(canvas);

    const player = new PreviewPlayer(canvas, spec, theme);
    playerRef.current = player;

    // pause when off-screen
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            player.engine.paused = false;
          } else {
            player.engine.paused = true;
          }
        }
      },
      { rootMargin: "80px" },
    );
    io.observe(canvas);

    return () => {
      ro.disconnect();
      io.disconnect();
      player.destroy();
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec]);

  useEffect(() => {
    playerRef.current?.setPalette(theme);
  }, [theme]);

  if (!spec) return null;

  return <canvas ref={canvasRef} className={cn("h-full w-full", className)} />;
}
