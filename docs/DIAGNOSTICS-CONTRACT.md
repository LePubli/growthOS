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
- **Comparaison sans capture** : `CAPTURE_REQUIRED` / `SOURCE_CAPTURE_REQUIRED` est un avertissement fonctionnel (HTTP 409), pas une panne du moteur. L'onglet Enrichissements mène directement vers la session source lorsqu'elle attend une lecture ; la comparaison effectue un précontrôle de présence de capture. Pour les résultats organiques Google/Bing, le collecteur attend une courte fenêtre supplémentaire si la structure de recherche apparaît avant ses liens ; un blocage réel reste signalé sans tentative de contournement.

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
- La réponse `409` « Aucune fiche capturée » signifie qu'il faut d'abord ouvrir et lire la bonne fiche : ne pas la traiter comme une panne `502`. En cas d'échec de lecture Google/Bing persistant, vérifier dans la session la présence réelle de résultats et un éventuel écran de consentement/sécurité. Pour Pappers, aucune donnée n'est appliquée si le SIREN affiché ne correspond pas exactement à celui de l'URL de l'entreprise.
- Rétention technique en base : 90 jours, nettoyage par lots de 2 000 au démarrage puis chaque heure. Les anciennes données métier/audit ne sont pas supprimées.

## Limites honnêtes

Ce centre ne remplace pas les journaux d'infrastructure : panne du processus **avant la connexion DB**, conteneur hors ligne, saturation disque ou rupture totale de réseau requièrent les logs et métriques DockPanel. Les évènements client impossibles à envoyer hors ligne ne sont pas conservés localement. Les nouveaux traitements qui masquent leurs erreurs exigent un appel explicite à `recordDiagnosticEvent` dans la même PR ; la couverture n'est pas magique.

## Validation locale et coordonnées multiples

- `LOCAL_CAPTURE_STAGED`, `CONFIRMATION_STARTED`, `CONFIRMATION_SAVED` : étapes de validation locale, liées au prospect, à la tâche, à la source et à la trace HTTP. L'enregistrement CRM ne dépend pas de la disponibilité du navigateur cloud.
- `CRM_IDENTITY_DUPLICATE` (409) : SIRET/SIREN déjà rattaché à une autre fiche du même CRM ; vérifier le doublon avant de valider. La capture reste conservée et la transaction ne remplace aucune autre fiche. `CRM_IDENTITY_INCONSISTENT` : SIREN et SIRET incohérents. Ces cas ne sont pas des pannes navigateur.
- `CRM_SAVE_FAILED` (500) : autre erreur d'enregistrement. Le code SQLSTATE imbriqué est collecté et seules les trois contraintes d'identité connues sont exposées. Aucun SQL, paramètre ni contenu de ligne dans les diagnostics. La référence est affichée dans la comparaison, qui conserve son message d'erreur jusqu'à une actualisation explicite.
- `CONTACT_EVIDENCE_MERGED`, `WEBSITE_CONTACTS_READ`, `WEBSITE_IDENTITY_CONFLICT` : nombres de coordonnées, pages et éditeurs lus, résultat du rapprochement et nombre de champs remplis. Les adresses, emails, numéros, noms, pages HTML restent exclusivement dans le dossier métier avec leurs preuves.
- `PRIMARY_COORDINATE_SAVED` / `PRIMARY_COORDINATE_CONFLICT` : choix explicite d'une principale parmi les preuves déjà enregistrées, concurrence et isolement par tenant. Les autres coordonnées restent conservées. Les coordonnées générales ne sont pas attribuées aux dirigeants.
- Les événements métier expurgés sont aussi écrits dans les logs API Docker : filtrer par `traceId`, `jobId`, `prospectId` ou `code`. Si l'insertion du diagnostic en DB échoue, la trace Docker demeure disponible et l'opération métier n'est pas bloquée.

`INVALID_COORDINATE_INPUT` / `CONTACT_OPERATION_FAILED` couvrent aussi la validation du choix et les échecs de lecture/écriture du répertoire Contacts. La réponse contient une trace ; aucun contenu du contact n'est inclus dans l'événement technique.
