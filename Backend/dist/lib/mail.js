"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailSendingEnabled = isEmailSendingEnabled;
exports.isMailSmtpConfigured = isMailSmtpConfigured;
exports.sendMail = sendMail;
exports.logMailStartupStatus = logMailStartupStatus;
const nodemailer_1 = __importDefault(require("nodemailer"));
/** When true, outbound email is sent. When false, sendMail no-ops (in-app flows still work). */
function isEmailSendingEnabled() {
    return String(process.env.ENABLE_EMAIL_NOTIFICATIONS || "").toLowerCase() === "true";
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
        transporter = nodemailer_1.default.createTransport({
            host: process.env.EMAIL_HOST,
            port: Number.isFinite(port) ? port : 587,
            secure,
            requireTLS: requireTLS || undefined,
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
