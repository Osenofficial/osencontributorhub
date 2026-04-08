"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.isEmailSendingEnabled = isEmailSendingEnabled;
exports.isMailSmtpConfigured = isMailSmtpConfigured;
exports.isResendConfigured = isResendConfigured;
exports.isOutboundMailConfigured = isOutboundMailConfigured;
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
/** SMTP credentials present (Nodemailer path). */
function isMailSmtpConfigured() {
    return Boolean(process.env.EMAIL_HOST?.trim() &&
        process.env.EMAIL_USER?.trim() &&
        process.env.EMAIL_PASSWORD?.trim() &&
        process.env.EMAIL_FROM?.trim());
}
/** Resend API key present (HTTPS :443 — works on Render free tier where SMTP ports are blocked). */
function isResendConfigured() {
    return Boolean(process.env.RESEND_API_KEY?.trim());
}
/** Either Resend or full SMTP — enough to attempt outbound mail. */
function isOutboundMailConfigured() {
    return isResendConfigured() || isMailSmtpConfigured();
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
async function sendViaResend(options) {
    const apiKey = process.env.RESEND_API_KEY.trim();
    const from = process.env.RESEND_FROM?.trim() || process.env.EMAIL_FROM?.trim();
    if (!from) {
        return { ok: false, error: "Set RESEND_FROM or EMAIL_FROM for Resend" };
    }
    const to = Array.isArray(options.to) ? options.to : [options.to];
    const body = {
        from,
        to,
        subject: options.subject,
    };
    if (options.html)
        body.html = options.html;
    if (options.text)
        body.text = options.text;
    if (!body.html && !body.text)
        body.text = "";
    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(body),
        });
        const raw = await res.text();
        if (!res.ok) {
            console.error("[mail] Resend failed:", res.status, raw);
            return { ok: false, error: `Resend ${res.status}: ${raw.slice(0, 300)}` };
        }
        let id = "resend";
        try {
            const json = JSON.parse(raw);
            if (json?.id)
                id = json.id;
        }
        catch {
            /* ignore */
        }
        return { ok: true, messageId: id };
    }
    catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error("[mail] Resend request failed:", msg);
        return { ok: false, error: msg };
    }
}
/**
 * Sends one email. Uses Resend (HTTPS) when RESEND_API_KEY is set — required on Render free tier
 * (outbound SMTP 25/465/587 is blocked). Otherwise uses Nodemailer SMTP.
 */
async function sendMail(options) {
    if (!isEmailSendingEnabled()) {
        return { ok: false, skipped: true, reason: "disabled" };
    }
    if (isResendConfigured()) {
        return sendViaResend(options);
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
/** Log once at startup so you know if outbound mail is ready. */
function logMailStartupStatus() {
    const sending = isEmailSendingEnabled();
    const configured = isOutboundMailConfigured();
    if (!configured) {
        console.log("[mail] Outbound not configured — set RESEND_API_KEY (+ RESEND_FROM or EMAIL_FROM), or full SMTP (EMAIL_HOST, EMAIL_USER, EMAIL_PASSWORD, EMAIL_FROM)");
        return;
    }
    if (!sending) {
        console.log("[mail] Outbound configured; sending disabled (set ENABLE_EMAIL_NOTIFICATIONS=true to send)");
        return;
    }
    if (isResendConfigured()) {
        console.log("[mail] Resend API configured; outbound email enabled (HTTPS — OK on Render free tier)");
        return;
    }
    console.log("[mail] SMTP configured; outbound email enabled");
}
