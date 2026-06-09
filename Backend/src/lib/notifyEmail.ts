import type { UserRole } from "../models/User";
import { User } from "../models/User";
import { buildNotificationEmail, getEmailAppName } from "./emailTemplate";
import { sendMail } from "./mail";

/**
 * Email for a single user (by Mongo id). Fire-and-forget; does not block the HTTP response.
 * Skipped automatically when ENABLE_EMAIL_NOTIFICATIONS is false or Resend is not configured.
 */
export function queueNotifyUserByEmail(userId: unknown, title: string, message: string): void {
  void (async () => {
    try {
      const u = await User.findById(userId).select("email").lean<{ email?: string } | null>();
      const email = u?.email;
      if (!email) return;
      const appName = getEmailAppName();
      const { html, text } = buildNotificationEmail({ title, message });
      await sendMail({
        to: email,
        subject: `[${appName}] ${title}`,
        text,
        html,
      });
    } catch (e) {
      console.error("[notifyEmail] user", e);
    }
  })();
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
