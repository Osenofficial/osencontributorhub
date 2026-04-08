import type { UserRole } from "../models/User";
import { User } from "../models/User";
import { sendMail } from "./mail";

const appName =
  process.env.EMAIL_APP_NAME?.trim() ||
  process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
  "OSEN Contributor Hub";

function footer(): string {
  return `\n\n— ${appName}\nThis update also appears in your dashboard notifications.`;
}

/**
 * Email for a single user (by Mongo id). Fire-and-forget; does not block the HTTP response.
 * Skipped automatically when ENABLE_EMAIL_NOTIFICATIONS is false or SMTP is not configured.
 */
export function queueNotifyUserByEmail(userId: unknown, title: string, message: string): void {
  void (async () => {
    try {
      const u = await User.findById(userId).select("email").lean<{ email?: string } | null>();
      const email = u?.email;
      if (!email) return;
      await sendMail({
        to: email,
        subject: `[${appName}] ${title}`,
        text: `${message}${footer()}`,
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
      const text = `${message}${footer()}`;
      const subject = `[${appName}] ${title}`;
      for (const u of users) {
        if (!u.email) continue;
        await sendMail({ to: u.email, subject, text });
      }
    } catch (e) {
      console.error("[notifyEmail] role", role, e);
    }
  })();
}
