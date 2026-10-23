"use client";

import { useEffect, useRef } from "react";
import { useApp } from "./providers";

// Full-viewport ambient canvas: slow drifting monochrome squares. Flat fills only.
export function Ambient() {
  const ref = useRef<HTMLCanvasElement>(null);
  const { theme } = useApp();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let dpr = Math.min(2, window.devicePixelRatio || 1);

    const squares = Array.from({ length: 34 }, (_, i) => ({
      x: Math.random(),
      y: Math.random(),
      s: 8 + Math.random() * ((i % 6 === 0) ? 90 : 26),
      v: 0.006 + Math.random() * 0.02,
      drift: (Math.random() - 0.5) * 0.008,
      a: 0.025 + Math.random() * 0.05,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.0006,
    }));

    let mx = 0;
    let my = 0;
    const onMouse = (e: MouseEvent) => {
      mx = (e.clientX / window.innerWidth - 0.5) * 14;
      my = (e.clientY / window.innerHeight - 0.5) * 14;
    };

    const resize = () => {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
    };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMouse);

    let raf = 0;
    let last = performance.now();
    let visible = true;
    const onVis = () => {
      visible = document.visibilityState === "visible";
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVis);

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (!visible) return;
      const dark = themeRef.current === "dark";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = dark ? "#ffffff" : "#000000";
      for (const sq of squares) {
        sq.y -= sq.v * dt;
        sq.x += sq.drift * dt;
        sq.rot += sq.vr * (dt * 1000);
        if (sq.y < -0.15) sq.y = 1.15;
        if (sq.x < -0.15) sq.x = 1.15;
        if (sq.x > 1.15) sq.x = -0.15;
        const px = sq.x * w + mx * (0.3 + sq.a * 8);
        const py = sq.y * h + my * (0.3 + sq.a * 8);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(sq.rot);
        ctx.globalAlpha = sq.a;
        ctx.fillRect(-sq.s / 2, -sq.s / 2, sq.s, sq.s);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMouse);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className="pointer-events-none fixed inset-0 z-0" />;
}
