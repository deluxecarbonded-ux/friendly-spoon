"use client";

import { Check, Coins, ShoppingBag } from "lucide-react";
import { useState } from "react";
import { ScreenShell } from "@/components/screen-shell";
import { PreviewCanvas } from "@/components/preview-canvas";
import { PillButton } from "@/components/pill-button";
import { useApp } from "@/components/providers";
import { buyItem } from "@/lib/client-api";
import { categoryLabel, type ItemCategory } from "@/lib/catalog";
import type { ItemContent } from "@/lib/client-api";
import { sfx } from "@/game/audio";
import { cn } from "@/lib/utils";

const CATEGORIES: ItemCategory[] = ["skin", "trail", "gear", "taunt"];

export default function ShopPage() {
  const { profile, owned, settings, updateSettings, items, refresh, tell } = useApp();
  const [busy, setBusy] = useState<string | null>(null);

  const coins = profile.coins;

  const buy = async (item: ItemContent) => {
    if (busy) return;
    setBusy(item.id);
    try {
      await buyItem(item.id);
      await refresh();
      sfx.buy();
      tell(`PURCHASED — ${item.name}`, item.category === "skin" || item.category === "trail" || item.category === "taunt" ? "EQUIP IT BELOW OR IN SETTINGS" : "READY TO USE IN-GAME", "silent");
    } catch (e) {
      tell("DENIED", e instanceof Error ? e.message.toUpperCase() : "MORE COINS NEEDED", "error");
    } finally {
      setBusy(null);
    }
  };

  const isCosmetic = (i: ItemContent) => i.category === "skin" || i.category === "trail" || i.category === "taunt";
  const equippedOf = (i: ItemContent) =>
    (i.category === "skin" && settings.skin === i.id) ||
    (i.category === "trail" && settings.trail === i.id) ||
    (i.category === "taunt" && settings.taunt === i.id);

  return (
    <ScreenShell
      title="SHOP"
      sub="REAL ITEMS, LIVE PREVIEWS. EVERYTHING YOU SEE BELOW IS ACTUALLY RUNNING RIGHT NOW."
      rightExtra={
        <span className="flex h-11 items-center gap-2 rounded-full bg-fg px-5 font-mono text-[11px] font-bold tracking-widest text-bg">
          <Coins className="size-4" />
          {coins}
        </span>
      }
    >
      {CATEGORIES.map((cat) => (
        <section key={cat} className="mb-12">
          <h2 className="mb-5 flex items-center gap-3 font-mono text-xs font-bold tracking-[0.35em] text-mut">
            <span className="inline-block size-2 bg-fg" />
            {categoryLabel(cat)}
          </h2>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {items.filter((i) => i.category === cat).map((item) => {
              const qty = (owned[item.id] ?? 0) + (item.price === 0 ? 1 : 0);
              const ownedItem = qty > 0;
              const equipped = equippedOf(item);
              const affordable = coins >= item.price;
              return (
                <div key={item.id} className="flex flex-col overflow-hidden rounded-3xl bg-pan">
                  {/* live demo video */}
                  <div className="relative aspect-video w-full overflow-hidden">
                    <PreviewCanvas itemId={item.id} />
                    {item.consumable && ownedItem ? (
                      <span className="absolute top-3 right-3 rounded-full bg-fg px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.25em] text-bg">
                        ×{qty}
                      </span>
                    ) : null}
                    {equipped ? (
                      <span className="absolute top-3 right-3 flex items-center gap-1.5 rounded-full bg-fg px-3.5 py-1.5 font-mono text-[10px] font-bold tracking-[0.25em] text-bg">
                        <Check className="size-3" /> ON
                      </span>
                    ) : null}
                  </div>
                  <div className="flex flex-1 flex-col p-5">
                    <h3 className="text-lg font-bold tracking-tight">{item.name}</h3>
                    <p className="mt-1 text-sm text-mut">{item.blurb}</p>
                    <div className="mt-4 flex-1" />
                    {isCosmetic(item) && ownedItem ? (
                      <PillButton
                        size="sm"
                        className="w-full"
                        variant={equipped ? "soft" : "solid"}
                        sound="select"
                        disabled={equipped}
                        onClick={() =>
                          void updateSettings({
                            [item.category as "skin" | "trail" | "taunt"]: item.id,
                          })
                        }
                      >
                        {equipped ? "Equipped" : "Equip"}
                      </PillButton>
                    ) : (
                      <PillButton
                        size="sm"
                        className={cn("w-full", !affordable && "opacity-60")}
                        variant={affordable ? "solid" : "soft"}
                        disabled={!affordable || busy === item.id || (!item.consumable && ownedItem)}
                        icon={<ShoppingBag className="size-3.5" />}
                        onClick={() => void buy(item)}
                      >
                        {!item.consumable && ownedItem
                          ? "Owned"
                          : busy === item.id
                            ? "Buying…"
                            : `${item.price} COINS`}
                      </PillButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}
      <p className="rounded-3xl bg-pan px-8 py-5 text-center font-mono text-[11px] tracking-[0.2em] text-mut">
        COINS ARE EARNED BY PLAYING. DEATH DOES NOT REFUND THEM. NOTHING DOES.
      </p>
    </ScreenShell>
  );
}
