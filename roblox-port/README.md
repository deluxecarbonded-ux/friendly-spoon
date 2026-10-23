# EXOTIC — Roblox Luau port

Roblox-native port of the EXOTIC web build. The original Next.js app under `../` is untouched.

## Build / deploy

This is a [Rojo](https://rojo.space) project. With `rojo` and Roblox Studio installed:

```bash
rojo build default.project.json -o EXOTIC.rbxlx   # emit a place file
# or live-sync into Studio:
rojo serve default.project.json
```

`default.project.json` maps:
- `src/ReplicatedStorage/Shared` → `ReplicatedStorage/Shared` (engine + screens + UI kit)
- `src/ServerScriptService` → `ServerScriptService` (data + remotes)
- `src/StarterPlayer/StarterPlayerScripts` → `StarterPlayerScripts` (client entrypoint)

DataStores and OrderedDataStores require **Studio Access to API Services** enabled (Game Settings → Security).

## Architecture

The port keeps the web build's structure, mapped onto Roblox services:

| Web source | Roblox port |
| --- | --- |
| `src/game/engine.ts` | `Shared/Engine.luau` — 1:1 physics/sim, 0-indexed tile logic |
| `src/game/renderer.ts` | `Shared/Renderer.luau` — scanline rasterizer onto pooled GuiObjects |
| `src/game/preview.ts` | `Shared/Preview.luau` — bot + live preview scenes |
| `src/game/audio.ts` | `Shared/Audio.luau` — sfx API (see audio notes) |
| `src/game/levels.ts` | `Shared/Levels.luau` — all 6 levels + events |
| `src/lib/catalog.ts` | `Shared/Catalog.luau` — shop/taunts/achievements/palettes |
| `src/lib/utils.ts` | `Shared/Utils.luau` — `fmtTime` / `fmtClock` / `pad2` |
| `src/components/providers.tsx` | `Shared/App.luau` — client state + router + toasts |
| `src/components/pill-button.tsx`, `screen-shell.tsx`, `globals.css` | `Shared/Ui.luau` — theme-aware UI kit |
| `src/app/*/page.tsx` | `Shared/Screens/*.luau` — one module per screen |
| `src/app/api/*` | `ServerScriptService/{RemoteHandlers,DataService,LeaderboardService,AchievementService}.luau` |

### Screens & routing

Every screen is a **ModuleScript** under `ReplicatedStorage/Shared/Screens/`, exposing
`build()` → a controller with `frame`/`screen`, plus optional `onEnter(arg)`, `onExit()`,
`retheme()`, and `refresh()`. A single LocalScript, `Main.client.luau`, builds all of them,
registers them on the shared `App` singleton, and starts on `Splash`. `App.navigate(name, arg)`
handles enter/exit and visibility.

This replaces the web build's per-page routing. Because Roblox has no URL router, the numbered
Home hotkeys (1–7) and every button call `App.navigate` directly.

### Engine indexing

`Engine.luau` uses **0-indexed tile coordinates internally** (`charAtGrid(c, r)` reads
`grid[r+1][c+1]`), matching `engine.ts` byte-for-byte. `Levels.luau` pre-converts its authored
piece coords to 1-indexed once at load; `Preview.luau` converts at runtime. All callers pass
0-indexed tile coords.

### Persistence

Supabase/Postgres/RLS/SSE/Resend cannot run in Roblox. They are replaced with:
- `DataService` — 5 DataStores (profile, progress, settings, purchases, achievements) behind a
  per-session cache; flushed on `PlayerRemoving` and `BindToClose`.
- `LeaderboardService` — 3 OrderedDataStores (most cleared / fewest deaths / fastest) with
  `GetNameFromUserIdAsync` display-name lookup.
- `AchievementService` — server-side evaluation, persisted so each achievement fires once.

Roblox Player identity replaces accounts, email verification, and guests. There is no guest mode:
Leaderboard/Achievements are always available.

## Fidelity notes (known deviations from the web build)

These are inherent platform limits, not unfinished work:

- **Audio** — the web build synthesizes every effect with WebAudio oscillators/noise at runtime.
  Luau cannot create oscillators, so each named effect is mapped onto the closest sound that
  ships with Roblox (`rbxasset://sounds/...`), preserving timing, layering, and the
  enabled/volume config. The `sfx` API surface matches `audio.ts` one-for-one, so callers port
  verbatim — only the timbre differs.
- **Icons** — the web build uses lucide-react SVG strokes. Roblox cannot load those SVGs without
  uploading PNG decals, so `Icons.luau` maps each icon to the closest monochrome Unicode glyph,
  preserving the flat monochrome look. To use the real art, export each SVG to PNG, upload as a
  Decal, and swap the glyph for an `ImageLabel`.
- **Rendering** — Canvas2D is replaced by a scanline rasterizer that pools GuiObjects (frames,
  triangles via `Frame`+`UICorner`/image, circles) with alpha. It reproduces parallax, camera
  shake, flash, trails, particles, and every tile/skin at the correct palette, but is drawn with
  GUI primitives rather than pixels, so sub-pixel edges are approximated.

## Files

```
src/ReplicatedStorage/Shared/
  App.luau  Audio.luau  Catalog.luau  Engine.luau  Icons.luau  Levels.luau
  Preview.luau  Renderer.luau  Remotes.luau  Ui.luau  Utils.luau
  Screens/  Splash Home Levels Shop Play Leaderboard Achievements Settings Credits Locked
src/ServerScriptService/
  RemoteHandlers.server.luau  DataService.luau  LeaderboardService.luau  AchievementService.luau
src/StarterPlayer/StarterPlayerScripts/
  Main.client.luau
default.project.json
```

`.luau` files; rename to `.lua` if your Studio toolchain expects `.lua`.
