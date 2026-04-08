import dns from "node:dns";
import nodemailer from "nodemailer";

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

export function isMailSmtpConfigured(): boolean {
  return Boolean(
    process.env.EMAIL_HOST?.trim() &&
      process.env.EMAIL_USER?.trim() &&
      process.env.EMAIL_PASSWORD?.trim() &&
      process.env.EMAIL_FROM?.trim(),
  );
}

let transporter: nodemailer.Transporter | null = null;

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
      // Custom lookup: nodemailer may ignore `family`; Gmail AAAA → ENETUNREACH on Render.
      // tls.servername: after resolve to IPv4, SNI must still use the mail hostname for the cert.
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
 * Sends one email via SMTP. Respects ENABLE_EMAIL_NOTIFICATIONS and EMAIL_* in .env.
 * Safe to call from routes: failures return { ok: false } instead of throwing.
 */
export async function sendMail(options: SendMailOptions): Promise<SendMailResult> {
  if (!isEmailSendingEnabled()) {
    return { ok: false, skipped: true, reason: "disabled" };
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
    console.error("[mail] send failed:", msg);
    return { ok: false, error: msg };
  }
}

/** Log once at startup so you know if SMTP is ready. */
export function logMailStartupStatus(): void {
  const sending = isEmailSendingEnabled();
  const configured = isMailSmtpConfigured();
  if (!configured) {
    console.log("[mail] SMTP not configured (set EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM)");
    return;
  }
  if (!sending) {
    console.log("[mail] SMTP configured; sending disabled (set ENABLE_EMAIL_NOTIFICATIONS=true to send)");
    return;
  }
  console.log("[mail] SMTP configured; outbound email enabled");
}
