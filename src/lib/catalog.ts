// Shared source of truth for shop items, taunt packs, achievements and
// level metadata. Imported by both client UI and server API routes.

export type ItemCategory = "skin" | "trail" | "gear" | "taunt";

export interface ShopItem {
  id: string;
  category: ItemCategory;
  name: string;
  blurb: string;
  price: number;
  consumable: boolean;
}

export const SHOP_ITEMS: ShopItem[] = [
  // ——— SKINS — player square rendering styles
  { id: "skin:solid", category: "skin", name: "SLAB", blurb: "The default. Dense, honest, doomed.", price: 0, consumable: false },
  { id: "skin:hollow", category: "skin", name: "HOLLOW", blurb: "An empty box. Like your confidence.", price: 160, consumable: false },
  { id: "skin:diagonal", category: "skin", name: "WEDGE", blurb: "Split personality, 45 degrees.", price: 200, consumable: false },
  { id: "skin:checker", category: "skin", name: "CHECKER", blurb: "Four pixels of pure stability.", price: 240, consumable: false },
  { id: "skin:ghost", category: "skin", name: "PHANTOM", blurb: "Half-here. Fully breakable.", price: 320, consumable: false },
  // ——— TRAILS — particle trails
  { id: "trail:none", category: "trail", name: "BARE", blurb: "No trail. Leave no trace.", price: 0, consumable: false },
  { id: "trail:pixels", category: "trail", name: "PIXELRAIN", blurb: "Shed tiny squares while sprinting.", price: 180, consumable: false },
  { id: "trail:comet", category: "trail", name: "COMET", blurb: "A shrinking tail of speed.", price: 220, consumable: false },
  { id: "trail:shadow", category: "trail", name: "AFTERIMAGE", blurb: "Your past selves, lagging behind.", price: 300, consumable: false },
  // ——— GEAR — consumables (stackable)
  { id: "gear:reveal", category: "gear", name: "TRAP-SCOPE", blurb: "Every trap is invisible until it springs. This flashes them all for 2 seconds.", price: 70, consumable: true },
  { id: "gear:pass", category: "gear", name: "ANCHOR", blurb: "Drop one extra checkpoint, anywhere, mid-run.", price: 130, consumable: true },
  { id: "gear:skip", category: "gear", name: "SKIP TOKEN", blurb: "Permanently unlock the level after your current one.", price: 400, consumable: true },
  // ——— TAUNTS — death message packs
  { id: "taunt:classic", category: "taunt", name: "CLASSIC RAGE", blurb: "The original verbal slap.", price: 0, consumable: false },
  { id: "taunt:corporate", category: "taunt", name: "CORPORATE", blurb: "Deaths, now with HR-approved feedback.", price: 140, consumable: false },
  { id: "taunt:poetic", category: "taunt", name: "POETIC", blurb: "Every fall, a tiny tragedy.", price: 200, consumable: false },
  { id: "taunt:minimal", category: "taunt", name: "MINIMAL", blurb: "No words. Just judgment.", price: 120, consumable: false },
];

export const ITEM_MAP = new Map(SHOP_ITEMS.map((i) => [i.id, i]));

export const DEFAULT_SKIN = "skin:solid";
export const DEFAULT_TRAIL = "trail:none";
export const DEFAULT_TAUNT = "taunt:classic";

// ———————————————————— TAUNT MESSAGES ————————————————————

export const TAUNTS: Record<string, string[]> = {
  classic: [
    "AGAIN.",
    "THE FLOOR LIED. YOU BELIEVED.",
    "YOU WALKED INTO THAT ONE.",
    "SKILL ISSUE NOT FOUND. STILL LOOKING.",
    "THAT SPIKE WAS JUST MADE.",
    "THE SIGN SAID NO. YOU SAID YES.",
    "IMPRESSIVE. TECHNICALLY.",
    "SO CLOSE. SO, SO FAR.",
    "THE TUTORIAL WAS EASIER THAN THIS.",
    "PRESSING JUMP DOES NOT MAKE IT WORK.",
    "RIP AND UNTIL NEXT TIME.",
    "THIS LEVEL REMEMBERS YOU.",
  ],
  corporate: [
    "FEEDBACK LOGGED. TRY AGAIN.",
    "YOUR PERFORMANCE HAS BEEN NOTED.",
    "WE'VE DECIDED TO GO IN A DIFFERENT DIRECTION.",
    "PLEASE RESCHEDULE YOUR SUCCESS.",
    "THIS MEETING COULD HAVE BEEN A RESPAWN.",
    "GREAT ENERGY. WRONG TRAJECTORY.",
    "ACTION ITEM: STOP DYING.",
    "CIRCLE BACK WHEN YOU CAN JUMP.",
  ],
  poetic: [
    "THE VOID ACCEPTS YOUR OFFERING.",
    "A SMALL SQUARE, A GRAND FALL.",
    "GRAVITY: THE OLDEST POEM.",
    "YOU FELL, AS ALL THINGS MUST.",
    "THE PIT KNOWS YOUR NAME NOW.",
    "EACH DEATH, A VERSE. THIS ONE RHYMES.",
    "THE FLOOR YOU TRUSTED HAS MOVED ON.",
    "SILENCE. SQUARES. TRAGEDY.",
  ],
  minimal: ["NOPE.", "LOL.", "...", "NO.", "AGAIN?", "HM.", "OOF.", "WOW.", "OKAY."],
};

export const FAKE_FLAG_MESSAGE = "THE FLAG WAS A LIE";
export const FAKE_CHECKPOINT_MESSAGE = "NOT A CHECKPOINT";

// ———————————————————— ACHIEVEMENTS ————————————————————

export interface AchievementDef {
  key: string;
  name: string;
  desc: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  { key: "first-death", name: "WELCOME TO EXOTIC", desc: "Die for the first time. The game thanks you." },
  { key: "first-clear", name: "ACTUALLY NOT BAD", desc: "Complete your first level." },
  { key: "deaths-25", name: "COMMITTED", desc: "Reach 25 total deaths." },
  { key: "deaths-100", name: "CENTURY OF PAIN", desc: "Reach 100 total deaths." },
  { key: "deaths-250", name: "PROFESSIONAL VICTIM", desc: "Reach 250 total deaths." },
  { key: "flawless", name: "UNTOUCHABLE", desc: "Complete a level without dying." },
  { key: "speedrun", name: "AGAINST THE CLOCK", desc: "Beat a level under par time." },
  { key: "trio", name: "THIRD TIME'S THE CHARM", desc: "Complete 3 different levels." },
  { key: "full-clear", name: "EXOTIC CERTIFIED", desc: "Complete every level." },
  { key: "hoarder", name: "SQUARE RICH", desc: "Hold 500 coins at once." },
  { key: "shopper", name: "ENABLING THE ECONOMY", desc: "Buy something from the shop." },
];

export const ACHIEVEMENT_MAP = new Map(ACHIEVEMENTS.map((a) => [a.key, a]));

// ———————————————————— LEVEL META ————————————————————

export interface LevelMeta {
  id: number;
  name: string;
  sub: string;
  par: number; // seconds
  deathlessBonus: number;
}

export const LEVEL_META: LevelMeta[] = [
  { id: 1, name: "TRUST ISSUES", sub: "The floor has opinions.", par: 25, deathlessBonus: 40 },
  { id: 2, name: "FALSE PROMISES", sub: "Flags may be less real than they appear.", par: 35, deathlessBonus: 50 },
  { id: 3, name: "AIR IS A LIE", sub: "Invisible things ruin everything.", par: 40, deathlessBonus: 60 },
  { id: 4, name: "GRAVITY FLIPS", sub: "Up is a suggestion.", par: 50, deathlessBonus: 70 },
  { id: 5, name: "THE COLLECTOR", sub: "Coins are bait. You are the fish.", par: 55, deathlessBonus: 80 },
  { id: 6, name: "EXOTIC", sub: "The final betrayal.", par: 70, deathlessBonus: 120 },
];

export const COIN_VALUE = 5;
export const CLEAR_REWARD = 40;
export const FIRST_CLEAR_BONUS = 60;
export const SPEED_BONUS = 40;

export const categoryLabel = (c: ItemCategory) =>
  c === "skin" ? "SKINS" : c === "trail" ? "TRAILS" : c === "gear" ? "GEAR" : "TAUNTS";
