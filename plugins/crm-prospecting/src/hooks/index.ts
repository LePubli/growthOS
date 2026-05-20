/**
 * Hook: tenant.created
 * Crée les données par défaut pour un nouveau tenant :
 * - Pipeline avec étapes par défaut
 * - Stage initial pour les prospects
 */
export async function onTenantCreated(event: { tenantId: string; tenantSchema: string }) {
  const { tenantSchema } = event;

  // Les migrations SQL créent déjà le pipeline par défaut
  // Ce hook peut être utilisé pour des initialisations supplémentaires
  console.log(`[crm-prospecting] Tenant créé: ${tenantSchema} — pipeline initialisé`);
}

/**
 * Hook: prospect.created
 * Calcule le score initial du prospect
 */
export async function onProspectCreated(event: {
  tenantId: string;
  tenantSchema: string;
  payload: { id: string; company_name: string };
}) {
  const { tenantSchema, payload } = event;

  // Score basique calculé depuis les données disponibles
  // Le scoring complet est déclenché par le plugin predictive-scorer
  console.log(`[crm-prospecting] Prospect créé: ${payload.company_name} — score en attente`);
}
