/**
 * ============================================================
 * Exemple de plugin GrowthOS minimal
 * Crée ce fichier + plugin.yaml → zippe → upload dans la Marketplace
 * ============================================================
 */

import { createPlugin, createPluginSDK, defineHook } from '@growthos/sdk';

// 1. Définition du plugin
export const plugin = createPlugin({
  name: 'my-plugin',
  displayName: 'Mon Plugin Custom',
  version: '1.0.0',
  description: 'Description de mon plugin',
  author: 'Mon Entreprise',
  category: 'TOOLS',
  icon: '🚀',

  // Exécuté à l'installation
  async onInstall(ctx) {
    console.log(`[my-plugin] Installé sur tenant: ${ctx.tenantId}`);
  },

  // Hooks sur événements GrowthOS
  hooks: {
    'prospect.created': async (event) => {
      const sdk = createPluginSDK(process.env.GROWTHOS_URL!, process.env.GROWTHOS_TOKEN!);

      // Scorer le prospect via IA locale (Ollama)
      const score = await sdk.ai.scoreProspect({
        company_name: event.company_name,
        naf_label: event.naf_label,
        city: event.city,
      });

      // Mettre à jour le prospect avec le score
      await sdk.db.updateProspect(event.id, {
        propensity_score: score.score,
        propensity_category: score.category,
      });

      // Créer un signal si HOT
      if (score.category === 'HOT') {
        await sdk.db.createSignal(event.id, {
          type: 'ai_hot_lead',
          title: `🔥 Lead chaud — Score ${score.score}/100`,
          severity: 'high',
        });

        // Notifier via event bus
        await sdk.events.publish('signal.detected', {
          prospectId: event.id,
          signalType: 'ai_hot_lead',
          score: score.score,
        });
      }

      console.log(`[my-plugin] Prospect ${event.company_name} scoré: ${score.score} (${score.category})`);
    },
  },
});

// 2. plugin.yaml (à créer dans le même dossier) :
/*
name: "my-plugin"
displayName: "Mon Plugin Custom"
version: "1.0.0"
description: "Description de mon plugin"
author: "Mon Entreprise"
category: "TOOLS"
icon: "🚀"

hooks:
  - event: "prospect.created"
    handler: "dist/index.js"
*/

// 3. Structure ZIP :
/*
my-plugin.zip
├── plugin.yaml        ← requis
├── dist/
│   └── index.js       ← votre code compilé
└── migrations/        ← optionnel, SQL si besoin
    └── 001_init.sql
*/
