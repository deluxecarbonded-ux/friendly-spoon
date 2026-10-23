"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Variant = "solid" | "soft" | "ghost";
type Size = "sm" | "md" | "lg" | "xl";
export type PillSound =
  | "click"
  | "nav"
  | "select"
  | "toggle"
  | "open"
  | "close"
  | "volume"
  | "success"
  | "error"
  | "none";

const base =
  "focus-ring inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold uppercase tracking-[0.14em] whitespace-nowrap select-none transition-[background-color,color,transform,opacity] duration-200 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-35";

const variants: Record<Variant, string> = {
  solid: "bg-fg text-bg hover:bg-fg/90",
  soft: "bg-pan text-fg hover:bg-pan2",
  ghost: "bg-transparent text-mut hover:bg-pan hover:text-fg",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-4 text-[11px]",
  md: "h-11 px-6 text-xs",
  lg: "h-13 px-8 text-sm",
  xl: "h-16 px-10 text-base tracking-[0.2em]",
};

export interface PillButtonProps {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  title?: string;
  /** Override the global UI sound for this control. */
  sound?: PillSound;
  /** @deprecated use sound="none" */
  silent?: boolean;
  type?: "button" | "submit";
}

export function PillButton({
  children,
  variant = "solid",
  size = "md",
  icon,
  iconRight,
  href,
  onClick,
  disabled,
  className,
  title,
  sound,
  silent,
  type = "button",
}: PillButtonProps) {
  const cls = cn(base, variants[variant], sizes[size], className);
  const sfxName = sound ?? (silent ? "none" : undefined);
  const inner = (
    <>
      {icon}
      <span>{children}</span>
      {iconRight}
    </>
  );
  const handle = () => {
    if (disabled) return;
    onClick?.();
  };
  if (href && !disabled) {
    return (
      <Link href={href} className={cls} title={title} onClick={handle} data-sfx={sfxName}>
        {inner}
      </Link>
    );
  }
  return (
    <button
      type={type}
      className={cls}
      onClick={handle}
      disabled={disabled}
      title={title}
      data-sfx={sfxName}
    >
      {inner}
    </button>
  );
}
