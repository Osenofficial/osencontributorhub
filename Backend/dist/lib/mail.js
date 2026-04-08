"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailSendingEnabled = isEmailSendingEnabled;
exports.isMailSmtpConfigured = isMailSmtpConfigured;
exports.sendMail = sendMail;
exports.logMailStartupStatus = logMailStartupStatus;
const node_dns_1 = __importDefault(require("node:dns"));
const nodemailer_1 = __importDefault(require("nodemailer"));
// Run as soon as this module loads (before first SMTP connection). Render often has no IPv6 egress.
if (typeof node_dns_1.default.setDefaultResultOrder === "function") {
    node_dns_1.default.setDefaultResultOrder("ipv4first");
}
/** Force A-record / IPv4 only — avoids ENETUNREACH to Gmail AAAA from cloud hosts. */
function smtpLookupIpv4(hostname, _options, callback) {
    node_dns_1.default.lookup(hostname, { family: 4, all: false }, callback);
}
/** When truthy, outbound email is sent. When false, sendMail no-ops (in-app flows still work). */
function isEmailSendingEnabled() {
    const v = String(process.env.ENABLE_EMAIL_NOTIFICATIONS || "")
        .trim()
        .toLowerCase();
    return v === "true" || v === "1" || v === "yes" || v === "on";
}
function isMailSmtpConfigured() {
    return Boolean(process.env.EMAIL_HOST?.trim() &&
        process.env.EMAIL_USER?.trim() &&
        process.env.EMAIL_PASSWORD?.trim() &&
        process.env.EMAIL_FROM?.trim());
}
let transporter = null;
function getTransporter() {
    if (!isMailSmtpConfigured())
        return null;
    if (!transporter) {
        const port = Number(process.env.EMAIL_PORT || 587);
        const secure = String(process.env.EMAIL_SECURE || "").toLowerCase() === "true";
        const requireTLS = String(process.env.EMAIL_REQUIRE_TLS || "").toLowerCase() === "true";
        const useIpv6 = String(process.env.EMAIL_SMTP_FAMILY || "4").trim() === "6";
        const smtpHost = process.env.EMAIL_HOST.trim();
        transporter = nodemailer_1.default.createTransport({
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
/**
 * Sends one email via SMTP. Respects ENABLE_EMAIL_NOTIFICATIONS and EMAIL_* in .env.
 * Safe to call from routes: failures return { ok: false } instead of throwing.
 */
async function sendMail(options) {
    if (!isEmailSendingEnabled()) {
        return { ok: false, skipped: true, reason: "disabled" };
    }
    const transport = getTransporter();
    if (!transport) {
        return { ok: false, skipped: true, reason: "not_configured" };
    }
    const from = process.env.EMAIL_FROM.trim();
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
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[mail] send failed:", msg);
        return { ok: false, error: msg };
    }
}
/** Log once at startup so you know if SMTP is ready. */
function logMailStartupStatus() {
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
