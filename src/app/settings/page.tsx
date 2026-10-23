"use client";

import { Check, FlaskConical, Ghost, LogOut, Moon, Sun, Trash2, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ScreenShell } from "@/components/screen-shell";
import { PillButton } from "@/components/pill-button";
import { useApp } from "@/components/providers";
import { auth } from "@/lib/client-api";
import { sfx } from "@/game/audio";
import { cn } from "@/lib/utils";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-4 flex items-center gap-3 font-mono text-xs font-bold tracking-[0.35em] text-mut">
        <span className="inline-block size-2 bg-fg" />
        {title}
      </h2>
      <div className="rounded-3xl bg-pan p-6 sm:p-7">{children}</div>
    </section>
  );
}

export default function SettingsPage() {
  const { account, isGuest, theme, setTheme, settings, updateSettings, owned, items, signOut, tell } =
    useApp();
  const router = useRouter();
  const [armReset, setArmReset] = useState(false);

  if (!account) {
    return (
      <ScreenShell title="SETTINGS" sub="SIGN IN TO TUNE THE MACHINE.">
        <div className="flex flex-wrap gap-3">
          <PillButton href="/signin">Sign In</PillButton>
          <PillButton href="/signup" variant="soft">
            Sign Up
          </PillButton>
        </div>
      </ScreenShell>
    );
  }

  const deleteAccount = async () => {
    if (!armReset) {
      setArmReset(true);
      window.setTimeout(() => setArmReset(false), 4000);
      return;
    }
    try {
      await auth("delete-guest");
      sfx.close();
      router.push("/signup");
      router.refresh();
    } catch {
      tell("DELETE FAILED", "EVEN THAT BROKE. FITTING.", "error");
    }
  };

  const cosmeticRow = (kind: "skin" | "trail" | "taunt", label: string) => {
    const list = items.filter((i) => i.category === kind);
    const active = settings[kind];
    return (
      <div className="mb-5 last:mb-0">
        <p className="mb-2.5 font-mono text-[10px] tracking-[0.3em] text-mut">{label}</p>
        <div className="flex flex-wrap gap-2">
          {list.map((i) => {
            const has = i.price === 0 || (owned[i.id] ?? 0) > 0;
            const on = active === i.id;
            return (
              <button
                key={i.id}
                disabled={!has}
                onClick={() => void updateSettings({ [kind]: i.id })}
                data-sfx="select"
                className={cn(
                  "focus-ring flex h-10 cursor-pointer items-center gap-2 rounded-full px-5 font-mono text-[11px] font-bold tracking-widest transition-[background-color,color,transform] duration-150",
                  on
                    ? "bg-fg text-bg"
                    : has
                      ? "bg-pan2 text-fg hover:-translate-y-0.5"
                      : "cursor-not-allowed bg-pan2 text-mut opacity-50",
                )}
                title={has ? i.blurb : "Buy it in the shop first"}
              >
                {on && <Check className="size-3.5" />}
                {i.name}
                {!has && <span className="text-[9px]">SHOP</span>}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <ScreenShell title="SETTINGS" sub="EVERY PREFERENCE BELOW LIVES IN THE ACCOUNT, NOT YOUR BROWSER.">
      <Section title="ACCOUNT">
        <div className="flex flex-wrap items-center gap-x-10 gap-y-4">
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-mut">USERNAME</p>
            <p className="mt-1 flex items-center gap-2 font-mono text-lg font-bold tracking-wider">
              {isGuest ? <Ghost className="size-4" /> : null}
              {account.username}
            </p>
          </div>
          {account.displayName ? (
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-mut">DISPLAY NAME</p>
              <p className="mt-1 font-mono text-lg font-bold tracking-wider">{account.displayName}</p>
            </div>
          ) : null}
          {account.email ? (
            <div>
              <p className="font-mono text-[10px] tracking-[0.3em] text-mut">EMAIL</p>
              <p className="mt-1 font-mono text-sm tracking-wider">{account.email}</p>
            </div>
          ) : null}
          <div>
            <p className="font-mono text-[10px] tracking-[0.3em] text-mut">TYPE</p>
            <p className="mt-1 font-mono text-sm font-bold tracking-wider">
              {isGuest ? "GUEST (BOARDS LOCKED)" : "FULL ACCOUNT"}
            </p>
          </div>
        </div>
        <div className="mt-6 flex flex-wrap gap-3">
          <PillButton variant="soft" size="sm" onClick={() => void signOut()} icon={<LogOut className="size-3.5" />}>
            Sign Out
          </PillButton>
          {isGuest ? (
            <PillButton href="/signup" size="sm">
              Upgrade To Real Account
            </PillButton>
          ) : null}
        </div>
      </Section>

      <Section title="APPEARANCE">
        <div className="flex flex-wrap gap-2">
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              data-sfx="toggle"
              className={cn(
                "focus-ring flex h-12 cursor-pointer items-center gap-2 rounded-full px-7 font-mono text-xs font-bold tracking-widest transition-transform hover:-translate-y-0.5",
                theme === t ? "bg-fg text-bg" : "bg-pan2 text-fg",
              )}
            >
              {t === "light" ? <Sun className="size-4" /> : <Moon className="size-4" />}
              {t.toUpperCase()} MODE
            </button>
          ))}
        </div>
        <p className="mt-3 font-mono text-[10px] tracking-[0.2em] text-mut">
          SAVED TO YOUR ACCOUNT — IT FOLLOWS YOU TO ANY DEVICE, INSTANTLY.
        </p>
      </Section>

      <Section title="COSMETICS">
        {cosmeticRow("skin", "PLAYER SKIN")}
        {cosmeticRow("trail", "MOTION TRAIL")}
        {cosmeticRow("taunt", "DEATH TAUNTS")}
      </Section>

      <Section title="AUDIO">
        <div className="flex flex-wrap items-center gap-4">
          <button
            onClick={() => {
              const next = !settings.sound;
              void updateSettings({ sound: next });
              if (next) window.setTimeout(() => sfx.toggle(), 0);
            }}
            data-sfx="toggle"
            className={cn(
              "focus-ring flex h-12 cursor-pointer items-center gap-2 rounded-full px-7 font-mono text-xs font-bold tracking-widest transition-transform hover:-translate-y-0.5",
              settings.sound ? "bg-fg text-bg" : "bg-pan2 text-fg",
            )}
          >
            {settings.sound ? <Volume2 className="size-4" /> : <VolumeX className="size-4" />}
            {settings.sound ? "SOUND ON" : "SOUND OFF"}
          </button>
          <div className="flex min-w-52 flex-1 items-center gap-3">
            <span className="font-mono text-[10px] tracking-[0.25em] text-mut">VOL</span>
            <input
              type="range"
              min={0}
              max={100}
              value={settings.volume}
              onChange={(e) => void updateSettings({ volume: Number(e.target.value) })}
              data-sfx="none"
              className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-pan2 accent-[var(--fg)]"
            />
            <span className="w-10 font-mono text-xs font-bold">{settings.volume}%</span>
          </div>
          <PillButton
            variant="soft"
            size="sm"
            icon={<FlaskConical className="size-3.5" />}
            onClick={() => sfx.coin()}
            silent
          >
            Test
          </PillButton>
        </div>
      </Section>

      <Section title="FEEDBACK">
        <div className="flex flex-wrap gap-2">
          {[true, false].map((v) => (
            <button
              key={String(v)}
              onClick={() => void updateSettings({ shake: v })}
              data-sfx="toggle"
              className={cn(
                "focus-ring flex h-12 cursor-pointer items-center rounded-full px-7 font-mono text-xs font-bold tracking-widest transition-transform hover:-translate-y-0.5",
                settings.shake === v ? "bg-fg text-bg" : "bg-pan2 text-fg",
              )}
            >
              SCREEN SHAKE {v ? "ON" : "OFF"}
            </button>
          ))}
        </div>
      </Section>

      {isGuest ? (
        <Section title="DANGER ZONE">
          <div className="flex flex-wrap items-center gap-4">
            <PillButton
              variant={armReset ? "solid" : "soft"}
              onClick={() => void deleteAccount()}
              icon={<Trash2 className="size-4" />}
            >
              {armReset ? "CLICK AGAIN — NO UNDO" : "Delete Guest Account"}
            </PillButton>
            <p className="max-w-md font-mono text-[10px] leading-relaxed tracking-[0.15em] text-mut">
              ERASES THIS GUEST AND EVERY ROW IT OWNS. ONLY AFTER DELETING CAN A NEW GUEST BE CREATED
              ON THIS DEVICE.
            </p>
          </div>
        </Section>
      ) : null}
    </ScreenShell>
  );
}
