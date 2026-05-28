import { onHook } from '@/plugins/hooks';

/**
 * Écouteurs d'événements pour le plugin CRM
 * Synchronise les données core avec le CRM enrichi
 */

export function registerCrmHooks() {
  console.log('[CRM Plugin] Registration des hooks...');

  // Quand un prospect est créé dans le core
  onHook('prospect:created', async (data) => {
    console.log('[CRM Hook] Nouveau prospect détecté:', data.prospectId);
    
    // Optionnel : Pré-créer une fiche contact "brouillon" dans le CRM
    // await fetch('/api/v1/plugins/crm/contacts/draft', { ... })
  });

  // Quand un deal change de stage
  onHook('pipeline:stageChanged', async (data) => {
    if (data.type === 'deal') {
      console.log(`[CRM Hook] Deal ${data.entityId} passé de ${data.oldStage} à ${data.newStage}`);
      
      // Création automatique d'une note dans le timeline
      try {
        await fetch('/api/v1/plugins/crm/activities', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'note',
            subject: 'Changement de phase',
            description: `Le deal est passé en phase "${data.newStage}" automatiquement via le pipeline.`,
            status: 'completed',
            dealId: data.entityId
          })
        });
      } catch (e) {
        console.error('Failed to log CRM activity for stage change', e);
      }
    }
  });

  // Quand une séquence démarre
  onHook('sequence:enrolled', async (data) => {
    console.log('[CRM Hook] Prospect enrollé dans une sequence:', data.sequenceId);
    // Mise à jour du statut "Engagé" sur le contact lié
  });

  console.log('[CRM Plugin] Hooks enregistrés avec succès');
}
