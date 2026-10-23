"use client";

import { AlertCircle } from "lucide-react";
import { useEffect, useId } from "react";
import { sfx } from "@/game/audio";
import { cn } from "@/lib/utils";

/**
 * Custom-validated field. Native HTML5 validation is fully suppressed
 * (noValidate on the form + type="text" inputs) so every message below is
 * ours — no browser tooltips anywhere.
 */
export function AuthField({
  label,
  value,
  onChange,
  error,
  placeholder,
  optional,
  password,
  autoComplete,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder?: string;
  optional?: boolean;
  password?: boolean;
  autoComplete?: string;
  onBlur?: () => void;
}) {
  const id = useId();

  useEffect(() => {
    if (error) sfx.fieldError();
  }, [error]);

  return (
    <div className="mb-4">
      <label
        htmlFor={id}
        className="mb-2 flex items-baseline gap-2 font-mono text-[10px] tracking-[0.3em] text-mut"
      >
        {label}
        {optional ? <span className="text-[9px] opacity-70">OPTIONAL</span> : null}
      </label>
      <div
        className={cn(
          "flex h-13 items-center rounded-full px-6 transition-colors",
          error ? "bg-fg" : "bg-pan",
        )}
      >
        <input
          id={id}
          // type is always text/password — never email/number, so the browser
          // never renders its own validation bubble
          type={password ? "password" : "text"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => sfx.select()}
          onBlur={onBlur}
          data-sfx="none"
          placeholder={placeholder}
          autoComplete={autoComplete}
          spellCheck={false}
          autoCapitalize="off"
          className={cn(
            "w-full bg-transparent font-mono text-sm tracking-wider outline-none",
            error ? "text-bg placeholder:text-bg/50" : "text-fg placeholder:text-mut",
          )}
        />
      </div>
      {error ? (
        <p className="mt-2 flex animate-fade-in items-center gap-2 pl-5 font-mono text-[10px] tracking-[0.15em] text-fg">
          <AlertCircle className="size-3.5 shrink-0" />
          {error.toUpperCase()}
        </p>
      ) : null}
    </div>
  );
}

export function FormError({ message }: { message?: string }) {
  useEffect(() => {
    if (message) sfx.denied();
  }, [message]);

  if (!message) return null;
  return (
    <div className="mb-5 flex animate-pop-in items-center gap-3 rounded-full bg-fg px-6 py-3.5 text-bg">
      <AlertCircle className="size-4 shrink-0" />
      <p className="font-mono text-[11px] tracking-[0.15em]">{message.toUpperCase()}</p>
    </div>
  );
}

export function AuthShell({
  title,
  sub,
  children,
}: {
  title: string;
  sub: string;
  children: React.ReactNode;
}) {
  return (
    <main className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-14">
      <div className="mb-9">
        <p className="mb-3 font-mono text-[10px] tracking-[0.4em] text-mut">EXOTIC</p>
        <h1 className="animate-fade-up text-[clamp(2.6rem,10vw,4rem)] leading-none font-bold tracking-tight">
          {title}
        </h1>
        <p className="mt-3 animate-fade-up font-mono text-[11px] tracking-[0.2em] text-mut [animation-delay:80ms]">
          {sub}
        </p>
      </div>
      {children}
    </main>
  );
}
