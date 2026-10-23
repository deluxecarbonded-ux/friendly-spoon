// Live "video card" previews: a bot genuinely plays real EXOTIC levels (and
// small shop-demo scenes) on canvas. Same engine, same physics, same traps.

import { Engine, PALETTES, TILE } from "./engine";
import type { Palette } from "./engine";
import type { LevelDef } from "./levels";
import { getLevel } from "./levels";

const R = (ch: string, n: number) => ch.repeat(n);

function grid(W: number, H: number, pieces: Array<[number, number, string]>): string[] {
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill(" "));
  for (const [r, c, s] of pieces) {
    for (let i = 0; i < s.length; i++) {
      if (r >= 0 && r < H && c + i >= 0 && c + i < W) g[r][c + i] = s[i];
    }
  }
  return g.map((row) => row.join(""));
}

export interface BotConfig {
  lemming?: boolean;
  clumsy?: boolean;
  wrapAtCol?: number;
  script?: (eng: Engine, dt: number) => void;
}

export function makeBot(cfg: BotConfig) {
  let jumpHold = 0;
  let jumpPressed = false;
  let idleMs = 0;
  let lastX = -1;
  return (eng: Engine, dt: number) => {
    eng.input.left = false;
    eng.input.right = true;

    if (!cfg.lemming) {
      const supportRow = eng.gravSign === 1
        ? Math.floor((eng.py + eng.ph + 4) / TILE)
        : Math.floor((eng.py - 4) / TILE);
      const midRow = Math.floor((eng.py + eng.ph / 2) / TILE);
      const ahead = Math.floor((eng.px + eng.pw + 10) / TILE);
      const wall = eng.solidAt(ahead, midRow);
      const noFloor = !eng.solidAt(ahead, supportRow) && !eng.hazardAt(ahead, supportRow);
      const spike =
        eng.hazardAt(ahead, supportRow) ||
        eng.hazardAt(ahead + 1, supportRow - (eng.gravSign === 1 ? 1 : -1));
      const guard = eng.guardInFront(3);
      if (jumpHold > 0) {
        eng.input.jumpHeld = true;
        if (!jumpPressed) {
          eng.press("Space", true);
          jumpPressed = true;
        }
        jumpHold -= dt;
      } else {
        eng.input.jumpHeld = false;
        if (jumpPressed) {
          eng.press("Space", false);
          jumpPressed = false;
        }
        if (eng.grounded && (wall || noFloor || spike || guard)) {
          if (cfg.clumsy && Math.random() < 0.35) {
            jumpHold = 0; // sometimes the bot just... doesn't
          } else {
            jumpHold = 0.15 + Math.random() * 0.06;
            eng.input.jumpHeld = true;
            eng.press("Space", true);
            jumpPressed = true;
          }
        }
      }
    } else {
      eng.input.jumpHeld = false;
    }

    cfg.script?.(eng, dt);

    if (cfg.wrapAtCol && eng.px > cfg.wrapAtCol * TILE) {
      eng.rebuild(true); // re-hide traps so each loop shows them springing
      lastX = -1;
      idleMs = 0;
      return;
    }
    if (lastX >= 0 && Math.abs(eng.px - lastX) < 1.5) idleMs += dt * 1000;
    else idleMs = 0;
    lastX = eng.px;
    if (idleMs > 2800) {
      eng.rebuild(true);
      idleMs = 0;
      lastX = -1;
    }
  };
}

// ———————————————————— SHOP SCENES ————————————————————

function skinScene(): { level: LevelDef; cfg: BotConfig } {
  const level: LevelDef = {
    id: 101, name: "SKIN DEMO", tip: "", par: 0, W: 30, H: 8,
    rows: grid(30, 8, [
      [4, 0, R("#", 30)], [5, 0, R("#", 30)],
      [3, 2, "S"],
      [3, 9, "#"],
      [2, 14, "C"],
      [3, 19, "^"],
      [2, 24, "CC"],
    ]),
    events: [],
  };
  return { level, cfg: { wrapAtCol: 27 } };
}

function revealScene(): { level: LevelDef; cfg: BotConfig } {
  const level: LevelDef = {
    id: 102, name: "TRAP-SCOPE DEMO", tip: "", par: 0, W: 30, H: 8,
    rows: grid(30, 8, [
      [4, 0, R("#", 30)], [5, 0, R("#", 30)],
      [3, 2, "S"],
      [2, 10, "HH"],
      [4, 14, "DDDD"], [5, 14, "    "],
      [3, 19, "F"],
      [3, 23, "^"],
    ]),
    events: [],
  };
  let flash = 0;
  return {
    level,
    cfg: {
      wrapAtCol: 27,
      script: (eng) => {
        if (eng.runMs > flash + 2600) {
          flash = eng.runMs;
          eng.revealFlash(1400);
        }
      },
    },
  };
}

function passScene(): { level: LevelDef; cfg: BotConfig } {
  const level: LevelDef = {
    id: 103, name: "ANCHOR DEMO", tip: "", par: 0, W: 30, H: 8,
    rows: grid(30, 8, [
      [4, 0, R("#", 30)], [5, 0, R("#", 30)],
      [3, 2, "S"],
      [3, 13, "^"],
      [3, 17, "^"],
      [3, 21, "^"],
    ]),
    events: [],
  };
  let dropped = false;
  return {
    level,
    cfg: {
      clumsy: true,
      wrapAtCol: 27,
      script: (eng) => {
        if (!dropped && eng.grounded && eng.px > 11 * TILE) {
          eng.placeCheckpoint();
          dropped = true;
        }
        if (eng.px < 2 * TILE) dropped = false;
      },
    },
  };
}

function skipScene(): { level: LevelDef; cfg: BotConfig } {
  const level: LevelDef = {
    id: 104, name: "SKIP DEMO", tip: "", par: 0, W: 34, H: 8,
    rows: grid(34, 8, [
      [4, 0, R("#", 34)], [5, 0, R("#", 34)],
      [3, 2, "S"],
      [2, 9, "CCC"],
      [2, 17, "CC"],
      [3, 28, "G"],
    ]),
    events: [
      { type: "goalshift", x: 22, y: 0, w: 4, h: 8, dx: -9, once: true, text: "NOPE." },
    ],
  };
  return { level, cfg: { wrapAtCol: 31 } };
}

function tauntScene(): { level: LevelDef; cfg: BotConfig } {
  const level: LevelDef = {
    id: 105, name: "TAUNT DEMO", tip: "", par: 0, W: 22, H: 8,
    rows: grid(22, 8, [
      [4, 0, R("#", 22)], [5, 0, R("#", 22)],
      [3, 2, "S"],
      [3, 12, "^"],
      [3, 18, "^"],
    ]),
    events: [],
  };
  return { level, cfg: { lemming: true } };
}

export interface PreviewSpec {
  level: LevelDef;
  cfg: BotConfig;
  engineSkin?: string;
  engineTrail?: string;
  tauntKey?: string;
}

export function previewSpecFor(itemId: string): PreviewSpec | null {
  if (itemId.startsWith("skin:")) {
    const { level, cfg } = skinScene();
    return { level, cfg, engineSkin: itemId };
  }
  if (itemId.startsWith("trail:")) {
    const { level, cfg } = skinScene();
    return { level, cfg, engineTrail: itemId };
  }
  if (itemId === "gear:reveal") { const s = revealScene(); return s; }
  if (itemId === "gear:pass") { const s = passScene(); return s; }
  if (itemId === "gear:skip") { const s = skipScene(); return s; }
  if (itemId.startsWith("taunt:")) {
    const { level, cfg } = tauntScene();
    return { level, cfg, tauntKey: itemId.replace("taunt:", "") };
  }
  return null;
}

export function levelPreviewSpec(levelId: number): PreviewSpec | null {
  const level = getLevel(levelId);
  if (!level) return null;
  return { level, cfg: { wrapAtCol: Math.max(24, level.W - 3) } };
}

// ———————————————————— PREVIEW PLAYER ————————————————————

export class PreviewPlayer {
  engine: Engine;
  constructor(canvas: HTMLCanvasElement, spec: PreviewSpec, theme: "light" | "dark", viewW = 384, viewH = 216) {
    this.engine = new Engine(
      spec.level,
      PALETTES[theme],
      {},
      {
        viewW,
        viewH,
        silent: true,
        drawToastsOnCanvas: true,
        skin: spec.engineSkin,
        trail: spec.engineTrail,
        tauntKey: spec.tauntKey,
        controller: makeBot(spec.cfg),
      },
    );
    this.engine.attach(canvas);
    this.engine.start();
  }
  setPalette(theme: "light" | "dark") {
    this.engine.setPalette(PALETTES[theme]);
  }
  destroy() { this.engine.destroy(); }
}

export type { Palette };
