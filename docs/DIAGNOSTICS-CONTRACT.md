# GrowthOS — contrat de diagnostic transversal

Ce contrat s'applique **à chaque développement futur**. Il complète les vérifications fonctionnelles et n'autorise pas de données personnelles dans les logs techniques.

## Déjà automatique

- Toutes les routes Express actuelles et futures : erreurs HTTP `4xx` / `5xx` et requêtes de plus de 3 secondes, associées à un `traceId` côté serveur.
- Erreurs non gérées dans les middlewares API : code `UNHANDLED_EXCEPTION`, classe d'erreur, statut, trace.
- Erreurs du navigateur client : erreurs JavaScript non interceptées, promesses non traitées, erreurs de rendu React, pannes réseau.
- Tâches de navigation cloud : démarrage, résultat, intervention requise, échec, durée, source, tâche/prospect ; `X-Diagnostic-Id` présent dans les logs Docker du worker. Les opérations interactives transmettent le `traceId` HTTP et l'indisponibilité du worker est signalée à cadence limitée.
- Enrichissement multisource : étape/source, progression, bilan, champs effectivement remplis (nombre), nombre de désaccords, erreur technique.
- **Causes des sources** : catégorisation de l'état et du message technique (`source-diagnosis.ts`) : sécurité/Cloudflare, quotas HTTP 429, accès refusé, absence de configuration, délai dépassé, service indisponible, identité non confirmée, aucun résultat. La fiche de diagnostic différencie motif constaté, cause probable et cause inconnue, puis propose une action adaptée.
- L'ancien journal des tâches reste visible même si un incident précède ce déploiement.
- Les tâches cloud historiques lisent leur explication dans `result.message` (une intervention ou un doute d'identité n'écrit souvent rien dans la colonne `error`). Les exports ne contiennent jamais la capture HTML, uniquement les messages expurgés.

## À ajouter pour chaque nouvelle fonctionnalité

Dans le service de la nouvelle fonctionnalité, émettre `recordDiagnosticEvent()` (`artifacts/api-server/src/lib/diagnostics.ts`) à chaque transition métier significative, erreur récupérée ou intervention utilisateur. Une route API déjà instrumentée ne détecte pas à elle seule les erreurs **avalées** par le métier, les résultats incomplets ou les files d'attente bloquées.

```ts
void recordDiagnosticEvent({
  tenantId, userId, level: 'warn', component: 'nouveau-module',
  code: 'STEP_REQUIRES_REVIEW', message: 'Vérification requise',
  source: 'nom-source', prospectId, jobId,
  details: { status: 'needs_review', durationMs: 1243, resultCount: 0 },
});
```

Checklist de PR pour **les deux agents** :

1. Définir au minimum le nom du composant, les codes d'événements et les transitions de tâche ; renseigner `source`, `prospectId` et `jobId` quand disponibles.
2. Ajouter un diagnostic pour les erreurs métier interceptées, les sorties partielles et les délais anormaux ; conserver le lien vers la trace API.
3. Vérifier l'isolation `tenant_id`, les données sensibles, la non-régression du fonctionnement même si le stockage diagnostic échoue.
4. Ajouter ou mettre à jour le test du scénario d'échec ainsi que `scripts/test-diagnostics.mjs` si de nouveaux points d'instrumentation sont introduits.
5. Documenter le code d'incident, les causes probables et l'action corrective ; déclarer la couverture manquante explicitement.

## Exploitation

- UI administrateur : `/admin/diagnostics` (section Configuration), mise à jour toutes les 30 secondes ; filtres sur composant, gravité, période, prospect, tâche, trace.
- API sous `/api/v1/diagnostics` : `GET /summary`, `GET /events`, `GET /sources`, `GET /jobs`, `GET /export` réservés aux rôles administrateur de leur tenant ; `POST /client-events` protégé, validé et limité à 15 événements/minute/utilisateur.
- Rapport exporté : JSON avec événements filtrés (max. 500), états de collectes/enrichissements (max. 120 par famille) et horodatages. Joindre ce fichier à la demande de correction, avec heure, action reproduite et résultat attendu.
- Journaux Docker DockPanel : filtrer par `traceId` (API) ou `diagnosticId` (worker cloud). Le worker n'enregistre jamais les captures, requêtes, cookies ou secrets.
- Rétention technique en base : 90 jours, nettoyage par lots de 2 000 au démarrage puis chaque heure. Les anciennes données métier/audit ne sont pas supprimées.

## Limites honnêtes

Ce centre ne remplace pas les journaux d'infrastructure : panne du processus **avant la connexion DB**, conteneur hors ligne, saturation disque ou rupture totale de réseau requièrent les logs et métriques DockPanel. Les évènements client impossibles à envoyer hors ligne ne sont pas conservés localement. Les nouveaux traitements qui masquent leurs erreurs exigent un appel explicite à `recordDiagnosticEvent` dans la même PR ; la couverture n'est pas magique.
