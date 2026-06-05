import { Router } from "express";
import { pool } from "@workspace/db";
import { requireAuth } from "../../middlewares/auth";

const router = Router();

router.get("/config", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const result = await pool.query(`SELECT * FROM sso_configs WHERE tenant_id=$1`, [tenantId]);
  res.json(result.rows);
});

router.post("/config", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { provider, ssoUrl, entityId, certificate, isActive, attributeMapping } = req.body;

  if (!provider || !ssoUrl) {
    return res.status(400).json({ error: "provider et ssoUrl sont requis" });
  }

  const existing = await pool.query(`SELECT id FROM sso_configs WHERE tenant_id=$1 AND provider=$2`, [tenantId, provider]);

  let result;
  if (existing.rows.length > 0) {
    result = await pool.query(
      `UPDATE sso_configs SET sso_url=$1, entity_id=$2, certificate=$3, is_active=$4, attribute_mapping=$5, updated_at=NOW() WHERE tenant_id=$6 AND provider=$7 RETURNING *`,
      [ssoUrl, entityId || null, certificate || null, isActive ?? false, attributeMapping ? JSON.stringify(attributeMapping) : null, tenantId, provider]
    );
  } else {
    result = await pool.query(
      `INSERT INTO sso_configs (tenant_id, provider, sso_url, entity_id, certificate, is_active, attribute_mapping) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      [tenantId, provider, ssoUrl, entityId || null, certificate || null, isActive ?? false, attributeMapping ? JSON.stringify(attributeMapping) : null]
    );
  }

  res.status(201).json(result.rows[0]);
});

router.post("/config/:id/test", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  const { id } = req.params;

  const config = await pool.query(`SELECT * FROM sso_configs WHERE id=$1 AND tenant_id=$2`, [id, tenantId]);
  if (config.rows.length === 0) return res.status(404).json({ error: "Configuration SSO introuvable" });

  const cfg = config.rows[0];
  try {
    const response = await fetch(cfg.sso_url, { method: 'GET', signal: AbortSignal.timeout(5000) });
    res.json({ success: response.status < 500, statusCode: response.status, message: `SSO endpoint responded with ${response.status}` });
  } catch (err: any) {
    res.json({ success: false, message: `Impossible de joindre ${cfg.sso_url}: ${err.message}` });
  }
});

router.delete("/config/:id", requireAuth, async (req, res) => {
  const tenantId = req.auth!.tenantId;
  await pool.query(`DELETE FROM sso_configs WHERE id=$1 AND tenant_id=$2`, [req.params.id, tenantId]);
  res.json({ success: true });
});

router.get("/providers", requireAuth, (_req, res) => {
  res.json([
    { id: "azure", name: "Azure Active Directory", logo: "🔵", docsUrl: "https://learn.microsoft.com/azure/active-directory/saas-apps/", defaultEntityId: "https://sts.windows.net/", attrMapping: { email: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/emailaddress", firstName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/givenname", lastName: "http://schemas.xmlsoap.org/ws/2005/05/identity/claims/surname" } },
    { id: "okta", name: "Okta", logo: "🔵", docsUrl: "https://developer.okta.com/docs/guides/saml-tracer/", defaultEntityId: "http://www.okta.com/", attrMapping: { email: "email", firstName: "firstName", lastName: "lastName" } },
    { id: "google", name: "Google Workspace", logo: "🔵", docsUrl: "https://support.google.com/a/answer/6087519", defaultEntityId: "https://accounts.google.com/o/saml2?idpid=", attrMapping: { email: "email", firstName: "given_name", lastName: "family_name" } },
    { id: "onelogin", name: "OneLogin", logo: "🔴", docsUrl: "https://developers.onelogin.com/saml", defaultEntityId: "https://app.onelogin.com/saml/metadata/", attrMapping: { email: "User.email", firstName: "User.FirstName", lastName: "User.LastName" } },
  ]);
});

export default router;
