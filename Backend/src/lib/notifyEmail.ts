import type { UserRole } from "../models/User";
import { User } from "../models/User";
import { buildNotificationEmail, getEmailAppName } from "./emailTemplate";
import { sendMail, type SendMailResult } from "./mail";

/**
 * Email for a single user (by Mongo id). Fire-and-forget; does not block the HTTP response.
 * Skipped automatically when ENABLE_EMAIL_NOTIFICATIONS is false or Resend is not configured.
 */
export function queueNotifyUserByEmail(userId: unknown, title: string, message: string): void {
  void sendNotificationEmailToUserId(userId, title, message).catch((e) => {
    console.error("[notifyEmail] user", e);
  });
}

/** Awaited delivery — use for bulk sends (announcements) where you need a delivery report. */
export async function sendNotificationEmailToAddress(
  to: string,
  title: string,
  message: string,
): Promise<SendMailResult> {
  const appName = getEmailAppName();
  const { html, text } = buildNotificationEmail({ title, message });
  return sendMail({
    to,
    subject: `[${appName}] ${title}`,
    text,
    html,
  });
}

export async function sendNotificationEmailToUserId(
  userId: unknown,
  title: string,
  message: string,
): Promise<SendMailResult | { ok: false; skipped: true; reason: "no_email" }> {
  const u = await User.findById(userId).select("email").lean<{ email?: string } | null>();
  const email = u?.email?.trim();
  if (!email) return { ok: false, skipped: true, reason: "no_email" };
  return sendNotificationEmailToAddress(email, title, message);
}

/** Notify every user with the given role (e.g. all admins). */
export function queueNotifyUsersByRole(role: UserRole, title: string, message: string): void {
  void (async () => {
    try {
      const users = await User.find({ role }).select("email").lean<Array<{ email?: string }>>();
      const appName = getEmailAppName();
      const { html, text } = buildNotificationEmail({ title, message });
      const subject = `[${appName}] ${title}`;
      for (const u of users) {
        if (!u.email) continue;
        await sendMail({ to: u.email, subject, text, html });
      }
    } catch (e) {
      console.error("[notifyEmail] role", role, e);
    }
  })();
}
