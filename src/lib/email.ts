import { Resend } from "resend";

const fromEmail = process.env.RESEND_FROM_EMAIL ?? "Exotic <Exotic@DevilExotix.com>";

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error("RESEND_API_KEY is required");
  _resend = new Resend(apiKey);
  return _resend;
}

export const FROM_EMAIL = fromEmail;

async function sendEmail(to: string, subject: string, html: string) {
  const resend = getResend();
  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to,
    subject,
    html,
  });

  if (error) {
    console.error("[resend] email failed:", error);
    throw new Error("email failed");
  }
  return data;
}

export async function sendWelcomeEmail(to: string, username: string) {
  return sendEmail(
    to,
    "Welcome to EXOTIC",
    `
      <div style="font-family:monospace;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e5e5e5;border:1px solid #1f1f1f;">
        <h1 style="font-size:20px;letter-spacing:2px;margin:0 0 16px;">EXOTIC</h1>
        <p style="margin:0 0 12px;line-height:1.5;">
          Welcome aboard, <strong>${username}</strong>. The floor has opinions.
        </p>
        <p style="margin:0 0 12px;line-height:1.5;">
          Your account is ready. Dive in, die a lot, improve. That's the loop.
        </p>
        <p style="margin:0;color:#666;font-size:12px;">
          If you did not sign up for EXOTIC, you can ignore this email.
        </p>
      </div>
    `,
  );
}

export async function sendVerificationEmail(to: string, username: string, verifyUrl: string) {
  return sendEmail(
    to,
    "Verify your email — EXOTIC",
    `
      <div style="font-family:monospace;max-width:480px;margin:0 auto;padding:24px;background:#0a0a0a;color:#e5e5e5;border:1px solid #1f1f1f;">
        <h1 style="font-size:20px;letter-spacing:2px;margin:0 0 16px;">EXOTIC</h1>
        <p style="margin:0 0 12px;line-height:1.5;">
          Hi <strong>${username}</strong>, confirm your email to activate your account.
        </p>
        <p style="margin:0 0 16px;">
          <a href="${verifyUrl}" style="display:inline-block;padding:12px 24px;background:#e5e5e5;color:#0a0a0a;text-decoration:none;font-weight:bold;letter-spacing:1px;">
            VERIFY EMAIL
          </a>
        </p>
        <p style="margin:0;color:#666;font-size:12px;">
          This link expires in 72 hours. If you did not sign up for EXOTIC, ignore this email.
        </p>
      </div>
    `,
  );
}