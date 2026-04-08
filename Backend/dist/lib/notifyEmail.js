"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.queueNotifyUserByEmail = queueNotifyUserByEmail;
exports.queueNotifyUsersByRole = queueNotifyUsersByRole;
const User_1 = require("../models/User");
const mail_1 = require("./mail");
const appName = process.env.EMAIL_APP_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    "OSEN Contributor Hub";
function footer() {
    return `\n\n— ${appName}\nThis update also appears in your dashboard notifications.`;
}
/**
 * Email for a single user (by Mongo id). Fire-and-forget; does not block the HTTP response.
 * Skipped automatically when ENABLE_EMAIL_NOTIFICATIONS is false or SMTP is not configured.
 */
function queueNotifyUserByEmail(userId, title, message) {
    void (async () => {
        try {
            const u = await User_1.User.findById(userId).select("email").lean();
            const email = u?.email;
            if (!email)
                return;
            await (0, mail_1.sendMail)({
                to: email,
                subject: `[${appName}] ${title}`,
                text: `${message}${footer()}`,
            });
        }
        catch (e) {
            console.error("[notifyEmail] user", e);
        }
    })();
}
/** Notify every user with the given role (e.g. all admins). */
function queueNotifyUsersByRole(role, title, message) {
    void (async () => {
        try {
            const users = await User_1.User.find({ role }).select("email").lean();
            const text = `${message}${footer()}`;
            const subject = `[${appName}] ${title}`;
            for (const u of users) {
                if (!u.email)
                    continue;
                await (0, mail_1.sendMail)({ to: u.email, subject, text });
            }
        }
        catch (e) {
            console.error("[notifyEmail] role", role, e);
        }
    })();
}
