import dns from "node:dns";
import nodemailer from "nodemailer";
import { Resend, type CreateEmailOptions } from "resend";

// Run as soon as this module loads (before first SMTP connection). Render often has no IPv6 egress.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}

/** Force A-record / IPv4 only — avoids ENETUNREACH to Gmail AAAA from cloud hosts. */
function smtpLookupIpv4(
  hostname: string,
  _options: unknown,
  callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void,
): void {
  dns.lookup(hostname, { family: 4, all: false }, callback);
}

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

export function isMailSmtpConfigured(): boolean {
  return Boolean(
    process.env.EMAIL_HOST?.trim() &&
      process.env.EMAIL_USER?.trim() &&
      process.env.EMAIL_PASSWORD?.trim() &&
      process.env.EMAIL_FROM?.trim(),
  );
}

let transporter: nodemailer.Transporter | null = null;
let resendClient: Resend | null = null;

function getResend(): Resend | null {
  if (!isResendConfigured()) return null;
  if (!resendClient) {
    resendClient = new Resend(String(process.env.RESEND_API_KEY).trim());
  }
  return resendClient;
}

function getTransporter(): nodemailer.Transporter | null {
  if (!isMailSmtpConfigured()) return null;
  if (!transporter) {
    const port = Number(process.env.EMAIL_PORT || 587);
    const secure = String(process.env.EMAIL_SECURE || "").toLowerCase() === "true";
    const requireTLS = String(process.env.EMAIL_REQUIRE_TLS || "").toLowerCase() === "true";
    const useIpv6 = String(process.env.EMAIL_SMTP_FAMILY || "4").trim() === "6";
    const smtpHost = process.env.EMAIL_HOST!.trim();
    transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number.isFinite(port) ? port : 587,
      secure,
      requireTLS: requireTLS || undefined,
      ...(!useIpv6
        ? {
            lookup: smtpLookupIpv4,
            tls: { servername: smtpHost },
          }
        : {}),
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
  return transporter;
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
 * Sends one email. Prefers Resend when `RESEND_API_KEY` is set; otherwise SMTP (`EMAIL_*`).
 * Respects ENABLE_EMAIL_NOTIFICATIONS. Safe to call from routes: failures return { ok: false } instead of throwing.
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  if (!isEmailSendingEnabled()) {
    return { ok: false, skipped: true, reason: "disabled" };
  }

  const resend = getResend();
  if (resend) {
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

  const transport = getTransporter();
  if (!transport) {
    return { ok: false, skipped: true, reason: "not_configured" };
  }
  const from = process.env.EMAIL_FROM!.trim();
  const replyTo = (options.replyTo ?? process.env.EMAIL_REPLY_TO)?.trim();
  try {
    const info = await transport.sendMail({
      from,
      to: options.to,
      subject: options.subject,
      text: options.text,
      html: options.html,
      ...(replyTo ? { replyTo } : {}),
    });
    const messageId = typeof info.messageId === "string" ? info.messageId : String(info.messageId ?? "");
    return { ok: true, messageId };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[mail] SMTP send failed:", msg);
    return { ok: false, error: msg };
  }
}

/** Log once at startup so you know if outbound email is ready. */
export function logMailStartupStatus(): void {
  const sending = isEmailSendingEnabled();
  const resendOk = isResendConfigured();
  const smtpOk = isMailSmtpConfigured();
  if (!resendOk && !smtpOk) {
    console.log(
      "[mail] Email not configured: set RESEND_API_KEY + RESEND_FROM (or EMAIL_FROM), or set EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM",
    );
    return;
  }
  if (!sending) {
    console.log("[mail] Email provider ready; sending disabled (set ENABLE_EMAIL_NOTIFICATIONS=true to send)");
    return;
  }
  if (resendOk) {
    console.log("[mail] Resend configured; outbound email enabled");
    return;
  }
  console.log("[mail] SMTP configured; outbound email enabled");
}
