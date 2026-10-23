// Browser-side API client. No localStorage, no sessionStorage, no cookies
// written from JS — identity lives entirely in httpOnly cookies + Postgres.

export interface Account {
  id: string;
  username: string;
  email: string | null;
  displayName: string | null;
  isGuest: boolean;
  emailVerified: boolean;
  createdAt: string;
}

export interface Profile {
  coins: number;
  totalDeaths: number;
  unlockBoost: number;
}

export interface SettingsState {
  theme: "light" | "dark";
  sound: boolean;
  volume: number;
  shake: boolean;
  skin: string;
  trail: string;
  taunt: string;
}

export interface ProgressRow {
  levelId: number;
  completed: boolean;
  attempts: number;
  bestDeaths: number | null;
  bestTimeMs: number | null;
}

export interface LevelContent {
  id: number;
  name: string;
  sub: string;
  parSeconds: number;
  deathlessBonus: number;
}

export interface ItemContent {
  id: string;
  category: "skin" | "trail" | "gear" | "taunt";
  name: string;
  blurb: string;
  price: number;
  consumable: boolean;
}

export interface AchievementContent {
  key: string;
  name: string;
  description: string;
}

export interface AppState {
  account: Account | null;
  hasGuest: boolean;
  profile: Profile;
  settings: SettingsState;
  progress: ProgressRow[];
  owned: Record<string, number>;
  unlocked: Record<string, string>;
  levels: LevelContent[];
  items: ItemContent[];
  achievementDefs: AchievementContent[];
}

export const DEFAULT_SETTINGS: SettingsState = {
  theme: "dark",
  sound: true,
  volume: 60,
  shake: true,
  skin: "skin:solid",
  trail: "trail:none",
  taunt: "taunt:classic",
};

async function req<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    credentials: "same-origin",
    headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const err = new Error(String(body.error ?? "request failed")) as Error & {
      errors?: Record<string, string>;
      status?: number;
    };
    err.errors = (body.errors as Record<string, string>) ?? undefined;
    err.status = res.status;
    throw err;
  }
  return body as T;
}

type RawRow = Record<string, unknown>;

export async function fetchState(): Promise<AppState> {
  const raw = await req<RawRow>("/api/state");
  const content = (raw.content ?? {}) as {
    levels?: RawRow[];
    items?: RawRow[];
    achievements?: RawRow[];
  };
  const p = raw.profile as RawRow | null;
  const s = raw.settings as RawRow | null;

  const owned: Record<string, number> = {};
  for (const row of (raw.owned ?? []) as RawRow[]) {
    owned[String(row.item_id)] = Number(row.qty);
  }
  const unlocked: Record<string, string> = {};
  for (const row of (raw.unlocked ?? []) as RawRow[]) {
    unlocked[String(row.achievement_key)] = String(row.unlocked_at);
  }

  return {
    account: (raw.account as Account | null) ?? null,
    hasGuest: raw.hasGuest === true,
    profile: {
      coins: Number(p?.coins ?? 0),
      totalDeaths: Number(p?.total_deaths ?? 0),
      unlockBoost: Number(p?.unlock_boost ?? 0),
    },
    settings: s
      ? {
          theme: (s.theme as "light" | "dark") ?? "dark",
          sound: s.sound !== false,
          volume: Number(s.volume ?? 60),
          shake: s.shake !== false,
          skin: String(s.skin ?? DEFAULT_SETTINGS.skin),
          trail: String(s.trail ?? DEFAULT_SETTINGS.trail),
          taunt: String(s.taunt ?? DEFAULT_SETTINGS.taunt),
        }
      : DEFAULT_SETTINGS,
    progress: ((raw.progress ?? []) as RawRow[]).map((r) => ({
      levelId: Number(r.level_id),
      completed: r.completed === true,
      attempts: Number(r.attempts),
      bestDeaths: r.best_deaths === null ? null : Number(r.best_deaths),
      bestTimeMs: r.best_time_ms === null ? null : Number(r.best_time_ms),
    })),
    owned,
    unlocked,
    levels: (content.levels ?? []).map((l) => ({
      id: Number(l.id),
      name: String(l.name),
      sub: String(l.sub),
      parSeconds: Number(l.par_seconds),
      deathlessBonus: Number(l.deathless_bonus),
    })),
    items: (content.items ?? []).map((i) => ({
      id: String(i.id),
      category: i.category as ItemContent["category"],
      name: String(i.name),
      blurb: String(i.blurb),
      price: Number(i.price),
      consumable: i.consumable === true,
    })),
    achievementDefs: (content.achievements ?? []).map((a) => ({
      key: String(a.key),
      name: String(a.name),
      description: String(a.description),
    })),
  };
}

// ───────────────────────────── auth ─────────────────────────────

export type AuthAction =
  | "signup"
  | "signin"
  | "guest-signup"
  | "guest-signin"
  | "signout"
  | "delete-guest";

export async function auth(action: AuthAction, payload: Record<string, unknown> = {}) {
  return req<{ ok: boolean }>("/api/auth", {
    method: "POST",
    body: JSON.stringify({ action, ...payload }),
  });
}

export async function verifyEmail(token: string) {
  return req<{ ok: boolean; accountId?: string }>("/api/verify", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function patchSettings(patch: Partial<SettingsState>) {
  return req<{ settings: RawRow }>("/api/settings", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export interface RunResult {
  coinsEarned: number;
  firstClear: boolean;
  newAchievements: string[];
  profile: Profile;
  isGuest: boolean;
}

export async function submitRun(payload: {
  levelId: number;
  won: boolean;
  runDeaths: number;
  timeMs: number;
  coins: number;
}) {
  const raw = await req<RawRow>("/api/progress", {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const p = (raw.profile ?? {}) as RawRow;
  return {
    coinsEarned: Number(raw.coinsEarned ?? 0),
    firstClear: raw.firstClear === true,
    newAchievements: (raw.newAchievements as string[]) ?? [],
    profile: {
      coins: Number(p.coins ?? 0),
      totalDeaths: Number(p.totalDeaths ?? 0),
      unlockBoost: Number(p.unlockBoost ?? 0),
    },
    isGuest: raw.isGuest === true,
  } satisfies RunResult;
}

export async function buyItem(itemId: string) {
  return req<{ ok: boolean; coins: number }>("/api/shop", {
    method: "POST",
    body: JSON.stringify({ itemId, action: "buy" }),
  });
}

export async function useItem(itemId: string) {
  return req<{ ok: boolean; qty: number; unlockBoost?: number }>("/api/shop", {
    method: "POST",
    body: JSON.stringify({ itemId, action: "use" }),
  });
}

export interface BoardRow {
  accountId: string;
  name: string;
  value: number;
  detail: string;
}

export async function fetchLeaderboard() {
  return req<{
    boards: { cleared: BoardRow[]; deaths: BoardRow[]; speed: BoardRow[] };
    isGuest: boolean;
    signedIn: boolean;
  }>("/api/leaderboard");
}

export async function fetchAchievements() {
  return req<{
    achievements: Array<{
      key: string;
      name: string;
      description: string;
      unlocked: boolean;
      unlockedAt: string | null;
    }>;
    disabled: boolean;
    signedIn: boolean;
  }>("/api/achievements");
}
