// Level authoring for EXOTIC. Levels live on a 15-row tile grid (TILE = 32).
// Tiles:
//   #  solid            ^  floor spikes          v  hanging spikes
//   D  betrayer floor (drops after you stand on it)
//   H  hidden block (invisible, solid once headbutted)
//   K  spring           C  coin                  c  fake coin (-1 coin)
//   B  real crate (+1 coin when landed on or headbutted)
//   b  trap crate (looks real, explodes if you land on top)
//   E  real guard (patrols, kills, stompable)
//   e  fake guard (patrols, harmless)
//   =  real platform    _  fake platform (collapses)
//   O  real button (does nothing)
//   o  trap button (deploys a homing drone)
//   S  spawn            G  goal flag             X  fake goal (kills)
//   P  checkpoint       F  fake checkpoint
//   >  <  arrow signs (they lie sometimes)

export type EventType =
  | "spikefall"
  | "reverse"
  | "flip"
  | "goalshift"
  | "msg";

export interface LevelEvent {
  type: EventType;
  x: number; // trigger rect, tile coords
  y: number;
  w: number;
  h: number;
  once?: boolean;
  cooldownMs?: number;
  text?: string;
  // spikefall
  at?: number[];
  landY?: number;
  // reverse
  sec?: number;
  // flip
  sign?: 1 | -1;
  // goalshift
  dx?: number;
}

export interface LevelDef {
  id: number;
  name: string;
  tip: string;
  par: number;
  W: number;
  H: number;
  rows: string[];
  events: LevelEvent[];
}

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

const H = 15;

// ———————————————————————————— LEVEL 1 — TRUST ISSUES ————————————————————————————
const L1: LevelDef = {
  id: 1,
  name: "TRUST ISSUES",
  tip: "TIP: SPIKES ARE INVISIBLE UNTIL THEY SPRING. SOME CRATES ARE BOMBS.",
  par: 25,
  W: 72,
  H,
  rows: grid(72, H, [
    [12, 0, R("#", 10)], [13, 0, R("#", 10)],
    [11, 2, "S"],
    [10, 10, "CCCC"],
    [10, 12, "c"],
    [12, 14, R("#", 10)], [13, 14, R("#", 10)],
    [11, 16, "B"], [11, 21, "b"],
    [12, 24, "DDDD"], [13, 24, "^^^^"],
    [12, 28, R("#", 14)], [13, 28, R("#", 14)],
    [11, 29, "O"],
    [11, 30, ">"],
    [11, 33, "CC"],
    [11, 36, "E"], [11, 55, "e"],
    [9, 34, "=="], [9, 37, "__"],
    [8, 34, "CC"], [8, 38, "cC"],
    [9, 43, "HH"],
    [12, 46, R("#", 12)], [13, 46, R("#", 12)],
    [11, 48, "P"],
    [9, 51, "CCC"],
    [11, 56, "X"],
    [12, 58, R("#", 14)], [13, 58, R("#", 14)],
    [11, 60, "o"],
    [11, 65, ">"],
    [11, 66, "G"],
  ]),
  events: [
    { type: "spikefall", x: 50, y: 7, w: 5, h: 5, at: [51, 52, 53], landY: 11, once: true, text: "SURPRISE." },
    { type: "msg", x: 52, y: 8, w: 3, h: 4, text: "THE EXIT. PROMISE.", once: true },
    { type: "msg", x: 15, y: 8, w: 8, h: 4, text: "ONE CRATE PAYS. ONE CRATE EXPLODES.", once: true },
    { type: "msg", x: 31, y: 8, w: 8, h: 4, text: "THE HIGH ROAD IS FREE. TRUST ME.", once: true },
  ],
};

// ———————————————————————————— LEVEL 2 — FALSE PROMISES ————————————————————————————
const L2: LevelDef = {
  id: 2,
  name: "FALSE PROMISES",
  tip: "TIP: FLAGS MAY BE LESS REAL THAN THEY APPEAR. SO ARE THE BOMBS.",
  par: 35,
  W: 84,
  H,
  rows: grid(84, H, [
    [12, 0, R("#", 10)], [13, 0, R("#", 10)],
    [11, 2, "S"],
    [12, 10, "DD"], [13, 10, "^^^^"],
    [10, 10, "CCCC"],
    [12, 14, R("#", 14)], [13, 14, R("#", 14)],
    [11, 16, "F"],
    [11, 18, "B"], [11, 23, "b"],
    [11, 20, ">"],
    [11, 26, "P"],
    [9, 29, "HH"],
    [13, 28, "^^^^"],
    [10, 24, "=="], [10, 27, "__"],
    [9, 24, "CC"], [9, 27, "cC"],
    [12, 32, R("#", 14)], [13, 32, R("#", 14)],
    [9, 34, "CC"],
    [9, 35, "c"],
    [11, 33, "O"],
    [11, 37, "E"],
    [11, 38, ">"],
    [11, 42, "X"],
    [12, 46, "DDDD"],
    [12, 50, R("#", 30)], [13, 50, R("#", 30)],
    [11, 54, "G"],
    [11, 60, "o"], [11, 70, "e"],
    [11, 65, "c"],
    [12, 80, "####"], [13, 80, "####"],
  ]),
  events: [
    { type: "msg", x: 39, y: 8, w: 3, h: 4, text: "FINALLY. THE DOOR.", once: true },
    { type: "spikefall", x: 33, y: 7, w: 5, h: 5, at: [34, 35], landY: 11, once: true },
    { type: "goalshift", x: 50, y: 8, w: 4, h: 5, dx: 12, once: true, text: "COME CLOSER." },
    { type: "goalshift", x: 62, y: 8, w: 4, h: 5, dx: 12, once: true, text: "ALMOST HAD IT." },
    { type: "msg", x: 15, y: 8, w: 9, h: 4, text: "ONE CRATE HAS A COIN. ONE HAS A BOMB.", once: true },
    { type: "msg", x: 23, y: 6, w: 6, h: 4, text: "THAT PLATFORM IS DEFINITELY A PLATFORM.", once: true },
  ],
};

// ———————————————————————————— LEVEL 3 — AIR IS A LIE ————————————————————————————
const L3: LevelDef = {
  id: 3,
  name: "AIR IS A LIE",
  tip: "TIP: SOME BLOCKS ONLY EXIST IF YOU HEADBUTT. SOME CRATES ARE BOMBS.",
  par: 40,
  W: 92,
  H,
  rows: grid(92, H, [
    [12, 0, R("#", 12)], [13, 0, R("#", 12)],
    [11, 2, "S"],
    [11, 5, "B"], [11, 12, "b"],
    [9, 13, "H"], [8, 14, "H"],
    [12, 16, R("#", 18)], [13, 16, R("#", 18)],
    [11, 17, "E"], [11, 21, "O"],
    [12, 20, "K"],
    [5, 22, "vvv"],
    [9, 24, R("#", 5)],
    [8, 25, "CCC"],
    [8, 26, "c"],
    [11, 30, "o"],
    [12, 34, R("#", 22)], [13, 34, R("#", 22)],
    [10, 36, "=="], [10, 39, "__"],
    [9, 36, "CC"], [9, 39, "cC"],
    [11, 46, "^"],
    [11, 50, "P"],
    [10, 56, "#"], [9, 59, "#"], [10, 62, "#"],
    [10, 58, "_"],
    [9, 58, "H"], [9, 61, "H"],
    [12, 64, R("#", 16)], [13, 64, R("#", 16)],
    [11, 70, "E"], [11, 76, "e"],
    [11, 78, "X"],
    [9, 81, "HH"],
    [12, 84, R("#", 8)], [13, 84, R("#", 8)],
    [11, 88, "G"],
  ]),
  events: [
    { type: "reverse", x: 40, y: 5, w: 5, h: 8, sec: 4, cooldownMs: 8000, text: "LEFT IS RIGHT." },
    { type: "spikefall", x: 80, y: 7, w: 4, h: 5, at: [81, 82], landY: 12, once: true, text: "MIND THE RAIN." },
    { type: "msg", x: 33, y: 8, w: 8, h: 4, text: "TWO PLATFORMS. ONE IS A DECORATION.", once: true },
    { type: "msg", x: 55, y: 8, w: 8, h: 4, text: "STEPPING STONES. MOSTLY.", once: true },
  ],
};

// ———————————————————————————— LEVEL 4 — GRAVITY FLIPS ————————————————————————————
const L4: LevelDef = {
  id: 4,
  name: "GRAVITY FLIPS",
  tip: "TIP: UP IS A SUGGESTION. SO IS THAT BUTTON.",
  par: 50,
  W: 82,
  H,
  rows: grid(82, H, [
    [12, 0, R("#", 10)], [13, 0, R("#", 10)],
    [11, 2, "S"],
    [11, 4, "B"], [11, 7, "b"],
    [1, 12, R("#", 19)], [2, 12, R("#", 19)],
    [3, 16, "v"], [3, 21, "v"], [3, 26, "v"],
    [12, 34, R("#", 12)], [13, 34, R("#", 12)],
    [11, 36, "E"],
    [11, 40, "P"],
    [11, 44, "O"],
    [9, 35, "=="], [9, 38, "__"],
    [8, 35, "CC"], [8, 38, "cC"],
    [1, 46, R("#", 11)], [2, 46, R("#", 11)],
    [1, 60, R("#", 3)], [2, 60, R("#", 3)],
    [3, 52, "vv"],
    [12, 64, R("#", 7)], [13, 64, R("#", 7)],
    [11, 65, "e"], [11, 69, "o"],
    [11, 67, "X"],
    [1, 72, R("#", 9)], [2, 72, R("#", 9)],
    [3, 75, "v"],
    [3, 78, "G"],
  ]),
  events: [
    { type: "flip", x: 12, y: 0, w: 2, h: 15, sign: -1, text: "UP IS A SUGGESTION." },
    { type: "flip", x: 31, y: 0, w: 2, h: 15, sign: 1 },
    { type: "flip", x: 46, y: 0, w: 2, h: 15, sign: -1, text: "AGAIN." },
    { type: "flip", x: 63, y: 0, w: 2, h: 15, sign: 1 },
    { type: "flip", x: 72, y: 0, w: 2, h: 15, sign: -1 },
    { type: "msg", x: 3, y: 8, w: 7, h: 4, text: "GRAVITY IS A SUGGESTION. BOXES ARE NOT.", once: true },
    { type: "msg", x: 34, y: 8, w: 7, h: 4, text: "UP IS DOWN. DOWN IS A LIABILITY.", once: true },
  ],
};

// ———————————————————————————— LEVEL 5 — THE COLLECTOR ————————————————————————————
const L5: LevelDef = {
  id: 5,
  name: "THE COLLECTOR",
  tip: "TIP: COINS ARE BAIT. SOME OF THEM ARE COUNTERFEIT.",
  par: 55,
  W: 110,
  H,
  rows: grid(110, H, [
    [12, 0, R("#", 10)], [13, 0, R("#", 10)],
    [11, 2, "S"],
    [12, 12, "DDDDD"], [10, 12, "CCCCC"],
    [10, 14, "c"],
    [12, 18, R("#", 13)], [13, 18, R("#", 13)],
    [11, 21, "B"], [11, 28, "b"],
    [8, 22, "CCC"],
    [11, 27, "F"],
    [9, 32, "HH"],
    [12, 36, R("#", 13)], [13, 36, R("#", 13)],
    [11, 37, "E"], [11, 47, "O"],
    [11, 40, "P"],
    [11, 44, "#"], [11, 45, "^"], [10, 46, "#"],
    [12, 50, R("#", 3)], [13, 50, R("#", 3)],
    [12, 53, "DDDD"], [10, 53, "CCCC"],
    [10, 55, "c"],
    [12, 57, R("#", 6)], [13, 57, R("#", 6)],
    [11, 58, "e"],
    [11, 60, "X"],
    [10, 64, "#"], [9, 67, "#"], [10, 70, "#"], [9, 73, "#"], [10, 76, "#"], [9, 79, "#"],
    [9, 65, "=="], [9, 68, "__"],
    [8, 65, "CC"], [8, 68, "cC"],
    [8, 71, "H"],
    [7, 67, "C"], [7, 73, "C"], [8, 76, "C"],
    [12, 83, R("#", 27)], [13, 83, R("#", 27)],
    [12, 90, "   "],
    [11, 86, "P"],
    [13, 90, "DDD"],
    [12, 90, "CCC"],
    [10, 93, "H"], [9, 94, "H"],
    [11, 96, "o"],
    [11, 100, "G"],
  ]),
  events: [
    { type: "spikefall", x: 20, y: 6, w: 6, h: 5, at: [22, 23, 24], landY: 11, once: true, text: "FREE MONEY." },
    { type: "msg", x: 57, y: 8, w: 3, h: 4, text: "TOTALLY THE END.", once: true },
    { type: "goalshift", x: 95, y: 8, w: 4, h: 5, dx: 6, once: true, text: "NO." },
    { type: "spikefall", x: 96, y: 5, w: 6, h: 3, at: [97, 98, 99, 100], landY: 11, once: true },
    { type: "msg", x: 17, y: 8, w: 9, h: 4, text: "COLLECT EVERYTHING. NOTHING CAN GO WRONG.", once: true },
    { type: "msg", x: 63, y: 8, w: 7, h: 4, text: "THE FLOATING SECTION IS UP TO CODE.", once: true },
  ],
};

// ———————————————————————————— LEVEL 6 — EXOTIC ————————————————————————————
const L6: LevelDef = {
  id: 6,
  name: "EXOTIC",
  tip: "TIP: THE FINAL BETRAYAL. TRUST NOTHING. ESPECIALLY BUTTONS.",
  par: 70,
  W: 128,
  H,
  rows: grid(128, H, [
    [12, 0, R("#", 12)], [13, 0, R("#", 12)],
    [11, 2, "S"],
    [11, 3, "B"], [11, 9, "b"],
    [11, 8, ">"],
    [12, 12, "DDDD"], [13, 12, "^^^^"],
    [10, 12, "CCCC"],
    [10, 13, "c"],
    [12, 16, R("#", 16)], [13, 16, R("#", 16)],
    [11, 19, "E"], [11, 27, "e"],
    [9, 23, "=="], [9, 26, "__"],
    [8, 23, "CC"], [8, 26, "cC"],
    [11, 22, "^"], [11, 25, "^"],
    [11, 30, "P"],
    [9, 33, "HH"],
    [13, 32, "^^^^"],
    [12, 36, R("#", 12)], [13, 36, R("#", 12)],
    [11, 37, "E"],
    [11, 40, "X"],
    [12, 42, "K"],
    [9, 45, R("#", 4)],
    [5, 46, "vv"],
    [10, 42, "H"], [9, 44, "H"],
    [12, 50, R("#", 11)], [13, 50, R("#", 11)],
    [11, 46, "O"],
    [11, 54, "F"],
    [1, 61, R("#", 8)], [2, 61, R("#", 8)],
    [1, 71, R("#", 8)], [2, 71, R("#", 8)],
    [3, 64, "v"], [3, 74, "vv"],
    [12, 81, R("#", 15)], [13, 81, R("#", 15)],
    [11, 82, "o"],
    [11, 84, "P"],
    [11, 88, "#"], [11, 89, "^"], [10, 90, "#"], [11, 91, "^"], [9, 92, "#"],
    [11, 94, "X"],
    [13, 96, "^^^^"],
    [12, 96, "__"],
    [9, 97, "HH"],
    [12, 100, R("#", 28)], [13, 100, R("#", 28)],
    [11, 106, "G"],
  ]),
  events: [
    { type: "reverse", x: 20, y: 5, w: 7, h: 8, sec: 5, cooldownMs: 9000, text: "BACKWARDS, BUDDY." },
    { type: "msg", x: 37, y: 8, w: 2, h: 4, text: "NICE SPRING. SHAME.", once: true },
    { type: "flip", x: 61, y: 0, w: 2, h: 15, sign: -1, text: "CEILING FLOOR." },
    { type: "flip", x: 79, y: 0, w: 2, h: 15, sign: 1 },
    { type: "msg", x: 91, y: 8, w: 2, h: 4, text: "YES THIS ONE. DEFINITELY.", once: true },
    { type: "goalshift", x: 103, y: 8, w: 3, h: 5, dx: 10, once: true, text: "NOT YET." },
    { type: "spikefall", x: 107, y: 6, w: 8, h: 3, at: [109, 110, 111, 112, 113], landY: 11, once: true },
    { type: "goalshift", x: 113, y: 8, w: 3, h: 5, dx: 9, once: true, text: "FINE. TAKE IT." },
    { type: "msg", x: 2, y: 8, w: 8, h: 4, text: "FINAL LEVEL. TRUST NOTHING. ESPECIALLY BOXES.", once: true },
    { type: "msg", x: 94, y: 8, w: 5, h: 4, text: "THE BRIDGE IS FINE.", once: true },
    { type: "msg", x: 99, y: 8, w: 6, h: 4, text: "LAST STRETCH. PROBABLY.", once: true },
  ],
};

export const LEVELS: LevelDef[] = [L1, L2, L3, L4, L5, L6];

export const getLevel = (id: number) => LEVELS.find((l) => l.id === id);
