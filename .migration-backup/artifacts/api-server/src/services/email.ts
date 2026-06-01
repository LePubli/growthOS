/**
 * GrowthOS Email Service
 * Sends transactional & sequence emails via Resend.
 * The RESEND_API_KEY is injected automatically once the Resend integration is connected.
 */

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailOptions {
  to: string | string[];
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
  tags?: { name: string; value: string }[];
}

export interface SendEmailResult {
  id: string;
  success: boolean;
  error?: string;
}

async function getResendKey(): Promise<string | null> {
  // Check Replit connector secret first, then env var
  return process.env.RESEND_API_KEY || null;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  const key = await getResendKey();

  if (!key) {
    console.warn("[email] No RESEND_API_KEY — email not sent (configure Resend integration)");
    return { id: `mock_${Date.now()}`, success: false, error: "Resend API key not configured" };
  }

  const from = opts.from || process.env.EMAIL_FROM || "GrowthOS <noreply@growthos.fr>";

  try {
    const res = await fetch(RESEND_API_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: opts.to, subject: opts.subject, html: opts.html, reply_to: opts.replyTo, tags: opts.tags }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("[email] Resend error:", err);
      return { id: "", success: false, error: err };
    }

    const data = await res.json() as { id: string };
    console.log("[email] Sent:", data.id, "→", opts.to);
    return { id: data.id, success: true };
  } catch (err: any) {
    console.error("[email] Send error:", err.message);
    return { id: "", success: false, error: err.message };
  }
}

export function buildProspectingEmail(opts: {
  firstName: string;
  company: string;
  senderName: string;
  bodyHtml: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1a1a2e; line-height: 1.7; }
  .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; font-size: 12px; color: #9ca3af; }
</style></head>
<body>
  <p>Bonjour ${opts.firstName},</p>
  ${opts.bodyHtml}
  <div class="footer">
    <p>${opts.senderName} — envoyé via GrowthOS</p>
    <p><a href="{{unsubscribe_url}}" style="color:#9ca3af">Se désabonner</a></p>
  </div>
</body>
</html>`;
}
