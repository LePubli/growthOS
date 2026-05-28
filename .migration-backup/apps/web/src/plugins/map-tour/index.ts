/**
 * ============================================================
 * Map Tour Plugin - Index & Registration
 * ============================================================
 * Point d'entrée du plugin qui enregistre les composants UI
 * et initialise les hooks
 */

import { registerUIComponent } from '../../ui-slots';
import { RouteBuilder } from './components/RouteBuilder';
import { RouteSummary } from './components/RouteSummary';

/**
 * Initialisation du plugin Map Tour
 * Appelée automatiquement par le registry au chargement
 */
export function initMapTourPlugin(): void {
  // Enregistrer les composants UI dans les slots
  registerUIComponent('prospect-list-toolbar', RouteBuilder, {
    order: 10,
    pluginName: 'map-tour',
  });

  registerUIComponent('dashboard-top', RouteSummary, {
    order: 20,
    pluginName: 'map-tour',
  });

  console.log('[Map Tour Plugin] Initialisé avec succès');
}

/**
 * Hook pour prospect:created
 * Géocode automatiquement l'adresse si activé dans la config
 */
export async function onProspectCreated(data: {
  prospectId: string;
  address?: string;
  tenantId: string;
}): Promise<void> {
  // À implémenter: géocodage automatique si activé
  if (!data.address) return;

  try {
    const response = await fetch('/api/v1/plugins/map-tour/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        address: data.address,
        tenantId: data.tenantId,
      }),
    });

    if (response.ok) {
      const result = await response.json();
      console.log('[Map Tour] Adresse géocodée:', result.coordinates);
      
      // Émettre un événement pour les autres plugins
      window.dispatchEvent(
        new CustomEvent('growthos:address:geocoded', {
          detail: {
            prospectId: data.prospectId,
            coordinates: result.coordinates,
          },
        })
      );
    }
  } catch (error) {
    console.error('[Map Tour] Erreur géocodage auto:', error);
  }
}

/**
 * Hook pour client:created
 * Même logique que pour les prospects
 */
export async function onClientCreated(data: {
  clientId: string;
  address?: string;
  tenantId: string;
}): Promise<void> {
  return onProspectCreated({
    prospectId: data.clientId,
    address: data.address,
    tenantId: data.tenantId,
  });
}

// Export des hooks pour le registry
export const hooks = {
  'prospect:created': onProspectCreated,
  'client:created': onClientCreated,
};

// Export par défaut
export default {
  name: 'map-tour',
  version: '1.0.0',
  init: initMapTourPlugin,
  hooks,
};
