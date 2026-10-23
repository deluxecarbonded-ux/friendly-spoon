// Shared validation rules + the exact user-facing messages. Used by the
// custom (non-native) form validation in the browser AND re-checked on the
// server, so the rules can never be bypassed by disabling JS.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;
export const PASSWORD_MIN = 8;

export const MSG = {
  fillAll: "Fill all fields",
  usernameRules: `Username requires ${USERNAME_MIN}–${USERNAME_MAX} characters (letters, numbers, underscores)`,
  usernameTaken: "Username is taken",
  usernameInvalid: "Invalid username",
  usernameNotRegistered: "Username not registered",
  emailInvalid: "Email is invalid",
  emailTaken: "Email is taken",
  passwordRules: "Password requires letters, numbers and symbols only",
  passwordShort: `Password must be at least ${PASSWORD_MIN} characters`,
  passwordIncorrect: "Incorrect password",
  displayNameLong: "Display name must be 20 characters or fewer",
  guestExists: "You already have a guest account. Delete it in Settings first.",
  guestNone: "No guest account found on this device. Create one from Sign Up.",
} as const;

const USERNAME_RE = /^[A-Za-z0-9_]+$/;
// letters, numbers, underscores and symbols only — no spaces, no control chars
const PASSWORD_ALLOWED_RE = /^[A-Za-z0-9_!@#$%^&*()\-+=[\]{};:'",.<>/?\\|`~]+$/;
const HAS_LETTER = /[A-Za-z]/;
const HAS_NUMBER = /[0-9]/;
const HAS_SYMBOL = /[!@#$%^&*()\-+=[\]{};:'",.<>/?\\|`~_]/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;

/** Username format. Returns an error message or null when valid. */
export function checkUsername(raw: string): string | null {
  const v = raw.trim();
  if (!v) return MSG.fillAll;
  if (v.length < USERNAME_MIN || v.length > USERNAME_MAX || !USERNAME_RE.test(v)) {
    return MSG.usernameRules;
  }
  return null;
}

/** Username format for sign-in (wording differs per spec). */
export function checkUsernameForLogin(raw: string): string | null {
  const v = raw.trim();
  if (!v) return MSG.fillAll;
  if (v.length < USERNAME_MIN || v.length > USERNAME_MAX || !USERNAME_RE.test(v)) {
    return MSG.usernameInvalid;
  }
  return null;
}

export function checkEmail(raw: string): string | null {
  const v = raw.trim();
  if (!v) return MSG.fillAll;
  if (!EMAIL_RE.test(v) || v.length > 254) return MSG.emailInvalid;
  return null;
}

export function checkPassword(raw: string): string | null {
  if (!raw) return MSG.fillAll;
  if (!PASSWORD_ALLOWED_RE.test(raw)) return MSG.passwordRules;
  if (raw.length < PASSWORD_MIN) return MSG.passwordShort;
  if (!HAS_LETTER.test(raw) || !HAS_NUMBER.test(raw) || !HAS_SYMBOL.test(raw)) {
    return MSG.passwordRules;
  }
  return null;
}

export function checkDisplayName(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null; // optional
  if (v.length > 20) return MSG.displayNameLong;
  return null;
}

export interface SignUpInput {
  email: string;
  displayName: string;
  username: string;
  password: string;
}

export function validateSignUp(i: SignUpInput): Partial<Record<keyof SignUpInput, string>> {
  const errors: Partial<Record<keyof SignUpInput, string>> = {};
  if (!i.email.trim() || !i.username.trim() || !i.password) {
    if (!i.email.trim()) errors.email = MSG.fillAll;
    if (!i.username.trim()) errors.username = MSG.fillAll;
    if (!i.password) errors.password = MSG.fillAll;
  }
  const e = checkEmail(i.email);
  if (e && !errors.email) errors.email = e;
  const u = checkUsername(i.username);
  if (u && !errors.username) errors.username = u;
  const p = checkPassword(i.password);
  if (p && !errors.password) errors.password = p;
  const d = checkDisplayName(i.displayName);
  if (d) errors.displayName = d;
  return errors;
}

export interface GuestSignUpInput {
  username: string;
  displayName: string;
}

export function validateGuestSignUp(
  i: GuestSignUpInput,
): Partial<Record<keyof GuestSignUpInput, string>> {
  const errors: Partial<Record<keyof GuestSignUpInput, string>> = {};
  const u = checkUsername(i.username);
  if (u) errors.username = u;
  const d = checkDisplayName(i.displayName);
  if (d) errors.displayName = d;
  return errors;
}

export function validateSignIn(i: { username: string; password: string }) {
  const errors: { username?: string; password?: string } = {};
  if (!i.username.trim()) errors.username = MSG.fillAll;
  else {
    const u = checkUsernameForLogin(i.username);
    if (u) errors.username = u;
  }
  if (!i.password) errors.password = MSG.fillAll;
  return errors;
}
