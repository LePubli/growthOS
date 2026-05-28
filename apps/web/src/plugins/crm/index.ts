/**
 * Point d'entrée principal du plugin CRM Pro
 * Initialise les hooks, enregistre les composants UI et configure le plugin
 */

import { registerUIComponent } from '@/plugins/ui-slots';
import { registerCrmHooks } from './hooks/listeners';
import { CrmQuickActions } from './ui/prospect-actions';
import { CrmDashboardWidgets } from './ui/dashboard-widgets';

export function initCrmPlugin() {
  console.log('[CRM Plugin] Initialisation...');

  // 1. Enregistrement des composants UI dans les slots
  registerUIComponent('prospect-actions', CrmQuickActions, {
    order: 10,
    pluginName: 'crm-pro'
  });

  registerUIComponent('dashboard-top', CrmDashboardWidgets, {
    order: 20,
    pluginName: 'crm-pro'
  });

  // 2. Enregistrement des écouteurs d'événements (hooks)
  registerCrmHooks();

  console.log('[CRM Plugin] Initialisation terminée');
}

// Export pour le registry
export const crmPlugin = {
  slug: 'crm-pro',
  init: initCrmPlugin,
  components: {
    CrmQuickActions,
    CrmDashboardWidgets
  }
};
