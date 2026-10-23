"use client";

import { Trophy, X } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { sfx } from "@/game/audio";
import { UiAudio } from "@/components/ui-audio";
import { useRealtime } from "@/hooks/use-realtime";
import {
  auth as authCall,
  fetchState,
  patchSettings,
  DEFAULT_SETTINGS,
  type Account,
  type AppState,
  type ItemContent,
  type LevelContent,
  type ProgressRow,
  type RunResult,
  type SettingsState,
} from "@/lib/client-api";

export type ThemeMode = "light" | "dark";

interface Toast {
  id: number;
  title: string;
  desc?: string;
}

export type ToastTone = "info" | "success" | "error" | "achievement" | "silent";

interface AppCtxValue {
  ready: boolean;
  account: Account | null;
  isGuest: boolean;
  hasGuest: boolean;
  signedIn: boolean;
  profile: AppState["profile"];
  settings: SettingsState;
  progress: ProgressRow[];
  owned: Record<string, number>;
  unlocked: Record<string, string>;
  levels: LevelContent[];
  items: ItemContent[];
  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;
  updateSettings: (p: Partial<SettingsState>) => Promise<void>;
  refresh: () => Promise<void>;
  applyRunResult: (r: RunResult) => void;
  signOut: () => Promise<void>;
  tell: (title: string, desc?: string, tone?: ToastTone) => void;
  unlockedLevel: number;
  maxCompleted: number;
  bestFor: (levelId: number) => ProgressRow | undefined;
  levelMeta: (levelId: number) => LevelContent | undefined;
  bumpBoards: number;
}

const Ctx = createContext<AppCtxValue | null>(null);

const EMPTY: AppState = {
  account: null,
  hasGuest: false,
  profile: { coins: 0, totalDeaths: 0, unlockBoost: 0 },
  settings: DEFAULT_SETTINGS,
  progress: [],
  owned: {},
  unlocked: {},
  levels: [],
  items: [],
  achievementDefs: [],
};

let toastSeq = 1;

export function Providers({
  children,
  initialTheme,
}: {
  children: ReactNode;
  initialTheme: ThemeMode;
}) {
  const [state, setState] = useState<AppState>(EMPTY);
  const [ready, setReady] = useState(false);
  const [theme, setThemeState] = useState<ThemeMode>(initialTheme);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [bumpBoards, setBumpBoards] = useState(0);
  const router = useRouter();
  const achDefs = useRef<Map<string, string>>(new Map());

  const applyTheme = useCallback((t: ThemeMode) => {
    setThemeState(t);
    document.documentElement.classList.toggle("dark", t === "dark");
  }, []);

  const load = useCallback(async () => {
    const next = await fetchState();
    setState(next);
    achDefs.current = new Map(next.achievementDefs.map((a) => [a.key, a.name]));
    if (next.account) applyTheme(next.settings.theme);
    sfx.configure({ enabled: next.settings.sound, volume: next.settings.volume / 100 });
  }, [applyTheme]);

  useEffect(() => {
    load()
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, [load]);

  // ── realtime: any DB change for this account re-pulls state instantly ──
  useRealtime(
    useCallback(
      (e) => {
        if (e.scope === "self") {
          void load();
        } else {
          // someone else's run changed the public boards
          setBumpBoards((n) => n + 1);
        }
      },
      [load],
    ),
  );

  const tell = useCallback((title: string, desc?: string, tone: ToastTone = "info") => {
    const id = toastSeq++;
    setToasts((t) => [...t.slice(-3), { id, title, desc }]);
    if (tone === "success") sfx.success();
    else if (tone === "error") sfx.denied();
    else if (tone === "achievement") sfx.achievement();
    else if (tone !== "silent") sfx.toast();
    window.setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const updateSettings = useCallback(
    async (patch: Partial<SettingsState>) => {
      // optimistic — realtime will confirm
      setState((s) => ({ ...s, settings: { ...s.settings, ...patch } }));
      if (patch.theme) applyTheme(patch.theme);
      if (patch.sound !== undefined || patch.volume !== undefined) {
        sfx.configure({
          enabled: patch.sound ?? state.settings.sound,
          volume: (patch.volume ?? state.settings.volume) / 100,
        });
      }
      try {
        await patchSettings(patch);
      } catch {
        void load();
      }
    },
    [applyTheme, load, state.settings.sound, state.settings.volume],
  );

  const setTheme = useCallback(
    (t: ThemeMode) => {
      applyTheme(t);
      if (state.account) void updateSettings({ theme: t });
    },
    [applyTheme, state.account, updateSettings],
  );

  const toggleTheme = useCallback(() => {
    setTheme(document.documentElement.classList.contains("dark") ? "light" : "dark");
  }, [setTheme]);

  const applyRunResult = useCallback(
    (r: RunResult) => {
      setState((s) => ({ ...s, profile: r.profile }));
      for (const key of r.newAchievements) {
        tell(`ACHIEVEMENT — ${achDefs.current.get(key) ?? key}`, "Recorded forever.", "achievement");
      }
    },
    [tell],
  );

  const signOut = useCallback(async () => {
    await authCall("signout").catch(() => undefined);
    sfx.close();
    setState(EMPTY);
    router.push("/signin");
    router.refresh();
  }, [router]);

  const maxCompleted = useMemo(
    () => state.progress.filter((p) => p.completed).reduce((m, p) => Math.max(m, p.levelId), 0),
    [state.progress],
  );
  const levelCount = state.levels.length || 6;
  const unlockedLevel = Math.min(
    levelCount,
    Math.max(1, maxCompleted + 1 + state.profile.unlockBoost),
  );

  const bestFor = useCallback(
    (levelId: number) => state.progress.find((p) => p.levelId === levelId),
    [state.progress],
  );
  const levelMeta = useCallback(
    (levelId: number) => state.levels.find((l) => l.id === levelId),
    [state.levels],
  );

  const value: AppCtxValue = {
    ready,
    account: state.account,
    isGuest: state.account?.isGuest ?? false,
    hasGuest: state.hasGuest,
    signedIn: state.account !== null,
    profile: state.profile,
    settings: state.settings,
    progress: state.progress,
    owned: state.owned,
    unlocked: state.unlocked,
    levels: state.levels,
    items: state.items,
    theme,
    setTheme,
    toggleTheme,
    updateSettings,
    refresh: load,
    applyRunResult,
    signOut,
    tell,
    unlockedLevel,
    maxCompleted,
    bestFor,
    levelMeta,
    bumpBoards,
  };

  return (
    <Ctx.Provider value={value}>
      <UiAudio />
      {children}
      <div className="pointer-events-none fixed right-4 bottom-4 z-[120] flex flex-col items-end gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="pointer-events-auto flex max-w-xs animate-pop-in items-center gap-3 rounded-full bg-fg py-2.5 pr-4 pl-3 text-bg"
          >
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-bg text-fg">
              <Trophy className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate font-mono text-[11px] font-bold tracking-wider">
                {t.title}
              </span>
              {t.desc ? <span className="block truncate text-[11px] opacity-70">{t.desc}</span> : null}
            </span>
            <button
              className="focus-ring ml-1 grid size-6 shrink-0 cursor-pointer place-items-center rounded-full opacity-60 hover:opacity-100"
              onClick={() => setToasts((x) => x.filter((i) => i.id !== t.id))}
              aria-label="dismiss"
            >
              <X className="size-3.5" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useApp(): AppCtxValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp must be used inside Providers");
  return v;
}
