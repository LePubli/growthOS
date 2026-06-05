import { pool } from "@workspace/db";

export const RGPDService = {
  /**
   * Génère un export JSON de toutes les données du tenant.
   */
  async exportTenantData(tenantId: string): Promise<Record<string, unknown>> {
    const [
      tenantRow,
      users,
      prospects,
      deals,
      activities,
      tasks,
      signals,
      sequences,
      auditLogs,
      consentLogs,
    ] = await Promise.all([
      pool.query(`SELECT id, name, slug, domain, plan, status, created_at FROM tenants WHERE id = $1`, [tenantId]),
      pool.query(`SELECT id, email, first_name, last_name, role, created_at FROM users WHERE tenant_id = $1`, [tenantId]),
      pool.query(`SELECT * FROM prospects WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10000`, [tenantId]),
      pool.query(`SELECT * FROM deals WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`, [tenantId]),
      pool.query(`SELECT * FROM activities WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 10000`, [tenantId]),
      pool.query(`SELECT * FROM tasks WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`, [tenantId]),
      pool.query(`SELECT * FROM signals WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`, [tenantId]),
      pool.query(`SELECT id, name, status, created_at FROM sequences WHERE tenant_id = $1`, [tenantId]),
      pool.query(
        `SELECT action, entity_type, entity_id, created_at FROM audit_logs
         WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT 5000`,
        [tenantId],
      ),
      pool.query(`SELECT * FROM consent_logs WHERE tenant_id = $1 ORDER BY created_at DESC`, [tenantId]),
    ]);

    return {
      export_metadata: {
        exported_at: new Date().toISOString(),
        tenant_id: tenantId,
        format_version: "1.0",
        note: "Export RGPD — Article 20 GDPR",
      },
      tenant: tenantRow.rows[0] ?? null,
      users: users.rows,
      prospects: prospects.rows,
      deals: deals.rows,
      activities: activities.rows,
      tasks: tasks.rows,
      signals: signals.rows,
      sequences: sequences.rows,
      audit_trail: auditLogs.rows,
      consent_history: consentLogs.rows,
    };
  },

  /**
   * Anonymise les données personnelles du tenant (soft-delete RGPD).
   * Ne supprime pas les entités business (prospects/deals) mais anonymise les PII.
   */
  async deleteTenantData(
    tenantId: string,
    options: { anonymize?: boolean } = {},
  ): Promise<{ affected: Record<string, number> }> {
    const affected: Record<string, number> = {};

    if (options.anonymize) {
      // Anonymiser les prospects (PII)
      const p = await pool.query(
        `UPDATE prospects
         SET first_name = 'ANONYMISÉ', last_name = 'ANONYMISÉ',
             email = CONCAT('anon_', id, '@deleted.local'),
             phone = NULL, linkedin_url = NULL, notes = NULL,
             updated_at = NOW()
         WHERE tenant_id = $1`,
        [tenantId],
      );
      affected.prospects_anonymized = p.rowCount ?? 0;

      // Supprimer les logs d'audit et consentements
      const al = await pool.query(`DELETE FROM audit_logs WHERE tenant_id = $1`, [tenantId]);
      const cl = await pool.query(`DELETE FROM consent_logs WHERE tenant_id = $1`, [tenantId]);
      const mn = await pool.query(`DELETE FROM mentions WHERE tenant_id = $1`, [tenantId]);
      affected.audit_logs_deleted = al.rowCount ?? 0;
      affected.consent_logs_deleted = cl.rowCount ?? 0;
      affected.mentions_deleted = mn.rowCount ?? 0;
    } else {
      // Suppression totale
      const tables = ["tasks", "activities", "signals", "deals", "prospects", "sequences", "audit_logs", "consent_logs", "mentions"];
      for (const table of tables) {
        const r = await pool.query(`DELETE FROM ${table} WHERE tenant_id = $1`, [tenantId]);
        affected[`${table}_deleted`] = r.rowCount ?? 0;
      }
    }

    return { affected };
  },
};
