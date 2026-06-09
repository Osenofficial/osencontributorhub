export function getEmailAppName(): string {
  return (
    process.env.EMAIL_APP_NAME?.trim() ||
    process.env.NEXT_PUBLIC_APP_NAME?.trim() ||
    "OSEN Contributor Hub"
  );
}

export function getSiteUrl(): string {
  const raw =
    process.env.FRONTEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    process.env.SITE_URL?.trim() ||
    "http://localhost:3000";
  return raw.replace(/\/+$/, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatMessageHtml(message: string): string {
  return escapeHtml(message).replace(/\n/g, "<br />");
}

/** Pick the most useful dashboard page from the notification title. */
export function resolveDashboardPath(title: string): string {
  const t = title.toLowerCase();

  if (
    t.includes("signup pending") ||
    t.includes("lead action") ||
    t.includes("task submitted for review")
  ) {
    return "/dashboard/admin";
  }

  if (
    t.includes("reimbursement") ||
    t.includes("invoice") ||
    t.includes("payout")
  ) {
    if (
      t.includes("paid") ||
      t.includes("rejected by accounts") ||
      t.includes("approved by admin") ||
      t.includes("marked paid")
    ) {
      return "/dashboard/invoice-tracking";
    }
    return "/dashboard/invoices";
  }

  if (t.includes("account approved") || t.includes("re-activated")) {
    return "/login";
  }

  if (t.includes("announcement")) {
    return "/dashboard/notifications";
  }

  if (
    t.includes("task") ||
    t.includes("assignment") ||
    t.includes("submission") ||
    t.includes("comment on task")
  ) {
    return "/dashboard/all-tasks";
  }

  return "/dashboard/notifications";
}

export type NotificationEmailContent = {
  title: string;
  message: string;
};

export function buildNotificationEmail(content: NotificationEmailContent): {
  html: string;
  text: string;
} {
  const appName = getEmailAppName();
  const siteUrl = getSiteUrl();
  const path = resolveDashboardPath(content.title);
  const actionUrl = `${siteUrl}${path}`;
  const actionLabel =
    path === "/login"
      ? "Log in"
      : path === "/dashboard/admin"
        ? "Open admin panel"
        : path === "/dashboard/invoices"
          ? "Review in invoices hub"
          : path === "/dashboard/invoice-tracking"
            ? "View tracking"
            : path === "/dashboard/all-tasks"
              ? "View tasks"
              : "View in dashboard";

  const safeTitle = escapeHtml(content.title);
  const safeMessage = formatMessageHtml(content.message);
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#0f0f14;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#0f0f14;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background-color:#18181f;border:1px solid #2d2d3a;border-radius:16px;overflow:hidden;">
          <tr>
            <td style="padding:28px 28px 20px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);">
              <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.82);">${escapeHtml(appName)}</p>
              <h1 style="margin:0;font-size:22px;line-height:1.35;font-weight:700;color:#ffffff;">${safeTitle}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px;">
              <p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:#d4d4dc;">${safeMessage}</p>
              <table role="presentation" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="border-radius:10px;background:linear-gradient(135deg,#6366f1 0%,#8b5cf6 100%);">
                    <a href="${escapeHtml(actionUrl)}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:13px 22px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(actionLabel)} →</a>
                  </td>
                </tr>
              </table>
              <p style="margin:22px 0 0;font-size:12px;line-height:1.6;color:#8b8b99;">
                Or copy this link:<br />
                <a href="${escapeHtml(actionUrl)}" style="color:#a5b4fc;word-break:break-all;">${escapeHtml(actionUrl)}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:18px 28px 24px;border-top:1px solid #2d2d3a;background-color:#121218;">
              <p style="margin:0;font-size:12px;line-height:1.6;color:#71717a;">
                This update also appears in your dashboard notifications.
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#52525b;">
                © ${year} ${escapeHtml(appName)}
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${content.title}

${content.message}

${actionLabel}: ${actionUrl}

— ${appName}
This update also appears in your dashboard notifications.`;

  return { html, text };
}
