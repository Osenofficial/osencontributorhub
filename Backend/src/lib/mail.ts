import { Resend, type CreateEmailOptions } from "resend";

/** When truthy, outbound email is sent. When false, sendMail no-ops (in-app flows still work). */
export function isEmailSendingEnabled(): boolean {
  const v = String(process.env.ENABLE_EMAIL_NOTIFICATIONS || "")
    .trim()
    .toLowerCase();
  return v === "true" || v === "1" || v === "yes" || v === "on";
}

/** Resend: API key + verified sender (see https://resend.com/domains). */
export function isResendConfigured(): boolean {
  const key = String(process.env.RESEND_API_KEY || "").trim();
  const from = getResendFromAddress();
  return Boolean(key && from);
}

function getResendFromAddress(): string {
  return String(process.env.RESEND_FROM || process.env.EMAIL_FROM || "").trim();
}

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!isResendConfigured()) return null;
  if (!resendClient) {
    resendClient = new Resend(String(process.env.RESEND_API_KEY).trim());
  }
  return resendClient;
}

export type SendMailOptions = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  replyTo?: string;
};

export type SendMailResult =
  | { ok: true; messageId: string }
  | { ok: false; skipped: true; reason: "disabled" | "not_configured" }
  | { ok: false; error: string };

/**
 * Sends one email via Resend.
 * Respects ENABLE_EMAIL_NOTIFICATIONS. Safe to call from routes: failures return { ok: false } instead of throwing.
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  if (!isEmailSendingEnabled()) {
    return { ok: false, skipped: true, reason: "disabled" };
  }

  const resend = getResend();
  if (!resend) {
    return { ok: false, skipped: true, reason: "not_configured" };
  }

  const from = getResendFromAddress();
  const replyToRaw = (options.replyTo ?? process.env.EMAIL_REPLY_TO)?.trim();
  const replyTo = replyToRaw
    ? replyToRaw.includes(",")
      ? replyToRaw.split(",").map((s) => s.trim())
      : replyToRaw
    : undefined;
  const hasHtml = Boolean(options.html && String(options.html).length > 0);
  const hasText = options.text !== undefined && String(options.text).length > 0;
  const payload = {
    from,
    to: options.to,
    subject: options.subject,
    ...(replyTo ? { replyTo } : {}),
    ...(hasHtml ? { html: options.html as string } : {}),
    ...(hasText ? { text: options.text as string } : {}),
    ...(!hasHtml && !hasText ? { text: "" } : {}),
  };
  try {
    const { data, error } = await resend.emails.send(payload as CreateEmailOptions);
    if (error) {
      const msg = error.message || String(error);
      console.error("[mail] Resend send failed:", msg);
      return { ok: false, error: msg };
    }
    const messageId = data?.id ? String(data.id) : "";
    return { ok: true, messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mail] Resend send failed:", msg);
    return { ok: false, error: msg };
  }
}

/** Log once at startup so you know if outbound email is ready. */
export function logMailStartupStatus(): void {
  const sending = isEmailSendingEnabled();
  const resendOk = isResendConfigured();
  if (!resendOk) {
    console.log("[mail] Email not configured: set RESEND_API_KEY + RESEND_FROM (or EMAIL_FROM)");
    return;
  }
  if (!sending) {
    console.log("[mail] Resend configured; sending disabled (set ENABLE_EMAIL_NOTIFICATIONS=true to send)");
    return;
  }
  console.log("[mail] Resend configured; outbound email enabled");
}
