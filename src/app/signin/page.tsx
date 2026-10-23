"use client";

import { Ghost, LogIn } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField, AuthShell, FormError } from "@/components/auth-field";
import { PillButton } from "@/components/pill-button";
import { useApp } from "@/components/providers";
import { auth } from "@/lib/client-api";
import { sfx } from "@/game/audio";
import { checkUsernameForLogin, validateSignIn } from "@/lib/validation";

type Errors = Partial<Record<"username" | "password" | "form", string>>;

export default function SignInPage() {
  const router = useRouter();
  const { refresh, hasGuest } = useApp();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);

  const go = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await refresh();
      sfx.success();
      router.push("/");
      router.refresh();
    } catch (e) {
      const err = e as Error & { errors?: Record<string, string> };
      setErrors(err.errors ?? { form: err.message });
    } finally {
      setBusy(false);
    }
  };

  const submit = () => {
    const found = validateSignIn({ username, password }) as Errors;
    setErrors(found);
    if (Object.keys(found).length) return;
    void go(() => auth("signin", { username, password }));
  };

  return (
    <AuthShell title="SIGN IN" sub="USERNAMES ARE EXACTLY AS YOU REGISTERED THEM.">
      <FormError message={errors.form} />

      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <AuthField
          label="USERNAME"
          value={username}
          onChange={setUsername}
          onBlur={() =>
            setErrors((x) => ({
              ...x,
              username: username ? (checkUsernameForLogin(username) ?? undefined) : undefined,
            }))
          }
          error={errors.username}
          placeholder="case-sensitive"
          autoComplete="username"
        />
        <AuthField
          label="PASSWORD"
          password
          value={password}
          onChange={setPassword}
          error={errors.password}
          placeholder="your password"
          autoComplete="current-password"
        />

        <PillButton
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={busy}
          icon={<LogIn className="size-4" />}
        >
          {busy ? "Checking…" : "Sign In"}
        </PillButton>
      </form>

      <div className="my-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-pan2" />
        <span className="font-mono text-[10px] tracking-[0.3em] text-mut">OR</span>
        <span className="h-px flex-1 bg-pan2" />
      </div>

      <PillButton
        variant="soft"
        size="lg"
        className="w-full"
        onClick={() => void go(() => auth("guest-signin"))}
        disabled={busy || !hasGuest}
        icon={<Ghost className="size-4" />}
      >
        {hasGuest ? "Sign In As Guest" : "No Guest Account"}
      </PillButton>
      <p className="mt-3 px-5 font-mono text-[10px] leading-relaxed tracking-[0.15em] text-mut">
        {hasGuest
          ? "RESUME YOUR GUEST RUN. ACHIEVEMENTS AND LEADERBOARDS REMAIN LOCKED."
          : "NO GUEST ACCOUNT ON THIS DEVICE YET — CREATE ONE FROM SIGN UP."}
      </p>

      <p className="mt-9 text-center font-mono text-[11px] tracking-[0.2em] text-mut">
        NEW HERE?{" "}
        <Link href="/signup" className="focus-ring font-bold text-fg underline-offset-4 hover:underline">
          SIGN UP
        </Link>
      </p>
    </AuthShell>
  );
}
