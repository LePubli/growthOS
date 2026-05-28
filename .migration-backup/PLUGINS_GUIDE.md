# 🧩 GrowthOS Plugin System - Guide Complet

## 📋 Table des Matières

1. [Architecture](#architecture)
2. [Installation d'un Plugin](#installation-dun-plugin)
3. [Création d'un Plugin](#création-dun-plugin)
4. [Sécurité](#sécurité)
5. [API Reference](#api-reference)
6. [Développement & Tests](#développement--tests)
7. [Déploiement](#déploiement)

---

## 🏗️ Architecture

### Structure du Système de Plugins

```
apps/web/src/plugins/
├── registry.ts              # Chargeur et gestionnaire de plugins
├── hooks.ts                 # Système d'événements (EventBus)
├── ui-slots.tsx             # Composants d'injection UI
├── security/
│   ├── manifest-validator.ts # Validation des manifests
│   └── sandbox.ts           # Sandbox d'exécution sécurisée
├── __tests__/
│   └── registry.test.ts     # Tests unitaires
├── map-tour/                # Plugin: Map Tournée Commerciale
│   ├── plugin.json
│   ├── routes/
│   ├── ui/
│   └── hooks/
└── crm/                     # Plugin: CRM Complet
    ├── plugin.json
    ├── schema.prisma
    ├── routes/
    ├── ui/
    └── hooks/
```

### Cycle de Vie d'un Plugin

1. **Discovery**: Le registry scanne les dossiers plugins
2. **Validation**: Le manifest (`plugin.json`) est validé (Zod)
3. **Registration**: Les routes, hooks et UI slots sont enregistrés
4. **Activation**: Toggle DB → injection des composants
5. **Execution**: Hooks exécutés dans un sandbox sécurisé

---

## 📦 Installation d'un Plugin

### Méthode 1: Manuellement

1. Créez un dossier dans `apps/web/src/plugins/{slug}`
2. Ajoutez un `plugin.json` valide
3. Redémarrez l'application

```bash
mkdir -p apps/web/src/plugins/my-plugin
cp template/plugin.json apps/web/src/plugins/my-plugin/
```

### Méthode 2: Via l'UI Admin

1. Allez dans **Settings → Plugins**
2. Cliquez sur "Installer un plugin"
3. Uploadez un fichier ZIP ou URL Git
4. Activez le plugin

### Vérification

```bash
# Vérifier que le plugin est chargé
curl http://localhost:3000/api/v1/plugins/registry

# Activer/désactiver
curl -X PATCH http://localhost:3000/api/v1/plugins/registry/my-plugin \
  -H "Content-Type: application/json" \
  -d '{"isActive": true}'
```

---

## 🛠️ Création d'un Plugin

### 1. Manifeste (`plugin.json`)

```json
{
  "slug": "mon-plugin",
  "name": "Mon Plugin Super",
  "version": "1.0.0",
  "description": "Description détaillée",
  "author": "Votre Nom",
  "isActive": false,
  "permissions": [
    "prospects:read",
    "deals:write"
  ],
  "hooks": [
    "prospect:created",
    "pipeline:stageChanged"
  ],
  "routes": [
    "/api/v1/plugins/mon-plugin/data",
    "/api/v1/plugins/mon-plugin/export"
  ],
  "uiSlots": [
    { "slot": "dashboard-top", "component": "DashboardWidget" },
    { "slot": "prospect-actions", "component": "ActionButtons" }
  ],
  "database": {
    "tables": ["PluginData_mon_plugin"]
  }
}
```

### 2. Routes API

Créez des Route Handlers Next.js dans `routes/`:

```typescript
// apps/web/src/plugins/mon-plugin/routes/data/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getAuthUser } from '@/lib/auth';

export async function GET(req: NextRequest) {
  const user = await getAuthUser(req);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const data = await prisma.pluginData_monPlugin.findMany({
    where: { tenantId: user.tenantId }
  });

  return NextResponse.json(data);
}
```

### 3. Hooks (Écouteurs d'Événements)

```typescript
// apps/web/src/plugins/mon-plugin/hooks/listeners.ts
import { onHook } from '@/plugins/hooks';

export function registerMonPluginHooks() {
  onHook('prospect:created', async (data) => {
    console.log('[Mon Plugin] Nouveau prospect:', data.prospectId);
    
    // Action personnalisée
    await maLogiqueMetier(data);
  });

  onHook('pipeline:stageChanged', async (data) => {
    // Notification, logging, etc.
  });
}
```

### 4. Composants UI

```tsx
// apps/web/src/plugins/mon-plugin/ui/dashboard-widget.tsx
'use client';

import React from 'react';
import { registerUIComponent } from '@/plugins/ui-slots';

function DashboardWidget({ tenantId, userId }: any) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm">
      <h3 className="text-lg font-semibold">Mon Widget</h3>
      <p>Contenu personnalisé pour {tenantId}</p>
    </div>
  );
}

// Enregistrement automatique
registerUIComponent('dashboard-top', DashboardWidget, {
  order: 10,
  pluginName: 'mon-plugin'
});

export default DashboardWidget;
```

### 5. Schéma de Données (Prisma)

```prisma
// À ajouter dans schema.prisma ou fichier importé

model PluginData_monPlugin {
  id        String   @id @default(cuid())
  tenantId  String
  data      Json
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([tenantId])
}
```

Puis migrez:
```bash
npx prisma migrate dev --name add_mon_plugin
```

---

## 🔒 Sécurité

### Validation des Manifests

Le système rejette automatiquement:
- Slugs invalides (seulement `[a-z0-9-]`)
- Versions non-SemVer
- Permissions inconnues
- Hooks non autorisés
- Routes hors namespace `/api/v1/plugins/{slug}/`

### Sandbox d'Exécution

Les hooks plugins sont exécutés dans un environnement isolé:
- ⏱️ Timeout forcé (5 secondes)
- 🚫 `eval()`, `Function()` interdits
- 🚫 Accès `fs`, `process`, `require` bloqués
- 🚫 Requêtes HTTP brutes filtrées

```typescript
// Tentative malveillante → rejetée
onHook('prospect:created', async () => {
  eval('malicious code'); // ❌ Détecté et bloqué
});
```

### Bonnes Pratiques

1. **Ne jamais faire confiance aux inputs** → Utilisez Zod
2. **Isolez les données** → Tables `PluginData_{slug}`
3. **Vérifiez les permissions** → `hasPermission(manifest, 'resource:action')`
4. **Signez vos plugins** → Ajoutez un champ `signature` en prod

---

## 📡 API Reference

### Registry

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/plugins/registry` | Liste tous les plugins |
| `PATCH` | `/api/v1/plugins/registry/:slug` | Active/désactive un plugin |
| `POST` | `/api/v1/plugins/install` | Installe un nouveau plugin |
| `DELETE` | `/api/v1/plugins/:slug` | Désinstalle un plugin |

### Hooks

| Event | Payload | Description |
|-------|---------|-------------|
| `prospect:created` | `{ prospectId, email, tenantId }` | Nouveau prospect créé |
| `prospect:updated` | `{ prospectId, changes }` | Prospect modifié |
| `pipeline:stageChanged` | `{ entityId, oldStage, newStage, type }` | Deal changé de phase |
| `sequence:enrolled` | `{ sequenceId, prospectId }` | Prospect enrollé |

### UI Slots Disponibles

| Slot | Emplacement | Props |
|------|-------------|-------|
| `dashboard-top` | Haut du dashboard | `{ tenantId, userId }` |
| `prospect-actions` | Actions prospects | `{ prospectId, prospect }` |
| `prospect-list-toolbar` | Toolbar liste | `{ selectedCount, total }` |
| `pipeline-extension` | Détails deal | `{ dealId, stage }` |
| `sequence-extension` | Détails séquence | `{ sequenceId }` |

---

## 🧪 Développement & Tests

### Lancer les Tests

```bash
# Tests unitaires
npm test -- apps/web/src/plugins/__tests__

# Tests avec coverage
npm run test:coverage -- --plugins

# Tests en watch mode
npm run test:watch
```

### Debug Mode

Activez le mode debug pour voir les logs plugins:

```bash
DEBUG=plugins:* npm run dev
```

### Checklist Avant Publication

- [ ] Manifest valide (`validateManifest()`)
- [ ] Tests unitaires passing
- [ ] Pas de warnings sandbox
- [ ] Documentation à jour
- [ ] Version SemVer incrémentée

---

## 🚀 Déploiement

### Docker Compose

```bash
# Build et lancement
docker-compose up --build

# Voir les logs
docker-compose logs -f app

# Redémarrer un plugin
docker-compose restart app
```

### Variables d'Environnement

```bash
# .env production
ENABLE_PLUGIN_SANDBOX=true
PLUGIN_STRICT_MODE=true
PLUGIN_DIR=/app/apps/web/src/plugins
```

### Mise à Jour d'un Plugin

1. Mettez à jour le code dans le dossier plugin
2. Incrémentez la version dans `plugin.json`
3. Redéployez: `docker-compose restart app`
4. Le registry re-valide automatiquement

---

## 📚 Exemples de Plugins

### Plugin Simple: Widget Météo

```json
{
  "slug": "weather-widget",
  "name": "Météo Dashboard",
  "version": "1.0.0",
  "permissions": [],
  "hooks": [],
  "routes": [],
  "uiSlots": [{ "slot": "dashboard-top", "component": "WeatherWidget" }]
}
```

### Plugin Complexe: CRM

Voir `apps/web/src/plugins/crm/` pour un exemple complet avec:
- 6 modèles de données
- 15+ routes API
- 5 hooks listeners
- 10+ composants UI

---

## 🆘 Support

- 📖 Docs: `/PLUGINS_GUIDE.md`
- 🐛 Issues: GitHub Issues
- 💬 Discord: #plugins channel

---

**GrowthOS Plugin System v1.0** | Construit avec ❤️ pour l'extensibilité
