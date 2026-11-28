/**
 * GrowthOS Email Service
 * Transactional email via the tenant's SMTP account, falling back to Resend.
 */
import nodemailer from "nodemailer";
import { db, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { providerKeysService } from "../lib/provider-keys/ProviderKeysService";

const RESEND_API_URL = "https://api.resend.com/emails";

export interface SendEmailOptions {
  tenantId?: string;
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

interface SmtpSettings {
  mode?: string;
  host?: string;
  port?: number;
  secure?: boolean;
  username?: string;
  from?: string;
  replyTo?: string;
}

async function getSmtpConfiguration(tenantId?: string) {
  let config: SmtpSettings = {};
  let password = process.env.SMTP_PASSWORD || "";

  if (tenantId) {
    const [tenant] = await db.select({ settings: tenantsTable.settings })
      .from(tenantsTable).where(eq(tenantsTable.id, tenantId)).limit(1);
    config = (tenant?.settings?.email ?? {}) as SmtpSettings;
    if (config.mode === "disabled" || config.mode === "resend") return null;
    const credential = await providerKeysService.getKey(tenantId, "smtp");
    password = credential?.apiKey ?? password;
  }

  const host = config.host || process.env.SMTP_HOST;
  const username = config.username || process.env.SMTP_USER;
  const port = config.port || Number(process.env.SMTP_PORT || 587);
  const from = config.from || process.env.SMTP_FROM || process.env.EMAIL_FROM;
  if (!host || !username || !password || !from) return null;

  const secure = config.secure ?? port === 465;
  const transport = nodemailer.createTransport({
    host, port, secure, requireTLS: !secure,
    auth: { user: username, pass: password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  return { transport, from, replyTo: config.replyTo };
}

export async function verifySmtpConnection(tenantId: string): Promise<{ ok: boolean; message: string }> {
  try {
    const smtp = await getSmtpConfiguration(tenantId);
    if (!smtp) return { ok: false, message: "Renseignez le serveur, l'utilisateur, le mot de passe et l'expéditeur SMTP." };
    await smtp.transport.verify();
    return { ok: true, message: "Connexion et authentification SMTP vérifiées." };
  } catch (error) {
    return { ok: false, message: `Échec SMTP : ${error instanceof Error ? error.message : "Erreur inconnue"}` };
  }
}

async function getResendKey(): Promise<string | null> {
  // Check Replit connector secret first, then env var
  return process.env.RESEND_API_KEY || null;
}

export async function sendEmail(opts: SendEmailOptions): Promise<SendEmailResult> {
  // A first installation can verify SMTP safely, but outbound campaigns must
  // never start before opt-out handling and deliverability checks are ready.
  if (process.env.ENABLE_OUTBOUND_EMAIL !== "true") {
    return { id: "", success: false, error: "Envoi externe désactivé (ENABLE_OUTBOUND_EMAIL=false)" };
  }
  if (opts.html.includes("{{unsubscribe_url}}")) {
    return { id: "", success: false, error: "Un lien de désabonnement valide est obligatoire" };
  }

  try {
    if (opts.tenantId) {
      const [tenant] = await db.select({ settings: tenantsTable.settings })
        .from(tenantsTable).where(eq(tenantsTable.id, opts.tenantId)).limit(1);
      const mode = (tenant?.settings?.email as SmtpSettings | undefined)?.mode;
      if (mode === "disabled") {
        return { id: "", success: false, error: "Envoi d'email désactivé dans la configuration" };
      }
      if (mode === "smtp") {
        const configured = await getSmtpConfiguration(opts.tenantId);
        if (!configured) {
          return { id: "", success: false, error: "Configuration SMTP incomplète" };
        }
      }
    }
    const smtp = await getSmtpConfiguration(opts.tenantId);
    if (smtp) {
      const sent = await smtp.transport.sendMail({
        from: opts.from || smtp.from,
        to: opts.to,
        subject: opts.subject,
        html: opts.html,
        replyTo: opts.replyTo || smtp.replyTo,
      });
      return { id: sent.messageId, success: true };
    }
  } catch (error) {
    return { id: "", success: false, error: `SMTP : ${error instanceof Error ? error.message : "Erreur inconnue"}` };
  }

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

/**
 * E-mail interne à l'agence (récapitulatifs et alertes e-réputation, lot 3).
 * Distinct des campagnes externes : n'utilise que le SMTP configuré de l'agence
 * et un interrupteur dédié (EREP_ALERT_EMAIL_ENABLED), sans dépendre de
 * ENABLE_OUTBOUND_EMAIL qui reste à false pendant la recette.
 */
export async function sendInternalEmail(opts: { tenantId: string; to: string[]; subject: string; html: string; text?: string }): Promise<SendEmailResult> {
  const mode = process.env.EREP_ALERT_EMAIL_ENABLED;
  if (mode !== "true" && mode !== "log") {
    return { id: "", success: false, error: "E-mails d'alerte désactivés (EREP_ALERT_EMAIL_ENABLED=false)" };
  }
  if (!opts.to.length) return { id: "", success: false, error: "Aucun destinataire" };
  if (mode === "log") {
    // Mode recette : l'e-mail est journalisé (sujet, nombre de destinataires), rien n'est envoyé.
    console.info(`[email] Mode journal — e-mail interne non envoyé : « ${opts.subject} » → ${opts.to.length} destinataire(s)`);
    return { id: `log-${Date.now()}`, success: true };
  }
  try {
    const smtp = await getSmtpConfiguration(opts.tenantId);
    if (!smtp) return { id: "", success: false, error: "SMTP de l'agence non configuré ou désactivé (Paramètres → E-mail)" };
    const sent = await smtp.transport.sendMail({ from: smtp.from, to: opts.to, subject: opts.subject, html: opts.html, text: opts.text, replyTo: smtp.replyTo });
    return { id: sent.messageId, success: true };
  } catch (error) {
    return { id: "", success: false, error: `SMTP : ${error instanceof Error ? error.message : "Erreur inconnue"}` };
  }
}

export function buildProspectingEmail(opts: {
  firstName: string;
  company: string;
  senderName: string;
  bodyHtml: string;
  unsubscribeUrl?: string;
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
    ${opts.unsubscribeUrl ? `<p><a href="${opts.unsubscribeUrl}" style="color:#9ca3af">Se désabonner</a></p>` : ''}
  </div>
</body>
</html>`;
}
