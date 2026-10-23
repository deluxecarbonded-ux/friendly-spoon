"use client";

import { Ghost, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AuthField, AuthShell, FormError } from "@/components/auth-field";
import { PillButton } from "@/components/pill-button";
import { useApp } from "@/components/providers";
import { auth } from "@/lib/client-api";
import { sfx } from "@/game/audio";
import {
  checkDisplayName,
  checkEmail,
  checkPassword,
  checkUsername,
  validateGuestSignUp,
  validateSignUp,
} from "@/lib/validation";

type Errors = Partial<Record<"email" | "displayName" | "username" | "password" | "form", string>>;
type GuestErrors = Partial<Record<"username" | "displayName" | "form", string>>;

export default function SignUpPage() {
  const router = useRouter();
  const { refresh, hasGuest } = useApp();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [busy, setBusy] = useState(false);
  const [guestOpen, setGuestOpen] = useState(false);
  const [guestUsername, setGuestUsername] = useState("");
  const [guestDisplayName, setGuestDisplayName] = useState("");
  const [guestErrors, setGuestErrors] = useState<GuestErrors>({});

  const field = (k: keyof Errors, msg: string | null) =>
    setErrors((e) => ({ ...e, [k]: msg ?? undefined }));

  const guestField = (k: keyof GuestErrors, msg: string | null) =>
    setGuestErrors((e) => ({ ...e, [k]: msg ?? undefined }));

  const submit = async () => {
    const found = validateSignUp({ email, displayName, username, password }) as Errors;
    setErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      const res = await auth("signup", { email, displayName, username, password });
      await refresh();
      sfx.success();
      setErrors({});
      router.push("/verify-sent");
    } catch (e) {
      const err = e as Error & { errors?: Record<string, string> };
      setErrors(err.errors ?? { form: err.message });
    } finally {
      setBusy(false);
    }
  };

  const createGuest = async () => {
    const found = validateGuestSignUp({
      username: guestUsername,
      displayName: guestDisplayName,
    }) as GuestErrors;
    setGuestErrors(found);
    if (Object.keys(found).length) return;

    setBusy(true);
    try {
      await auth("guest-signup", {
        username: guestUsername,
        displayName: guestDisplayName,
      });
      await refresh();
      sfx.success();
      router.push("/");
      router.refresh();
    } catch (e) {
      const err = e as Error & { errors?: Record<string, string> };
      setGuestErrors(err.errors ?? { form: err.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell title="SIGN UP" sub="CREATE AN ACCOUNT. THE GAME WILL REMEMBER EVERYTHING.">
      <FormError message={errors.form} />

      {/* noValidate kills all native browser validation UI */}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <AuthField
          label="EMAIL"
          value={email}
          onChange={setEmail}
          onBlur={() => field("email", email ? checkEmail(email) : null)}
          error={errors.email}
          placeholder="you@example.com"
          autoComplete="email"
        />
        <AuthField
          label="DISPLAY NAME"
          optional
          value={displayName}
          onChange={setDisplayName}
          onBlur={() => field("displayName", checkDisplayName(displayName))}
          error={errors.displayName}
          placeholder="Shown on leaderboards"
          autoComplete="nickname"
        />
        <AuthField
          label="USERNAME"
          value={username}
          onChange={setUsername}
          onBlur={() => field("username", username ? checkUsername(username) : null)}
          error={errors.username}
          placeholder="letters, numbers, underscores"
          autoComplete="username"
        />
        <AuthField
          label="PASSWORD"
          password
          value={password}
          onChange={setPassword}
          onBlur={() => field("password", password ? checkPassword(password) : null)}
          error={errors.password}
          placeholder="letters + numbers + symbols"
          autoComplete="new-password"
        />

        <PillButton
          type="submit"
          size="lg"
          className="mt-2 w-full"
          disabled={busy}
          icon={<UserPlus className="size-4" />}
        >
          {busy ? "Creating…" : "Create Account"}
        </PillButton>
      </form>

      <div className="my-7 flex items-center gap-4">
        <span className="h-px flex-1 bg-pan2" />
        <span className="font-mono text-[10px] tracking-[0.3em] text-mut">OR</span>
        <span className="h-px flex-1 bg-pan2" />
      </div>

      {hasGuest ? (
        <>
          <PillButton
            variant="soft"
            size="lg"
            className="w-full"
            disabled
            icon={<Ghost className="size-4" />}
          >
            Guest Already Exists
          </PillButton>
          <p className="mt-3 px-5 font-mono text-[10px] leading-relaxed tracking-[0.15em] text-mut">
            A GUEST ACCOUNT ALREADY EXISTS HERE. DELETE IT IN SETTINGS TO MAKE A NEW ONE.
          </p>
        </>
      ) : !guestOpen ? (
        <>
          <PillButton
            variant="soft"
            size="lg"
            className="w-full"
            sound="open"
            onClick={() => setGuestOpen(true)}
            disabled={busy}
            icon={<Ghost className="size-4" />}
          >
            Sign Up As Guest
          </PillButton>
          <p className="mt-3 px-5 font-mono text-[10px] leading-relaxed tracking-[0.15em] text-mut">
            GUESTS PLAY EVERYTHING, BUT ACHIEVEMENTS AND LEADERBOARDS STAY LOCKED.
          </p>
        </>
      ) : (
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void createGuest();
          }}
        >
          <FormError message={guestErrors.form} />
          <p className="mb-4 px-5 font-mono text-[10px] leading-relaxed tracking-[0.15em] text-mut">
            PICK A USERNAME AND DISPLAY NAME FOR YOUR GUEST RUN.
          </p>
          <AuthField
            label="USERNAME"
            value={guestUsername}
            onChange={setGuestUsername}
            onBlur={() =>
              guestField("username", guestUsername ? checkUsername(guestUsername) : null)
            }
            error={guestErrors.username}
            placeholder="letters, numbers, underscores"
            autoComplete="username"
          />
          <AuthField
            label="DISPLAY NAME"
            optional
            value={guestDisplayName}
            onChange={setGuestDisplayName}
            onBlur={() => guestField("displayName", checkDisplayName(guestDisplayName))}
            error={guestErrors.displayName}
            placeholder="Shown in game"
            autoComplete="nickname"
          />

          <PillButton
            type="submit"
            size="lg"
            className="mt-2 w-full"
            disabled={busy}
            icon={<Ghost className="size-4" />}
          >
            {busy ? "Creating…" : "Create Guest Account"}
          </PillButton>
          <PillButton
            variant="ghost"
            size="sm"
            className="mt-2 w-full"
            sound="close"
            onClick={() => {
              setGuestOpen(false);
              setGuestErrors({});
            }}
            disabled={busy}
          >
            Cancel
          </PillButton>
        </form>
      )}

      <p className="mt-9 text-center font-mono text-[11px] tracking-[0.2em] text-mut">
        ALREADY SUFFERING?{" "}
        <Link href="/signin" className="focus-ring font-bold text-fg underline-offset-4 hover:underline">
          SIGN IN
        </Link>
      </p>
    </AuthShell>
  );
}
