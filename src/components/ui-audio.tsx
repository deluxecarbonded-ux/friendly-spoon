"use client";

import { useEffect } from "react";
import { sfx } from "@/game/audio";

const INTERACTIVE =
  'button, a[href], input, select, textarea, summary, [role="button"], [role="link"], [role="tab"], [role="menuitem"], [data-sfx]';

type SoundKind =
  | "click"
  | "nav"
  | "select"
  | "toggle"
  | "open"
  | "close"
  | "volume"
  | "success"
  | "error";

function interactiveFrom(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof Element)) return null;
  return target.closest(INTERACTIVE) as HTMLElement | null;
}

function isDisabled(el: HTMLElement) {
  if (
    (el instanceof HTMLButtonElement ||
      el instanceof HTMLInputElement ||
      el instanceof HTMLSelectElement ||
      el instanceof HTMLTextAreaElement) &&
    el.disabled
  ) {
    return true;
  }
  return el.getAttribute("aria-disabled") === "true";
}

function soundFor(el: HTMLElement): SoundKind | null {
  const explicit = el.getAttribute("data-sfx");
  if (explicit === "none") return null;
  if (explicit === "click") return "click";
  if (explicit === "nav") return "nav";
  if (explicit === "select") return "select";
  if (explicit === "toggle") return "toggle";
  if (explicit === "open") return "open";
  if (explicit === "close") return "close";
  if (explicit === "volume") return "volume";
  if (explicit === "success") return "success";
  if (explicit === "error") return "error";
  if (el.matches("a[href]")) return "nav";
  if (el.matches('input[type="range"]')) return "volume";
  if (el.matches("input, select, textarea")) return "select";
  return "click";
}

function play(kind: SoundKind) {
  switch (kind) {
    case "nav":
      sfx.nav();
      break;
    case "select":
      sfx.select();
      break;
    case "toggle":
      sfx.toggle();
      break;
    case "open":
      sfx.open();
      break;
    case "close":
      sfx.close();
      break;
    case "volume":
      sfx.slider();
      break;
    case "success":
      sfx.success();
      break;
    case "error":
      sfx.denied();
      break;
    default:
      sfx.click();
  }
}

/**
 * One global audio layer for every control in the app.
 * It covers pointer clicks, keyboard activation, hovers, typing, sliders,
 * navigation, and unlocks the WebAudio context on the first user gesture.
 */
export function UiAudio() {
  useEffect(() => {
    let unlocked = false;
    let lastHover = 0;
    let lastType = 0;
    let lastVolume = 0;
    let hovered: HTMLElement | null = null;

    const unlock = () => {
      if (unlocked) return;
      unlocked = true;
      sfx.unlock();
    };

    const onClick = (event: MouseEvent) => {
      if (!unlocked) unlock();
      const el = interactiveFrom(event.target);
      if (!el || isDisabled(el)) return;
      const kind = soundFor(el);
      if (kind) play(kind);
    };

    const onPointerOver = (event: PointerEvent) => {
      if (!unlocked || event.pointerType !== "mouse") return;
      const el = interactiveFrom(event.target);
      if (!el || el === hovered || isDisabled(el) || el.getAttribute("data-sfx") === "none") return;
      hovered = el;
      const now = performance.now();
      if (now - lastHover < 45) return;
      lastHover = now;
      sfx.hover();
    };

    const onPointerOut = (event: PointerEvent) => {
      const el = interactiveFrom(event.target);
      if (!el) return;
      const next = event.relatedTarget instanceof Element ? interactiveFrom(event.relatedTarget) : null;
      if (next !== el) hovered = null;
    };

    const onInput = (event: Event) => {
      if (!unlocked) return;
      const el = event.target;
      if (!(el instanceof HTMLInputElement) || el.type !== "range") return;
      const now = performance.now();
      if (now - lastVolume < 45) return;
      lastVolume = now;
      sfx.slider();
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (!unlocked || event.isComposing || event.ctrlKey || event.metaKey || event.altKey) return;
      const el = event.target;
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) return;
      if (el instanceof HTMLInputElement && ["range", "checkbox", "radio", "submit", "button"].includes(el.type)) {
        return;
      }
      const typing =
        event.key.length === 1 || event.key === "Backspace" || event.key === "Delete";
      if (!typing) return;
      const now = performance.now();
      if (now - lastType < 28) return;
      lastType = now;
      sfx.type();
    };

    document.addEventListener("pointerdown", unlock, { capture: true, once: true });
    document.addEventListener("keydown", unlock, { capture: true, once: true });
    document.addEventListener("click", onClick, true);
    document.addEventListener("pointerover", onPointerOver, true);
    document.addEventListener("pointerout", onPointerOut, true);
    document.addEventListener("input", onInput, true);
    document.addEventListener("keydown", onKeyDown, true);

    return () => {
      document.removeEventListener("pointerdown", unlock, true);
      document.removeEventListener("keydown", unlock, true);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("pointerover", onPointerOver, true);
      document.removeEventListener("pointerout", onPointerOut, true);
      document.removeEventListener("input", onInput, true);
      document.removeEventListener("keydown", onKeyDown, true);
    };
  }, []);

  return null;
}
