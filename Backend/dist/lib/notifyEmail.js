"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueNotifyUserByEmail = queueNotifyUserByEmail;
exports.sendNotificationEmailToAddress = sendNotificationEmailToAddress;
exports.sendNotificationEmailToUserId = sendNotificationEmailToUserId;
exports.queueNotifyUsersByRole = queueNotifyUsersByRole;
const User_1 = require("../models/User");
const emailTemplate_1 = require("./emailTemplate");
const mail_1 = require("./mail");
/**
 * Email for a single user (by Mongo id). Fire-and-forget; does not block the HTTP response.
 * Skipped automatically when ENABLE_EMAIL_NOTIFICATIONS is false or Resend is not configured.
 */
function queueNotifyUserByEmail(userId, title, message, taskId) {
    void sendNotificationEmailToUserId(userId, title, message, taskId).catch((e) => {
        console.error("[notifyEmail] user", e);
    });
}
/** Awaited delivery — use for bulk sends (announcements) where you need a delivery report. */
async function sendNotificationEmailToAddress(to, title, message, taskId) {
    const appName = (0, emailTemplate_1.getEmailAppName)();
    const { html, text } = (0, emailTemplate_1.buildNotificationEmail)({ title, message, taskId });
    return (0, mail_1.sendMail)({
        to,
        subject: `[${appName}] ${title}`,
        text,
        html,
    });
}
async function sendNotificationEmailToUserId(userId, title, message, taskId) {
    const u = await User_1.User.findById(userId).select("email").lean();
    const email = u?.email?.trim();
    if (!email)
        return { ok: false, skipped: true, reason: "no_email" };
    return sendNotificationEmailToAddress(email, title, message, taskId);
}
/** Notify every user with the given role (e.g. all admins). */
function queueNotifyUsersByRole(role, title, message) {
    void (async () => {
        try {
            const users = await User_1.User.find({ role }).select("email").lean();
            const appName = (0, emailTemplate_1.getEmailAppName)();
            const { html, text } = (0, emailTemplate_1.buildNotificationEmail)({ title, message });
            const subject = `[${appName}] ${title}`;
            for (const u of users) {
                if (!u.email)
                    continue;
                await (0, mail_1.sendMail)({ to: u.email, subject, text, html });
            }
        }
        catch (e) {
            console.error("[notifyEmail] role", role, e);
        }
    })();
}
