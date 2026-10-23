import { FAKE_CHECKPOINT_MESSAGE, FAKE_FLAG_MESSAGE, TAUNTS } from "@/lib/catalog";
import { sfx } from "./audio";
import type { LevelDef } from "./levels";

export const TILE = 32;

// physical key codes — arrows AND wasd both always work
const LEFT_CODES = ["ArrowLeft", "KeyA"];
const RIGHT_CODES = ["ArrowRight", "KeyD"];
const JUMP_CODES = ["Space", "ArrowUp", "KeyW"];
const ALL_INPUT_CODES = [...LEFT_CODES, ...RIGHT_CODES, ...JUMP_CODES, "ArrowDown", "KeyS"];

// ———————————————————— PALETTES (flat, monochrome) ————————————————————

export interface Palette {
  bg: string;
  tile: string;
  player: string;
  accent: string;   // coins / secondary
  subtle: string;   // signs / decorations
  far: string;      // parallax squares
  text: string;
}

export const PALETTES: Record<"light" | "dark", Palette> = {
  light: { bg: "#f1f1ee", tile: "#191919", player: "#000000", accent: "#7c7c7c", subtle: "#a2a2a2", far: "#000000", text: "#000000" },
  dark: { bg: "#0b0b0c", tile: "#e8e8e6", player: "#fafafa", accent: "#8c8c8c", subtle: "#5c5c5c", far: "#ffffff", text: "#fafafa" },
};

// ———————————————————— TYPES ————————————————————

interface Particle {
  x: number; y: number; vx: number; vy: number;
  life: number; maxLife: number; size: number; color: string; grav: number;
}

interface RainSpike { col: number; y: number; vy: number; landed: boolean; landRow: number; }

interface TrackedDTile { col: number; row: number; timer: number; gone: boolean; fy: number; }

interface Guard {
  col: number; row: number;
  x: number; y: number; w: number; h: number;
  spawnX: number; dir: 1 | -1; spawnDir: 1 | -1;
  fake: boolean; alive: boolean; discovered: boolean;
}

interface TrapButton {
  col: number; row: number;
  /** Pixel row the button base sits on — snapped to the first solid tile below it. */
  baseY: number;
  fake: boolean; pressed: boolean; discovered: boolean;
}

interface Drone {
  x: number; y: number; w: number; h: number;
  phase: number; armedAt: number; alive: boolean;
}

interface EventRuntime { fired: boolean; nextAt: number; }

export interface InputState { left: boolean; right: boolean; jumpHeld: boolean; }

export interface EngineCallbacks {
  onDeath?: (info: { count: number; message: string }) => void;
  onWin?: (stats: { timeMs: number; deaths: number; coins: number }) => void;
  onToast?: (text: string) => void;
  onCoin?: (total: number) => void;
  onCheckpoint?: () => void;
}

export interface EngineOptions {
  viewW?: number;
  viewH?: number;
  silent?: boolean;
  drawToastsOnCanvas?: boolean;
  shakeEnabled?: boolean;
  keyboard?: boolean;
  skin?: string;
  trail?: string;
  tauntKey?: string;
  controller?: (eng: Engine, dtSec: number) => void;
}

const GRAV = 2100;
const MAX_FALL = 1500;
const JUMP_VEL = 660;
const SPRING_VEL = 900;
const RUN_ACCEL = 3400;
const AIR_ACCEL = 2300;
const FRICTION = 3000;
const MAX_RUN = 305;
const COYOTE = 0.09;
const BUFFER = 0.12;

function seededRand(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export class Engine {
  level: LevelDef;
  pal: Palette;
  cb: EngineCallbacks;
  opts: EngineOptions;
  input: InputState = { left: false, right: false, jumpHeld: false };

  // public state (read by bot / HUD)
  px = 0; py = 0; pw = 22; ph = 26;
  vx = 0; vy = 0;
  gravSign: 1 | -1 = 1;
  grounded = false;
  dead = false;
  won = false;
  paused = false;
  started = false;
  deaths = 0;
  coins = 0;
  runMs = 0;
  levelW: number;
  levelH: number;

  skin = "skin:solid";
  trail = "trail:none";
  tauntKey = "classic";

  // internals
  private grid: string[][] = [];
  private spawn = { x: 0, y: 0 };
  private respawn = { x: 0, y: 0 };
  private goal = { col: 0, row: 0, x: 0, y: 0 };
  private goalDrawX = 0;
  private checkpoints: Array<{ col: number; row: number; fake: boolean; discovered: boolean; active: boolean }> = [];
  private placedFlag: { x: number; y: number } | null = null;
  private coinMap = new Map<string, { col: number; row: number; taken: boolean; fake: boolean }>();
  private dMap = new Map<string, TrackedDTile>();
  private pMap = new Map<string, TrackedDTile>();
  private guards: Guard[] = [];
  private buttons: TrapButton[] = [];
  private drones: Drone[] = [];
  private hRevealed = new Set<string>();
  private xRevealed = new Set<string>();
  /** Traps the player has sprung. Survives death + restart so the level is learnable. */
  private discovered = new Set<string>();
  private armAnim = new Map<string, number>();
  private rainSpikes: RainSpike[] = [];
  private evRuntime: EventRuntime[] = [];
  private particles: Particle[] = [];
  private trailBuf: Array<{ x: number; y: number }> = [];
  private trailClock = 0;
  private camX = 0;
  private shake = 0;
  private flashUntil = 0;
  private revealUntil = 0;
  private reverseUntil = 0;
  private deadUntil = 0;
  private coyoteT = 0;
  private landT = 0;
  private keys = new Set<string>();
  private touchKeys = new Set<string>();
  private lastJumpPress = -1e9;
  private inputBound = false;
  private toastText = "";
  private toastUntil = 0;
  private clock = 0;
  private raf = 0;
  private lastTs = 0;
  private acc = 0;
  private farSquares: Array<{ x: number; y: number; s: number; a: number }> = [];

  get viewW() { return this.opts.viewW ?? 960; }
  get viewH() { return this.opts.viewH ?? 540; }

  get reversed() { return this.clock < this.reverseUntil; }

  constructor(level: LevelDef, palette: Palette, cb: EngineCallbacks = {}, opts: EngineOptions = {}) {
    this.level = level;
    this.pal = palette;
    this.cb = cb;
    this.opts = opts;
    if (opts.skin) this.skin = opts.skin;
    if (opts.trail) this.trail = opts.trail;
    if (opts.tauntKey) this.tauntKey = opts.tauntKey;
    this.levelW = level.W * TILE;
    this.levelH = level.H * TILE;
    this.build();

    const rnd = seededRand(level.id * 7919 + 13);
    for (let i = 0; i < 46; i++) {
      this.farSquares.push({
        x: rnd() * 4200,
        y: rnd() * this.viewH,
        s: 6 + rnd() * 34,
        a: 0.03 + rnd() * 0.07,
      });
    }
    if (opts.keyboard) this.bindInput();
  }

  // ———————————————————— INPUT (keyboard + virtual touch) ————————————————————

  private onKeyDown = (e: KeyboardEvent) => {
    if (ALL_INPUT_CODES.includes(e.code)) e.preventDefault();
    this.keys.add(e.code);
    if (!e.repeat && JUMP_CODES.includes(e.code)) {
      this.lastJumpPress = performance.now();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  private onBlur = () => {
    this.keys.clear();
    this.touchKeys.clear();
  };

  bindInput() {
    if (this.inputBound) return;
    this.inputBound = true;
    window.addEventListener("keydown", this.onKeyDown, { capture: true });
    window.addEventListener("keyup", this.onKeyUp, { capture: true });
    window.addEventListener("blur", this.onBlur);
    document.addEventListener("visibilitychange", this.onBlur);
  }

  unbindInput() {
    if (!this.inputBound) return;
    this.inputBound = false;
    window.removeEventListener("keydown", this.onKeyDown, { capture: true });
    window.removeEventListener("keyup", this.onKeyUp, { capture: true });
    window.removeEventListener("blur", this.onBlur);
    document.removeEventListener("visibilitychange", this.onBlur);
    this.onBlur();
  }

  /** Virtual button press (touch controls). */
  press(code: string, down: boolean) {
    if (down) {
      this.touchKeys.add(code);
      if (JUMP_CODES.includes(code)) this.lastJumpPress = performance.now();
    } else {
      this.touchKeys.delete(code);
    }
  }

  // ———————————————————— BUILD / RESET ————————————————————

  build() {
    const L = this.level;
    this.grid = L.rows.map((r) => r.split(""));
    this.coinMap.clear();
    this.dMap.clear();
    this.pMap.clear();
    this.guards = [];
    this.buttons = [];
    this.drones = [];
    this.hRevealed.clear();
    this.xRevealed.clear();
    this.checkpoints = [];
    this.rainSpikes = [];
    this.placedFlag = null;
    this.evRuntime = L.events.map(() => ({ fired: false, nextAt: 0 }));
    this.particles = [];
    this.trailBuf = [];
    this.deaths = 0;
    this.coins = 0;
    this.runMs = 0;
    this.won = false;
    this.dead = false;
    this.gravSign = 1;
    this.reverseUntil = 0;
    this.revealUntil = 0;
    this.shake = 0;

    for (let r = 0; r < L.H; r++) {
      for (let c = 0; c < L.W; c++) {
        const ch = this.grid[r][c];
        if (ch === "S") {
          this.spawn = { x: c * TILE + (TILE - this.pw) / 2, y: (r + 1) * TILE - this.ph };
          this.grid[r][c] = " ";
        } else if (ch === "G") {
          this.goal = { col: c, row: r, x: c * TILE, y: r * TILE };
          this.goalDrawX = c * TILE;
          this.grid[r][c] = " ";
        } else if (ch === "C" || ch === "c") {
          this.coinMap.set(`${c},${r}`, { col: c, row: r, taken: false, fake: ch === "c" });
          this.grid[r][c] = " ";
        } else if (ch === "P" || ch === "F") {
          this.checkpoints.push({ col: c, row: r, fake: ch === "F", discovered: false, active: false });
          this.grid[r][c] = " ";
        } else if (ch === "D") {
          this.dMap.set(`${c},${r}`, { col: c, row: r, timer: 0, gone: false, fy: 0 });
        } else if (ch === "_") {
          this.pMap.set(`${c},${r}`, { col: c, row: r, timer: 0, gone: false, fy: 0 });
        } else if (ch === "E" || ch === "e") {
          const w = 24, h = 24;
          this.guards.push({
            col: c, row: r,
            x: c * TILE + (TILE - w) / 2, y: (r + 1) * TILE - h,
            w, h,
            spawnX: c * TILE + (TILE - w) / 2,
            dir: 1, spawnDir: 1,
            fake: ch === "e", alive: true, discovered: false,
          });
          this.grid[r][c] = " ";
        } else if (ch === "O" || ch === "o") {
          this.buttons.push({
            col: c,
            row: r,
            baseY: (r + 1) * TILE,
            fake: ch === "o",
            pressed: false,
            discovered: false,
          });
          this.grid[r][c] = " ";
        }
      }
    }

    // Level authors place buttons on the tile row above their ground. Snap the
    // visual/collision base to the first solid surface underneath so a button
    // can never float over a platform or sit inside a floor.
    for (const b of this.buttons) {
      let groundRow = b.row + 1;
      while (groundRow < L.H && !this.solidAt(b.col, groundRow)) groundRow++;
      if (groundRow < L.H) b.baseY = groundRow * TILE;
    }

    this.respawn = { ...this.spawn };
    this.px = this.spawn.x;
    this.py = this.spawn.y;
    this.vx = 0; this.vy = 0;
    this.camX = this.clampCam(this.px + this.pw / 2 - this.viewW * 0.42);
  }

  /** Restart the level. Trap knowledge is kept unless `forgetTraps` is set. */
  rebuild(forgetTraps = false) {
    if (forgetTraps) {
      this.discovered.clear();
      this.armAnim.clear();
    }
    this.build();
    this.toastText = "";
  }

  // ———————————————————— QUERIES ————————————————————

  charAt(c: number, r: number): string {
    // invisible walls on the SIDES only — above is open sky, below is the void
    if (c < 0 || c >= this.level.W) return "#";
    if (r < 0 || r >= this.level.H) return " ";
    return this.grid[r][c];
  }

  solidAt(c: number, r: number): boolean {
    const ch = this.charAt(c, r);
    if (ch === "#" || ch === "=" || ch === "K" || ch === "B" || ch === "b") return true;
    if (ch === "D") {
      const d = this.dMap.get(`${c},${r}`);
      return !!d && !d.gone;
    }
    if (ch === "_") {
      const p = this.pMap.get(`${c},${r}`);
      return !!p && !p.gone;
    }
    if (ch === "H") return this.hRevealed.has(`${c},${r}`);
    return false;
  }

  hazardAt(c: number, r: number): boolean {
    const ch = this.charAt(c, r);
    return ch === "^" || ch === "v" || ch === "X";
  }

  /** True if a real guard is within `tiles` ahead horizontally (used by preview bots). */
  guardInFront(tiles: number): boolean {
    const dir = this.vx >= 0 ? 1 : -1;
    const y0 = this.py - 8, y1 = this.py + this.ph + 8;
    return this.guards.some((g) => {
      if (g.fake || !g.alive) return false;
      if (g.y + g.h < y0 || g.y > y1) return false;
      if (dir > 0) return g.x > this.px && g.x < this.px + this.pw + tiles * TILE;
      return g.x + g.w < this.px + this.pw && g.x + g.w > this.px - tiles * TILE;
    });
  }

  private rectsOverlap(ax: number, ay: number, aw: number, ah: number, bx: number, by: number, bw: number, bh: number) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ———————————————————— PUBLIC ACTIONS ————————————————————

  start() {
    if (this.started) return;
    this.started = true;
    this.lastTs = performance.now();
    const loop = (ts: number) => {
      this.raf = requestAnimationFrame(loop);
      const frame = Math.min(0.05, (ts - this.lastTs) / 1000);
      this.lastTs = ts;
      if (!this.paused) {
        this.acc += frame;
        let steps = 0;
        while (this.acc >= 1 / 60 && steps < 3) {
          this.step(1 / 60);
          this.acc -= 1 / 60;
          steps++;
        }
        if (steps === 3) this.acc = 0;
      }
      this.render();
    };
    this.raf = requestAnimationFrame(loop);
  }

  destroy() {
    cancelAnimationFrame(this.raf);
    this.started = false;
    this.unbindInput();
  }

  setPalette(p: Palette) { this.pal = p; }
  setSkin(id: string) { this.skin = id; }
  setTrail(id: string) { this.trail = id; }

  useReveal(): boolean {
    if (this.dead || this.won) return false;
    this.revealFlash(2000);
    if (!this.opts.silent) sfx.reveal();
    this.emitToast("EVERYTHING IS VISIBLE. YOU'RE WELCOME.");
    return true;
  }

  revealFlash(ms: number) {
    this.revealUntil = Math.max(this.revealUntil, this.clock + ms);
  }

  placeCheckpoint(): boolean {
    if (this.dead || this.won || !this.grounded) return false;
    this.placedFlag = { x: this.px + this.pw / 2, y: this.py + this.ph };
    this.respawn = { x: this.px, y: this.py };
    if (!this.opts.silent) sfx.checkpoint();
    this.burst(this.px + this.pw / 2, this.py + this.ph / 2, this.pal.accent, 10, 160);
    this.emitToast("ANCHOR DROPPED.");
    this.cb.onCheckpoint?.();
    return true;
  }

  // ———————————————————— SIMULATION ————————————————————

  private step(dt: number) {
    this.clock += dt * 1000;

    if (this.dead) {
      this.updateParticles(dt);
      if (this.clock >= this.deadUntil) this.respawnPlayer();
      return;
    }
    if (this.won) {
      this.updateParticles(dt);
      this.goalDrawX += (this.goal.x - this.goalDrawX) * Math.min(1, dt * 8);
      return;
    }

    this.runMs += dt * 1000;
    this.opts.controller?.(this, dt);

    // effective input: keyboard set + virtual touch set + bot override,
    // all merged so simultaneous presses are always honored
    const down = (codes: string[]) =>
      codes.some((c) => this.keys.has(c) || this.touchKeys.has(c));
    const holdL = down(LEFT_CODES) || this.input.left;
    const holdR = down(RIGHT_CODES) || this.input.right;
    let move = (holdR ? 1 : 0) - (holdL ? 1 : 0);
    if (this.reversed) move = -move;

    const accel = this.grounded ? RUN_ACCEL : AIR_ACCEL;
    if (move !== 0) {
      this.vx += move * accel * dt;
      this.vx = Math.max(-MAX_RUN, Math.min(MAX_RUN, this.vx));
    } else if (this.grounded) {
      const s = Math.sign(this.vx);
      this.vx -= s * FRICTION * dt;
      if (Math.sign(this.vx) !== s) this.vx = 0;
    } else {
      this.vx *= 1 - Math.min(1, 0.4 * dt);
    }

    // jumping — real-time buffered press + coyote window; no flag races
    this.coyoteT = this.grounded ? COYOTE : Math.max(0, this.coyoteT - dt);
    const jumpHeld = down(JUMP_CODES) || this.input.jumpHeld;
    const pressedBuffered = performance.now() - this.lastJumpPress < BUFFER * 1000;
    if (pressedBuffered && this.coyoteT > 0) {
      this.vy = -JUMP_VEL * this.gravSign;
      this.grounded = false;
      this.coyoteT = 0;
      this.lastJumpPress = -1e9;
      if (!this.opts.silent) sfx.jump();
    }
    if (!jumpHeld && Math.sign(this.vy) === -this.gravSign && Math.abs(this.vy) > 240) {
      this.vy *= 1 - Math.min(0.5, 5 * dt); // variable jump height
    }

    this.vy += GRAV * this.gravSign * dt;
    if (this.vy > MAX_FALL) this.vy = MAX_FALL;
    if (this.vy < -MAX_FALL) this.vy = -MAX_FALL;

    this.moveX(dt);
    this.moveY(dt);
    if (this.dead) return;
    this.updateDrones(dt);
    this.updateGuards(dt);

    this.landT = Math.max(0, this.landT - dt);
    this.goalDrawX += (this.goal.x - this.goalDrawX) * Math.min(1, dt * 8);

    this.checkHazardsAndPickups(dt);
    this.checkEvents();
    this.updateParticles(dt);
    this.updateTrail(dt);

    // falling off the world — below is death, too far above (inverted) is death
    if (this.py > this.levelH + 72 || this.py < -220) {
      this.die("void");
      return;
    }

    // camera
    const facing = this.vx >= 0 ? 1 : -1;
    const target = this.px + this.pw / 2 - this.viewW * 0.42 + facing * 60;
    const clamped = this.clampCam(target);
    this.camX += (clamped - this.camX) * Math.min(1, dt * 7);
    if (Math.abs(clamped - this.camX) > 500) this.camX = clamped;
    this.shake = Math.max(0, this.shake - dt * 26);
  }

  private clampCam(x: number) {
    return Math.max(0, Math.min(Math.max(0, this.levelW - this.viewW), x));
  }

  private moveX(dt: number) {
    this.px += this.vx * dt;
    const top = Math.floor(this.py / TILE);
    const bottom = Math.floor((this.py + this.ph - 1) / TILE);
    if (this.vx > 0) {
      const c = Math.floor((this.px + this.pw) / TILE);
      for (let r = top; r <= bottom; r++) {
        if (this.solidAt(c, r)) {
          this.px = c * TILE - this.pw - 0.01;
          this.vx = 0;
          break;
        }
      }
    } else if (this.vx < 0) {
      const c = Math.floor(this.px / TILE);
      for (let r = top; r <= bottom; r++) {
        if (this.solidAt(c, r)) {
          this.px = (c + 1) * TILE + 0.01;
          this.vx = 0;
          break;
        }
      }
    }
  }

  private moveY(dt: number) {
    this.py += this.vy * dt;
    const left = Math.floor((this.px + 2) / TILE);
    const right = Math.floor((this.px + this.pw - 2) / TILE);
    const wasGrounded = this.grounded;
    this.grounded = false;

    if (this.vy > 0) {
      const r = Math.floor((this.py + this.ph) / TILE);
      for (let c = left; c <= right; c++) {
        const spring = this.charAt(c, r) === "K";
        if (this.solidAt(c, r)) {
          this.py = r * TILE - this.ph - 0.01;
          if (this.gravSign === 1) {
            this.grounded = true;
            if (!wasGrounded) {
              this.landT = 0.09;
              if (!this.opts.silent && this.vy > 500) sfx.land();
            }
            if (spring) this.bounceSpring();
          }
          this.vy = spring && this.gravSign === -1 ? 0 : spring ? this.vy : 0;
          if (!spring) this.vy = 0;
          break;
        }
      }
    } else if (this.vy < 0) {
      const r = Math.floor(this.py / TILE);
      for (let c = left; c <= right; c++) {
        const key = `${c},${r}`;
        const ch = this.charAt(c, r);
        if (ch === "H" && !this.hRevealed.has(key) && this.gravSign === 1) {
          // headbutt reveals hidden blocks
          this.hRevealed.add(key);
          this.py = (r + 1) * TILE + 0.01;
          this.vy = 0;
          if (!this.opts.silent) sfx.bump();
          this.bumpTile(c, r);
          break;
        }
        if (ch === "B") {
          // real crate: headbutt it open for a coin.
          this.grid[r][c] = " ";
          this.coins += 1;
          this.cb.onCoin?.(this.coins);
          this.emitToast("A COIN. IN THIS ECONOMY.");
          if (!this.opts.silent) { sfx.coin(); sfx.bump(); }
          this.burst(c * TILE + TILE / 2, r * TILE + TILE / 2, this.pal.accent, 12, 220);
          this.py = (r + 1) * TILE + 0.01;
          this.vy = 0;
          break;
        }
        const spring = ch === "K";
        if (this.solidAt(c, r)) {
          this.py = (r + 1) * TILE + 0.01;
          if (this.gravSign === -1) {
            this.grounded = true;
            if (!wasGrounded) this.landT = 0.09;
            if (spring) this.bounceSpring();
          }
          this.vy = spring && this.gravSign === 1 ? 0 : spring ? this.vy : 0;
          if (!spring) this.vy = 0;
          break;
        }
      }
    }

    // standing support check (for D tiles + falling off edges)
    if (this.vy === 0) {
      const r = Math.floor((this.py + (this.gravSign === 1 ? this.ph + 1 : -1)) / TILE);
      let supported = false;
      for (let c = left; c <= right; c++) {
        if (this.solidAt(c, r)) {
          supported = true;
          const ch = this.charAt(c, r);
          if (ch === "D") {
            const d = this.dMap.get(`${c},${r}`);
            if (d && !d.gone) {
              d.timer += 1.2 / 60;
              if (d.timer > 0.5) {
                d.gone = true;
                d.fy = r * TILE;
                if (!this.opts.silent) sfx.bump();
                supported = false;
              }
            }
          }
          if (ch === "_") {
            const p = this.pMap.get(`${c},${r}`);
            if (p && !p.gone) {
              p.timer += 1.2 / 60;
              if (p.timer > 0.32) {
                p.gone = true;
                p.fy = r * TILE;
                if (!this.opts.silent) sfx.bump();
                this.burst(c * TILE + TILE / 2, r * TILE + TILE / 2, this.pal.subtle, 8, 160);
                supported = false;
              }
            }
          }
          if (ch === "b") {
            // looks like a crate, contains a bomb. classic.
            this.grid[r][c] = " ";
            this.explodeAt(c * TILE + TILE / 2, r * TILE + TILE / 2);
            this.die("bomb");
            return;
          }
          if (ch === "B") {
            // real crate: crack it open from above for a coin.
            this.grid[r][c] = " ";
            this.coins += 1;
            this.cb.onCoin?.(this.coins);
            this.emitToast("A COIN. IN THIS ECONOMY.");
            if (!this.opts.silent) { sfx.coin(); sfx.bump(); }
            this.burst(c * TILE + TILE / 2, r * TILE + TILE / 2, this.pal.accent, 12, 220);
            supported = false;
          }
          if (ch === "K" && this.gravSign === 1 && Math.abs(this.py + this.ph - r * TILE) < 2) {
            this.bounceSpring();
          }
        }
      }
      if (this.gravSign === 1) this.grounded = supported;
    }
  }

  private bounceSpring() {
    this.vy = -SPRING_VEL * this.gravSign;
    this.grounded = false;
    this.landT = 0;
    if (!this.opts.silent) sfx.spring();
    this.burst(this.px + this.pw / 2, this.py + this.ph / 2, this.pal.accent, 8, 200);
  }

  private explodeAt(x: number, y: number) {
    this.shake = Math.max(this.shake, 15);
    this.burst(x, y, this.pal.text, 24, 430);
    this.burst(x, y, this.pal.accent, 18, 360);
    this.burst(x, y, this.pal.subtle, 12, 300);
    if (!this.opts.silent) { sfx.spike(); sfx.bump(); }
  }

  private bumpTile(c: number, r: number) {
    for (let i = 0; i < 6; i++) {
      this.particles.push({
        x: c * TILE + TILE / 2, y: (r + 1) * TILE,
        vx: (Math.random() - 0.5) * 200, vy: 60 + Math.random() * 120,
        life: 0, maxLife: 0.4, size: 3 + Math.random() * 3,
        color: this.pal.subtle, grav: 500,
      });
    }
  }

  /** A trap springs out of hiding — permanently revealed from now on. */
  private armTrap(c: number, r: number) {
    const key = `${c},${r}`;
    if (this.discovered.has(key)) return;
    this.discovered.add(key);
    this.armAnim.set(key, this.clock);
    if (!this.opts.silent) sfx.spike();
    this.particles.push(
      ...Array.from({ length: 4 }, () => ({
        x: c * TILE + TILE / 2 + (Math.random() - 0.5) * TILE,
        y: r * TILE + TILE / 2,
        vx: (Math.random() - 0.5) * 120,
        vy: -60 - Math.random() * 90,
        life: 0,
        maxLife: 0.35,
        size: 2 + Math.random() * 3,
        color: this.pal.subtle,
        grav: 700,
      })),
    );
  }

  /** Spikes pop out as the player closes in — the moment of betrayal. */
  private armNearbyTraps() {
    const L = this.level;
    const cc = Math.floor((this.px + this.pw / 2) / TILE);
    const cr = Math.floor((this.py + this.ph / 2) / TILE);
    for (let r = Math.max(0, cr - 2); r <= Math.min(L.H - 1, cr + 2); r++) {
      for (let c = Math.max(0, cc - 2); c <= Math.min(L.W - 1, cc + 2); c++) {
        const ch = this.grid[r][c];
        if (ch !== "^" && ch !== "v") continue;
        if (this.discovered.has(`${c},${r}`)) continue;
        const dx = Math.abs(this.px + this.pw / 2 - (c * TILE + TILE / 2));
        const dy = Math.abs(this.py + this.ph / 2 - (r * TILE + TILE / 2));
        if (dx < TILE * 1.45 && dy < TILE * 1.3) this.armTrap(c, r);
      }
    }
  }

  private spawnDrone(b: TrapButton) {
    const w = 18, h = 14;
    this.drones.push({
      x: b.col * TILE + (TILE - w) / 2,
      y: b.row * TILE - h - 8,
      w, h,
      phase: Math.random() * Math.PI * 2,
      armedAt: this.clock + 650,
      alive: true,
    });
  }

  private updateDrones(dt: number) {
    const tx = this.px + this.pw / 2;
    const ty = this.py + this.ph / 2;
    for (const d of this.drones) {
      if (!d.alive) continue;
      if (this.clock < d.armedAt) {
        d.y += Math.sin((this.clock + d.phase) / 90) * 10 * dt;
        continue;
      }
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      const dx = tx - cx;
      const dy = ty - cy;
      const len = Math.hypot(dx, dy) || 1;
      const speed = 132;
      d.x += (dx / len) * speed * dt;
      d.y += (dy / len) * speed * dt + Math.sin((this.clock + d.phase) / 110) * 12 * dt;
    }
    this.drones = this.drones.filter((d) => d.alive);
  }

  /**
   * Guards use their whole leading edge, not a single point, so a raised
   * spike, hanging spike, wall, ledge, or landed rain spike always blocks them.
   */
  private guardBlocked(x: number, y: number, w: number, h: number, dir: 1 | -1): boolean {
    const aheadCol = dir > 0
      ? Math.floor((x + w + 2) / TILE)
      : Math.floor((x - 2) / TILE);
    const topRow = Math.floor((y + 1) / TILE);
    const feetRow = Math.floor((y + h - 1) / TILE);

    for (let r = topRow; r <= feetRow; r++) {
      if (this.solidAt(aheadCol, r) || this.hazardAt(aheadCol, r)) return true;
    }
    if (!this.solidAt(aheadCol, feetRow + 1)) return true;

    // Rain spikes are runtime objects, not grid tiles. Check the guard's
    // proposed body against every one that has landed (or is falling through
    // its space) so guards can't walk straight into them.
    for (const s of this.rainSpikes) {
      if (this.rectsOverlap(x, y, w, h, s.col * TILE + 6, s.y + 14, TILE - 12, TILE - 14)) {
        return true;
      }
    }
    return false;
  }

  private updateGuards(dt: number) {
    for (const g of this.guards) {
      if (!g.alive) continue;
      const speed = 54;
      let nx = g.x + g.dir * speed * dt;
      if (this.guardBlocked(nx, g.y, g.w, g.h, g.dir)) {
        g.dir = g.dir === 1 ? -1 : 1;
        nx = g.x;
      }
      g.x = nx;
    }
  }

  private checkHazardsAndPickups(dt: number) {
    const L = this.level;
    const pc = { x: this.px, y: this.py, w: this.pw, h: this.ph };

    this.armNearbyTraps();

    // static spike + fake goal tiles
    const c0 = Math.floor(this.px / TILE) - 1;
    const c1 = Math.floor((this.px + this.pw) / TILE) + 1;
    const r0 = Math.floor(this.py / TILE) - 1;
    const r1 = Math.floor((this.py + this.ph) / TILE) + 1;
    for (let r = Math.max(0, r0); r <= Math.min(L.H - 1, r1); r++) {
      for (let c = Math.max(0, c0); c <= Math.min(L.W - 1, c1); c++) {
        const ch = this.grid[r][c];
        if (ch === "^") {
          if (this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, c * TILE + 6, r * TILE + 18, TILE - 12, TILE - 18)) {
            this.armTrap(c, r);
            this.die("spike");
            return;
          }
        } else if (ch === "v") {
          if (this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, c * TILE + 6, r * TILE, TILE - 12, TILE - 18)) {
            this.armTrap(c, r);
            this.die("spike");
            return;
          }
        } else if (ch === "X") {
          if (this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, c * TILE + 4, r * TILE + 4, TILE - 8, TILE - 4)) {
            this.xRevealed.add(`${c},${r}`);
            this.die("fakeflag");
            return;
          }
        }
      }
    }

    // rain spikes
    for (const s of this.rainSpikes) {
      if (!s.landed) {
        s.vy += GRAV * dt * 0.9;
        s.y += s.vy * dt;
        const target = s.landRow * TILE;
        if (s.y >= target) {
          s.y = target;
          s.landed = true;
          if (!this.opts.silent) sfx.spike();
          this.burst(s.col * TILE + TILE / 2, s.y + TILE, this.pal.tile, 5, 130);
        }
      }
      const sy = s.landed ? s.y : s.y;
      if (this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, s.col * TILE + 6, sy + 14, TILE - 12, TILE - 14)) {
        this.die("spike");
        return;
      }
    }

    // coins
    for (const coin of this.coinMap.values()) {
      if (coin.taken) continue;
      const cx = coin.col * TILE + TILE / 2;
      const cy = coin.row * TILE + TILE / 2;
      if (this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, cx - 9, cy - 9, 18, 18)) {
        coin.taken = true;
        if (coin.fake) {
          this.coins = Math.max(0, this.coins - 1);
          this.emitToast("COUNTERFEIT. MINUS ONE COIN.");
          if (!this.opts.silent) sfx.denied();
          this.burst(cx, cy, this.pal.tile, 8, 160);
        } else {
          this.coins++;
          if (!this.opts.silent) sfx.coin();
          this.burst(cx, cy, this.pal.accent, 7, 170);
        }
        this.cb.onCoin?.(this.coins);
      }
    }

    // checkpoints
    for (const cp of this.checkpoints) {
      const cx = cp.col * TILE;
      const cy = cp.row * TILE;
      if (!this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, cx - 4, cy - TILE, TILE + 8, TILE * 2)) continue;
      if (cp.fake) {
        if (!cp.discovered) {
          cp.discovered = true;
          this.emitToast(FAKE_CHECKPOINT_MESSAGE);
          if (!this.opts.silent) sfx.denied();
        }
      } else if (!cp.active) {
        for (const o of this.checkpoints) o.active = false;
        cp.active = true;
        this.respawn = { x: cp.col * TILE + (TILE - this.pw) / 2, y: (cp.row + 1) * TILE - this.ph };
        if (!this.opts.silent) sfx.checkpoint();
        this.burst(cx + TILE / 2, cy + TILE / 2, this.pal.accent, 12, 180);
        this.emitToast("CHECKPOINT.");
        this.cb.onCheckpoint?.();
      }
    }

    // buttons — the fake ones deploy drones now. Use the full tile above the
    // snapped ground so walking through, running into, or jumping onto a
    // button all count as contact.
    for (const b of this.buttons) {
      const bx = b.col * TILE;
      if (!this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, bx + 2, b.baseY - TILE, TILE - 4, TILE)) continue;
      if (b.fake) {
        if (!b.pressed) {
          b.pressed = true;
          b.discovered = true;
          this.spawnDrone(b);
          this.emitToast("TRAP BUTTON. DRONE DEPLOYED.");
          if (!this.opts.silent) sfx.denied();
          this.burst(bx + TILE / 2, b.baseY - 10, this.pal.subtle, 12, 180);
        }
      } else if (!b.pressed) {
        b.pressed = true;
        this.emitToast("NOTHING HAPPENS.");
        if (!this.opts.silent) sfx.click();
      }
    }

    // guards — the real ones are rude; the fake ones are mimes
    for (const g of this.guards) {
      if (!this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, g.x, g.y, g.w, g.h)) continue;
      if (g.fake) {
        if (!g.discovered) {
          g.discovered = true;
          this.emitToast("JUST A MIME.");
          if (!this.opts.silent) sfx.denied();
          this.burst(g.x + g.w / 2, g.y + g.h / 2, this.pal.subtle, 8, 150);
        }
        continue;
      }
      if (!g.alive) continue;
      const falling = this.vy * this.gravSign > 120;
      const fromAbove = this.py + this.ph - g.y < 18;
      if (falling && fromAbove) {
        g.alive = false;
        this.vy = -430 * this.gravSign;
        this.grounded = false;
        this.emitToast("STOMPED. IT WAS REAL.");
        if (!this.opts.silent) sfx.bump();
        this.burst(g.x + g.w / 2, g.y + g.h / 2, this.pal.text, 12, 210);
      } else {
        this.die("enemy");
        return;
      }
    }

    // drones — they explode on contact
    for (const d of this.drones) {
      if (!d.alive) continue;
      if (!this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, d.x, d.y, d.w, d.h)) continue;
      d.alive = false;
      this.explodeAt(d.x + d.w / 2, d.y + d.h / 2);
      this.die("drone");
      return;
    }

    // goal
    const gx = this.goal.x;
    const gy = this.goal.y;
    if (!this.won && this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, gx - 6, gy - TILE, TILE + 12, TILE * 2 + 6)) {
      this.win();
    }
  }

  private checkEvents() {
    const pc = { x: this.px, y: this.py, w: this.pw, h: this.ph };
    this.level.events.forEach((ev, i) => {
      const rt = this.evRuntime[i];
      const ex = ev.x * TILE, ey = ev.y * TILE, ew = ev.w * TILE, eh = ev.h * TILE;
      if (!this.rectsOverlap(pc.x, pc.y, pc.w, pc.h, ex, ey, ew, eh)) return;

      switch (ev.type) {
        case "flip": {
          if (this.gravSign !== ev.sign!) {
            this.gravSign = ev.sign!;
            this.vy = 60 * this.gravSign;
            this.grounded = false;
            if (ev.text) this.emitToast(ev.text);
            if (!this.opts.silent) sfx.flip();
            this.burst(pc.x + pc.w / 2, pc.y + pc.h / 2, this.pal.text, 14, 240);
            this.shake = Math.max(this.shake, 5);
          }
          break;
        }
        case "reverse": {
          if (this.clock >= rt.nextAt) {
            rt.nextAt = this.clock + (ev.cooldownMs ?? 6000);
            this.reverseUntil = this.clock + (ev.sec ?? 3) * 1000;
            if (ev.text) this.emitToast(ev.text);
            if (!this.opts.silent) sfx.reverse();
          }
          break;
        }
        case "goalshift": {
          if (rt.fired && ev.once !== false) break;
          rt.fired = true;
          this.goal.col += ev.dx ?? 0;
          this.goal.x = this.goal.col * TILE;
          if (ev.text) this.emitToast(ev.text);
          if (!this.opts.silent) sfx.shift();
          this.burst(this.goal.x + TILE / 2, this.goal.y + TILE / 2, this.pal.text, 12, 240);
          break;
        }
        case "spikefall": {
          if (rt.fired && ev.once !== false) break;
          rt.fired = true;
          for (const col of ev.at ?? []) {
            this.rainSpikes.push({ col, y: -TILE * 1.5, vy: 120, landed: false, landRow: ev.landY ?? 11 });
          }
          if (ev.text) this.emitToast(ev.text);
          this.shake = Math.max(this.shake, 4);
          break;
        }
        case "msg":
        default: {
          if (rt.fired && ev.once !== false) break;
          if (this.clock < rt.nextAt) break;
          rt.fired = true;
          rt.nextAt = this.clock + 4000;
          if (ev.text) this.emitToast(ev.text);
          break;
        }
      }
    });
  }

  private win() {
    if (this.won) return;
    this.won = true;
    const stats = { timeMs: Math.round(this.runMs), deaths: this.deaths, coins: this.coins };
    if (!this.opts.silent) sfx.win();
    const gx = this.goal.x + TILE / 2, gy = this.goal.y;
    for (let i = 0; i < 5; i++) {
      const col = i % 2 ? this.pal.text : this.pal.accent;
      this.burst(gx + (Math.random() - 0.5) * 40, gy + Math.random() * 40, col, 10, 320);
    }
    this.cb.onWin?.(stats);
  }

  private die(reason: "spike" | "void" | "fakeflag" | "enemy" | "bomb" | "drone") {
    if (this.dead || this.won) return;
    this.dead = true;
    this.deaths++;
    const pack = TAUNTS[this.tauntKey] ?? TAUNTS.classic;
    const message = reason === "fakeflag"
      ? FAKE_FLAG_MESSAGE
      : reason === "bomb"
        ? "IT WAS A BOMB."
        : reason === "drone"
          ? "DRONE DELIVERY."
          : reason === "enemy"
            ? "THAT ONE WAS REAL."
            : pack[Math.floor(Math.random() * pack.length)];
    this.deadUntil = this.clock + 620;
    this.flashUntil = this.clock + 110;
    this.shake = 12;
    if (!this.opts.silent) sfx.die();
    this.burst(this.px + this.pw / 2, this.py + this.ph / 2, this.pal.player, 26, 380);
    this.burst(this.px + this.pw / 2, this.py + this.ph / 2, this.pal.accent, 10, 260);
    this.emitToast(message);
    this.cb.onDeath?.({ count: this.deaths, message });
  }

  private respawnPlayer() {
    this.px = this.respawn.x;
    this.py = this.respawn.y;
    this.vx = 0; this.vy = 0;
    this.gravSign = 1;
    this.reverseUntil = 0;
    this.dead = false;
    this.trailBuf = [];
    this.drones = [];
    for (const d of this.dMap.values()) { d.timer = 0; d.gone = false; }
    for (const p of this.pMap.values()) { p.timer = 0; p.gone = false; }
    for (const g of this.guards) {
      g.alive = true;
      g.x = g.spawnX;
      g.dir = g.spawnDir;
    }
    this.flashUntil = this.clock + 70;
    this.camX = this.clampCam(this.px + this.pw / 2 - this.viewW * 0.42);
  }

  private emitToast(text: string) {
    this.toastText = text;
    this.toastUntil = this.clock + 2100;
    this.cb.onToast?.(text);
  }

  private burst(x: number, y: number, color: string, count: number, speed: number) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = speed * (0.4 + Math.random() * 0.8);
      this.particles.push({
        x, y,
        vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60,
        life: 0, maxLife: 0.5 + Math.random() * 0.45,
        size: 2 + Math.random() * 5, color, grav: 900,
      });
    }
  }

  private updateParticles(dt: number) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life += dt;
      if (p.life >= p.maxLife) { this.particles.splice(i, 1); continue; }
      p.vy += p.grav * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }

  private updateTrail(dt: number) {
    if (this.trail === "trail:none") return;
    this.trailClock += dt;
    if (this.trailClock > 0.028) {
      this.trailClock = 0;
      this.trailBuf.push({ x: this.px, y: this.py });
      if (this.trailBuf.length > 26) this.trailBuf.shift();
    }
    if (this.trail === "trail:pixels" && Math.abs(this.vx) > 80 && Math.random() < 0.5) {
      this.particles.push({
        x: this.px + this.pw / 2, y: this.py + this.ph - 2,
        vx: -this.vx * 0.25 + (Math.random() - 0.5) * 60,
        vy: -30 - Math.random() * 60,
        life: 0, maxLife: 0.5, size: 2 + Math.random() * 3,
        color: this.pal.accent, grav: 300,
      });
    }
  }

  hud() {
    return {
      deaths: this.deaths,
      coins: this.coins,
      timeMs: Math.round(this.runMs),
      reversed: this.reversed,
      paused: this.paused,
      won: this.won,
    };
  }

  // ———————————————————— RENDER ————————————————————

  private boundCanvas: HTMLCanvasElement | null = null;
  attach(canvas: HTMLCanvasElement) { this.boundCanvas = canvas; }

  render() {
    const canvas = this.boundCanvas;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const sx = canvas.width / this.viewW;
    const sy = canvas.height / this.viewH;
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    this.draw(ctx);
  }

  private draw(ctx: CanvasRenderingContext2D) {
    const pal = this.pal;
    const viewW = this.viewW, viewH = this.viewH;

    // background
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, viewW, viewH);

    // parallax squares
    const shakeOn = this.shake > 0 && this.opts.shakeEnabled !== false;
    const shakeX = shakeOn ? (Math.random() - 0.5) * this.shake : 0;
    const shakeY = shakeOn ? (Math.random() - 0.5) * this.shake : 0;
    ctx.fillStyle = pal.far;
    for (const sq of this.farSquares) {
      const wrapW = this.levelW * 0.3 + viewW;
      let x = (sq.x - this.camX * 0.3) % wrapW;
      if (x < -60) x += wrapW;
      let y = sq.y;
      ctx.globalAlpha = sq.a;
      ctx.fillRect(x - 60, y, sq.s, sq.s);
    }
    ctx.globalAlpha = 1;

    // vertical camera: bottom-aligned when the level fits, follows otherwise
    let camY = this.levelH - viewH;
    if (camY > 0) {
      camY = Math.max(0, Math.min(camY, this.py + this.ph / 2 - viewH * 0.58));
    }
    ctx.save();
    ctx.translate(Math.round(-this.camX + shakeX), Math.round(-camY + shakeY));

    const c0 = Math.max(0, Math.floor(this.camX / TILE) - 1);
    const c1 = Math.min(this.level.W - 1, Math.ceil((this.camX + viewW) / TILE) + 1);
    const now = this.clock;
    const revealOn = now < this.revealUntil;

    for (let r = 0; r < this.level.H; r++) {
      for (let c = c0; c <= c1; c++) {
        const ch = this.grid[r][c];
        const x = c * TILE, y = r * TILE;
        if (ch === "#") {
          ctx.fillStyle = pal.tile;
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
          this.speck(ctx, c, r, x, y);
        } else if (ch === "=" || ch === "_") {
          const p = ch === "_" ? this.pMap.get(`${c},${r}`) : undefined;
          if (!p || !p.gone) {
            const wob = p && p.timer > 0 ? Math.sin(now / 22) * 1.8 : 0;
            ctx.fillStyle = pal.tile;
            ctx.fillRect(x, y + wob, TILE + 0.5, TILE + 0.5);
            ctx.fillStyle = pal.bg;
            ctx.globalAlpha = 0.35;
            ctx.fillRect(x + 2, y + wob + TILE / 2 - 2, TILE - 4, 4);
            ctx.globalAlpha = 1;
            if (revealOn && p) {
              ctx.globalAlpha = 0.45 + 0.25 * Math.sin(now / 70);
              ctx.fillStyle = pal.bg;
              ctx.fillRect(x + TILE / 2 - 3, y + wob + TILE / 2 - 3, 6, 6);
              ctx.globalAlpha = 1;
            }
          }
        } else if (ch === "B" || ch === "b") {
          this.drawCrate(ctx, x, y, revealOn && ch === "b", now);
        } else if (ch === "K") {
          ctx.fillStyle = pal.tile;
          ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
          ctx.fillStyle = pal.bg;
          ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
        } else if (ch === "D") {
          const d = this.dMap.get(`${c},${r}`)!;
          if (!d.gone) {
            const wob = d.timer > 0 ? Math.sin(now / 24) * 1.6 : 0;
            ctx.fillStyle = pal.tile;
            ctx.fillRect(x, y + wob, TILE + 0.5, TILE + 0.5);
            this.speck(ctx, c, r, x, y + wob);
            if (d.timer > 0.12) {
              ctx.fillStyle = pal.bg;
              ctx.fillRect(x + 4, y + wob + TILE / 2 - 1, TILE - 8, 2);
            }
          }
        } else if (ch === "H") {
          if (this.hRevealed.has(`${c},${r}`)) {
            ctx.fillStyle = pal.tile;
            ctx.fillRect(x, y, TILE + 0.5, TILE + 0.5);
            ctx.fillStyle = pal.bg;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(x + TILE / 2 - 2, y + TILE / 2 - 2, 4, 4);
            ctx.globalAlpha = 1;
          } else if (revealOn) {
            const pulse = 0.25 + 0.15 * Math.sin(now / 60);
            ctx.globalAlpha = pulse;
            ctx.fillStyle = pal.tile;
            ctx.fillRect(x, y, TILE, TILE);
            ctx.globalAlpha = 1;
          }
        } else if (ch === "^" || ch === "v") {
          const key = `${c},${r}`;
          if (this.discovered.has(key)) {
            const t = this.armAnim.get(key);
            // springy emergence from the surface
            const k = t === undefined ? 1 : Math.min(1, (now - t) / 150);
            const grow = k >= 1 ? 1 : 1.25 * Math.sin((k * Math.PI) / 2) - 0.25 * k;
            this.drawSpikes(ctx, x, y, ch === "v", grow);
          } else if (revealOn) {
            ctx.globalAlpha = 0.3 + 0.18 * Math.sin(now / 60);
            this.drawSpikes(ctx, x, y, ch === "v", 1);
            ctx.globalAlpha = 1;
          }
        } else if (ch === "X") {
          this.drawFlag(ctx, x + TILE / 2, y + TILE, this.xRevealed.has(`${c},${r}`), revealOn);
        } else if (ch === ">" || ch === "<") {
          ctx.fillStyle = pal.subtle;
          ctx.globalAlpha = 0.75;
          const dir = ch === ">" ? 1 : -1;
          const cx = x + TILE / 2, cy = y + TILE / 2;
          ctx.beginPath();
          ctx.moveTo(cx - 6 * dir, cy - 7);
          ctx.lineTo(cx + 7 * dir, cy);
          ctx.lineTo(cx - 6 * dir, cy + 7);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = 1;
        }
      }
    }

    // coins
    for (const coin of this.coinMap.values()) {
      if (coin.taken) continue;
      if (coin.col < c0 - 1 || coin.col > c1 + 1) continue;
      const cx = coin.col * TILE + TILE / 2;
      const cy = coin.row * TILE + TILE / 2 + Math.sin(now / 300 + coin.col) * 1.6;
      const rr = 7 * (1 + 0.07 * Math.sin(now / 180 + coin.col * 2));
      ctx.fillStyle = pal.accent;
      ctx.beginPath();
      ctx.arc(cx, cy, rr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = pal.bg;
      ctx.fillRect(cx - 2.5, cy - 2.5, 5, 5);
      if (coin.fake && revealOn) {
        ctx.globalAlpha = 0.55 + 0.35 * Math.sin(now / 70 + coin.col);
        ctx.strokeStyle = pal.text;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx, cy, rr + 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }

    // checkpoints
    for (const cp of this.checkpoints) {
      const cx = cp.col * TILE + TILE / 2;
      const baseY = (cp.row + 1) * TILE;
      const droop = cp.fake && (cp.discovered || revealOn);
      ctx.fillStyle = cp.active || (cp.fake && cp.discovered) ? pal.accent : pal.text;
      ctx.globalAlpha = cp.fake && cp.discovered ? 0.45 : 1;
      ctx.fillRect(cx - 1.5, baseY - 34, 3, 34);
      ctx.beginPath();
      if (droop) {
        ctx.moveTo(cx + 1.5, baseY - 32);
        ctx.lineTo(cx + 17, baseY - 20);
        ctx.lineTo(cx + 1.5, baseY - 16);
      } else {
        ctx.moveTo(cx + 1.5, baseY - 34);
        ctx.lineTo(cx + 17, baseY - 28);
        ctx.lineTo(cx + 1.5, baseY - 22);
      }
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // buttons — bases sit flush on the snapped ground surface
    for (const b of this.buttons) {
      const bx = b.col * TILE, baseY = b.baseY;
      ctx.fillStyle = pal.tile;
      ctx.fillRect(bx + 6, baseY - 12, TILE - 12, 12);
      const depress = (b.pressed ? 4 : 0) + (b.fake && b.discovered ? 3 : 0);
      ctx.fillStyle = b.fake && b.discovered ? pal.subtle : pal.accent;
      ctx.fillRect(bx + 8 + (b.fake && b.discovered ? 2 : 0), baseY - 18 + depress, TILE - 16, 7);
      if (revealOn && b.fake && !b.discovered) {
        ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 70);
        ctx.strokeStyle = pal.text;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(bx + 5, baseY - 21, TILE - 10, 18);
        ctx.globalAlpha = 1;
      }
    }

    // guards — identical until the fake one is exposed
    for (const g of this.guards) {
      if (!g.alive) continue;
      ctx.fillStyle = pal.tile;
      ctx.fillRect(g.x, g.y + 3, g.w, g.h - 7);
      ctx.fillRect(g.x + 2, g.y + g.h - 6, 6, 6);
      ctx.fillRect(g.x + g.w - 8, g.y + g.h - 6, 6, 6);
      // eyes look the way it walks
      ctx.fillStyle = pal.bg;
      const look = g.dir * 3;
      ctx.fillRect(g.x + 5 + look, g.y + 9, 5, 5);
      ctx.fillRect(g.x + g.w - 10 + look, g.y + 9, 5, 5);
      if (g.fake && (g.discovered || revealOn)) {
        ctx.globalAlpha = 0.45 + 0.25 * Math.sin(now / 70 + g.col);
        ctx.strokeStyle = pal.text;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(g.x + 1, g.y + 2, g.w - 2, g.h - 3);
        ctx.globalAlpha = 1;
      }
    }

    // drones
    for (const d of this.drones) {
      if (!d.alive) continue;
      const cx = d.x + d.w / 2;
      const cy = d.y + d.h / 2;
      const blade = Math.sin(now / 40 + d.phase) * 3;
      ctx.fillStyle = pal.tile;
      ctx.fillRect(d.x + 2, d.y + 4, d.w - 4, d.h - 6);
      ctx.fillRect(d.x - 2, d.y + 2 + blade, d.w + 4, 3);
      ctx.fillRect(d.x + d.w / 2 - 1, d.y + d.h - 4, 2, 4);
      ctx.fillStyle = pal.bg;
      ctx.fillRect(cx - 2, cy - 1, 4, 4);
      ctx.strokeStyle = pal.subtle;
      ctx.lineWidth = 1;
      ctx.strokeRect(d.x - 3, d.y + 1, d.w + 6, d.h - 2);
    }

    // placed anchor flag
    if (this.placedFlag) {
      const fx = this.placedFlag.x, fy = this.placedFlag.y;
      ctx.fillStyle = pal.text;
      ctx.fillRect(fx - 1.5, fy - 30, 3, 30);
      ctx.beginPath();
      ctx.moveTo(fx + 1.5, fy - 30);
      ctx.lineTo(fx + 14, fy - 25);
      ctx.lineTo(fx + 1.5, fy - 20);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = pal.bg;
      ctx.fillRect(fx + 5, fy - 28, 3, 3);
    }

    // goal flag
    const gDrawX = this.won ? this.goal.x : this.goalDrawX;
    this.drawGoal(ctx, gDrawX + TILE / 2, this.goal.y + TILE / 2 + TILE / 2, now);

    // rain spikes
    for (const s of this.rainSpikes) {
      this.drawSpikes(ctx, s.col * TILE, s.landed ? s.landRow * TILE : s.y, false);
    }

    // trail
    this.drawTrail(ctx);

    // player
    if (!this.dead) this.drawPlayer(ctx, now);

    // particles
    for (const p of this.particles) {
      const t = p.life / p.maxLife;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = p.color;
      const s = p.size * (1 - 0.5 * t);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    // death flash
    if (now < this.flashUntil) {
      ctx.fillStyle = pal.text;
      ctx.globalAlpha = 0.28 * ((this.flashUntil - now) / 110);
      ctx.fillRect(0, 0, viewW, viewH);
      ctx.globalAlpha = 1;
    }

    // canvas toast (preview mode)
    if (this.opts.drawToastsOnCanvas && now < this.toastUntil && this.toastText) {
      const a = Math.min(1, (this.toastUntil - now) / 250);
      ctx.globalAlpha = a;
      ctx.font = "700 15px 'JetBrains Mono', monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      const w = ctx.measureText(this.toastText).width + 26;
      const cx = viewW / 2, cy = Math.max(40, viewH * 0.2);
      ctx.fillStyle = pal.text;
      ctx.fillRect(cx - w / 2, cy - 16, w, 32);
      ctx.fillStyle = pal.bg;
      ctx.fillText(this.toastText, cx, cy + 1);
      ctx.globalAlpha = 1;
    }
  }

  private speck(ctx: CanvasRenderingContext2D, c: number, r: number, x: number, y: number) {
    // flat deterministic texture — a few darker/lighter inlays on some tiles
    const h = (c * 73856093) ^ (r * 19349663);
    if (h % 7 === 0) {
      ctx.fillStyle = this.pal.bg;
      ctx.globalAlpha = 0.14;
      ctx.fillRect(x + ((h >> 3) % 20) + 4, y + ((h >> 9) % 20) + 4, 4, 4);
      ctx.globalAlpha = 1;
    }
  }

  private drawCrate(ctx: CanvasRenderingContext2D, x: number, y: number, revealTrap: boolean, now: number) {
    ctx.fillStyle = this.pal.tile;
    ctx.fillRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.fillStyle = this.pal.bg;
    ctx.globalAlpha = 0.4;
    ctx.fillRect(x + 5, y + TILE / 2 - 3, TILE - 10, 3);
    ctx.fillRect(x + TILE / 2 - 3, y + 5, 3, TILE - 10);
    ctx.globalAlpha = 0.7;
    ctx.fillRect(x + 5, y + 5, 4, 4);
    ctx.fillRect(x + TILE - 9, y + 5, 4, 4);
    ctx.fillRect(x + 5, y + TILE - 9, 4, 4);
    ctx.fillRect(x + TILE - 9, y + TILE - 9, 4, 4);
    ctx.globalAlpha = 1;
    if (revealTrap) {
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 70 + x);
      ctx.strokeStyle = this.pal.text;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4);
      // a tiny bomb tucked inside
      ctx.fillStyle = this.pal.bg;
      ctx.beginPath();
      ctx.arc(x + TILE / 2, y + TILE / 2, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x + TILE / 2 + 2, y + TILE / 2 - 7, 2, 5);
      ctx.globalAlpha = 1;
    }
  }

  private drawSpikes(ctx: CanvasRenderingContext2D, x: number, y: number, down: boolean, grow = 1) {
    const g = Math.max(0, grow);
    if (g <= 0.001) return;
    ctx.fillStyle = this.pal.text;
    const n = 2;
    const sw = TILE / n;
    const full = TILE - 4;
    const hgt = full * g;
    for (let i = 0; i < n; i++) {
      ctx.beginPath();
      if (down) {
        // hangs from the ceiling, grows downward
        ctx.moveTo(x + i * sw, y);
        ctx.lineTo(x + i * sw + sw / 2, y + hgt);
        ctx.lineTo(x + (i + 1) * sw, y);
      } else {
        // rises out of the floor
        ctx.moveTo(x + i * sw, y + TILE);
        ctx.lineTo(x + i * sw + sw / 2, y + TILE - hgt);
        ctx.lineTo(x + (i + 1) * sw, y + TILE);
      }
      ctx.closePath();
      ctx.fill();
    }
  }

  private drawFlag(ctx: CanvasRenderingContext2D, cx: number, baseY: number, revealed: boolean, flash: boolean) {
    ctx.save();
    if (flash || revealed) ctx.globalAlpha = revealed ? 0.5 : 0.5 + 0.3 * Math.sin(this.clock / 50);
    ctx.fillStyle = this.pal.text;
    ctx.fillRect(cx - 2, baseY - 46, 4, 46);
    ctx.beginPath();
    if (revealed) {
      ctx.moveTo(cx + 2, baseY - 44);
      ctx.lineTo(cx + 24, baseY - 26);
      ctx.lineTo(cx + 2, baseY - 18);
    } else {
      ctx.moveTo(cx + 2, baseY - 46);
      ctx.lineTo(cx + 26, baseY - 38);
      ctx.lineTo(cx + 2, baseY - 30);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  private drawGoal(ctx: CanvasRenderingContext2D, cx: number, baseY: number, now: number) {
    const wave = Math.sin(now / 240) * 3;
    ctx.fillStyle = this.pal.text;
    ctx.fillRect(cx - 2, baseY - 58, 4, 62);
    ctx.beginPath();
    ctx.moveTo(cx + 2, baseY - 58);
    ctx.lineTo(cx + 30, baseY - 50 + wave);
    ctx.lineTo(cx + 2, baseY - 40);
    ctx.closePath();
    ctx.fill();
    // checkered cap tile
    ctx.fillStyle = this.pal.bg;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 2; j++) {
        if ((i + j) % 2 === 0) {
          ctx.fillRect(cx + 2 + i * 5, baseY - 56 + j * 5, 5, 5);
        }
      }
    }
    ctx.fillStyle = this.pal.text;
  }

  private drawTrail(ctx: CanvasRenderingContext2D) {
    if (this.trail === "trail:none" || this.trailBuf.length < 2) return;
    const pal = this.pal;
    if (this.trail === "trail:comet") {
      const buf = this.trailBuf;
      const step = Math.floor(buf.length / 7) || 1;
      for (let i = 0; i < 7; i++) {
        const p = buf[Math.min(buf.length - 1, i * step)];
        if (!p) continue;
        const t = i / 7;
        ctx.globalAlpha = 0.05 + t * 0.25;
        ctx.fillStyle = pal.player;
        const r = 9 * t + 1.5;
        ctx.beginPath();
        ctx.arc(p.x + this.pw / 2, p.y + this.ph / 2, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else if (this.trail === "trail:shadow") {
      const buf = this.trailBuf;
      const idxs = [buf.length - 8, buf.length - 16, buf.length - 24];
      const alphas = [0.16, 0.1, 0.06];
      idxs.forEach((idx, k) => {
        const p = idx >= 0 ? buf[idx] : null;
        if (!p) return;
        ctx.globalAlpha = alphas[k];
        ctx.fillStyle = pal.player;
        ctx.fillRect(p.x, p.y, this.pw, this.ph);
      });
      ctx.globalAlpha = 1;
    }
    // trail:pixels handled by particles
  }

  private drawPlayer(ctx: CanvasRenderingContext2D, now: number) {
    const pal = this.pal;
    const cx = this.px + this.pw / 2;
    const cy = this.py + this.ph / 2;
    let sxs = 1, sys = 1;
    if (this.landT > 0) { sxs = 1.22; sys = 0.78; }
    else if (Math.abs(this.vy) > 640) { sxs = 0.88; sys = 1.12; }

    ctx.save();
    ctx.translate(cx, cy);
    if (this.gravSign === -1) ctx.scale(1, -1);
    ctx.scale(sxs, sys);
    const w = this.pw, h = this.ph;
    const x = -w / 2, y = -h / 2;

    if (this.skin === "skin:ghost") {
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = pal.player;
      ctx.fillRect(x, y, w, h);
      ctx.globalAlpha = 0.25;
      ctx.fillRect(x + 3, y - 4, w, 4);
      ctx.globalAlpha = 1;
    } else if (this.skin === "skin:hollow") {
      ctx.fillStyle = pal.player;
      ctx.fillRect(x, y, w, h);
      ctx.fillStyle = pal.bg;
      ctx.fillRect(x + 5, y + 5, w - 10, h - 10);
    } else if (this.skin === "skin:diagonal") {
      ctx.fillStyle = pal.player;
      ctx.beginPath();
      ctx.moveTo(x, y + h);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x + w, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 0.4;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + h);
      ctx.lineTo(x + w, y);
      ctx.closePath();
      ctx.fill();
      ctx.globalAlpha = 1;
    } else if (this.skin === "skin:checker") {
      const cw = w / 2, chh = h / 2;
      for (let i = 0; i < 2; i++) {
        for (let j = 0; j < 2; j++) {
          ctx.fillStyle = (i + j) % 2 === 0 ? pal.player : pal.subtle;
          ctx.fillRect(x + i * cw, y + j * chh, cw + 0.5, chh + 0.5);
        }
      }
    } else {
      ctx.fillStyle = pal.player;
      ctx.fillRect(x, y, w, h);
    }

    // eyes — look toward movement, blink occasionally
    const blink = Math.sin(now / 1400 + this.level.id) > 0.985;
    const look = Math.max(-3, Math.min(3, this.vx / 90));
    ctx.fillStyle = this.skin === "skin:hollow" ? pal.player : pal.bg;
    const eh = blink ? 1.5 : 5;
    ctx.fillRect(x + 5 + look, y + 7, 4, eh);
    ctx.fillRect(x + w - 9 + look, y + 7, 4, eh);
    ctx.restore();
  }
}
