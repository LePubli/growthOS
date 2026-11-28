# Collecte depuis le navigateur utilisateur

Lot fonctionnel du 28/11/2026, version de base extension **0.12.0**. État : pilote implémenté, testé localement et soumis en PR84 ; contrôles de livraison en cours. Aucune acceptation fournisseur/Chrome utilisateur ni disponibilité générale déclarée par ce document.

## Parcours du pilote

1. Ouvrir un prospect et lancer l’enrichissement habituel ; attendre le bilan.
2. Dans Enrichissements, choisir **Reprendre les sources sur cet appareil**. Ce pilote reprend les tâches navigateur existantes non appliquées, sans créer un second prospect.
3. Un écran du connecteur s’ouvre dans Chrome/Edge ordinateur. **Autoriser les sources et démarrer** demande les permissions facultatives pour les seules sources de ce lot. Un refus empêche la lecture.
4. L’extension ouvre des onglets dédiés et les lit séquentiellement. Les sessions des sites restent dans le profil Chrome utilisé ; aucun cookie, mot de passe ou jeton d’authentification GrowthOS n’est transmis à l’extension.
5. GrowthOS reçoit les captures par son pont de page authentifié, valide les données et les rapproche avec le prospect. Une identité certaine peut compléter les champs autorisés directement. Les homonymes, identifiants contradictoires et valeurs divergentes restent en comparaison.
6. Seul l’accusé serveur libère la copie locale. Une réponse perdue est rejouable sans deuxième application. Garder GrowthOS ouvert pour synchroniser ; la file de lecture peut continuer localement tant que Chrome est disponible.
7. Sur contrôle de sécurité/consentement : ouvrir la source concernée, effectuer l’action autorisée, puis relancer un lot local depuis GrowthOS. Le nouvel essai réutilise l’onglet source pour le même prospect. Aucune résolution automatique de contrôle ni dissimulation garantie.
8. Arrêter depuis GrowthOS ou le connecteur interrompt la file ; les résultats déjà enregistrés restent en CRM et les captures reçues restent attachées aux tâches. Les résultats tardifs d’un lot arrêté/supplanté sont refusés.

Sources du pilote : Societe.com, Pappers, PagesJaunes, Google Maps, Google Search et Bing. Les résultats Web génériques sont des références, pas des coordonnées d’entreprise confirmées. Le pilote ne garantit ni la pagination d’un nouveau catalogue de prospects ni l’automatisation de LinkedIn/Facebook/Instagram/TikTok. Leurs références et le secours existant restent distincts. Annuaire, accès INSEE et BODACC restent des étapes serveur. Windows installé et Android sont différés.

## Contrat Web / extension / API

| Étape | Contrat | Garantie |
|---|---|---|
| Préparer | `POST /api/v1/browser/device-plan` : prospectId, deviceId, runId UUID | Agence/utilisateur/prospect, dernier bilan, sources exécutables et tâches non actives ; bail d’exclusivité de 30 minutes |
| Démarrer | Pont `device-begin` : plan retourné par l’API | Sources autorisées et UUID contrôlés ; onglets de collecte dédiés ; demande Chrome depuis le geste du connecteur |
| Suivre | Pont `device-get` | État local conservé dans chrome.storage.local, jamais présenté comme reçu CRM |
| Recevoir | `POST /api/v1/browser/jobs/:id/device-result` : deviceId, runId, status, reasonCode, captures, references | Session GrowthOS authentifiée ; même propriétaire/tâche/source ; données normalisées, contrôle d’identité et reçu idempotent |
| Acquitter | Pont `device-ack` : runId, jobId et reçu API | Effacement du payload local seulement après succès API ; trace CRM conservée |
| Arrêter | Pont `device-cancel`, puis `POST /api/v1/browser/device-stop` | Pas d’application tardive ; résultats déjà persistés conservés ; le cloud peut ensuite reprendre |

Les résultats ne sont acceptés ni par un endpoint public ni avec les cookies du fournisseur. Les seules valeurs collectées sont les données métier et les liens visibles pris en charge. Aucun HTML complet, cookie ou saisie de connexion n’est placé dans la file ou les diagnostics.

Un lot expiré ou remplacé ne peut pas écraser le nouveau. Un résultat d’un autre appareil/lot/source/agence est refusé. La reprise cloud est bloquée durant le bail local actif ; un arrêt explicite lève ce verrou. Après expiration du bail, un résultat du même lot ne peut être reçu que si ce lot est toujours présent, non arrêté, non remplacé et sous la session authentifiée de son propriétaire.

## Diagnostic

- `DEVICE_RUN_PREPARED`, `DEVICE_RUN_STOPPED` : nombre de sources et exécuteur, sans noms/requêtes.
- `DEVICE_RESULT_RECEIVED`, `DEVICE_CAPTURE_APPLIED` : tâche/source/prospect, résultat reçu versus appliqué, nombres de fiches/références.
- `DEVICE_IDENTITY_CONFLICT`, `DEVICE_SAVE_FAILED` : conservation de la capture, causes SQL expurgées ; aucune fausse panne fournisseur.
- Motifs contrôlés : SECURITY_CHALLENGE, CONSENT_REQUIRED, PERMISSION_REQUIRED, UNREADABLE, NO_RESULTS, AMBIGUOUS, TAB_CLOSED, USER_NAVIGATION, DEVICE_PAUSED, READER_ERROR, WEB_REFERENCES.
- Les messages bruts de pages, sélecteurs, coordonnées et URL privées ne sont pas copiés dans les journaux techniques.

## Recette avant validation utilisateur

- Installation propre et mise à jour du ZIP : vérifier **0.12.0** (ou 0.12.0.N pour le paquet CI), recharger l’extension **et** GrowthOS.
- Permissions absentes, refusées, acquises, puis révoquées ; aucune lecture avant le geste Chrome.
- Passage recherche → bonne fiche → capture → reçu CRM, et cas sans résultat/homonyme/autre établissement.
- Contrôle de sécurité puis reprise de la bonne page ; navigation volontaire dans l’onglet, source fermée.
- Redémarrage du worker extension, GrowthOS fermé/réouvert, réponse perdue, double acquittement, arrêt pendant lecture/réception et deuxième appareil.
- Conserver le nom commercial, les autres coordonnées et l’historique ; recharger la fiche et son bilan ; exporter le diagnostic.
- Chrome/Edge réels sur PC et sites réels indispensables : les tests simulés/Chromium de CI ne constituent pas leur acceptation.

Références Chrome : [permissions activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [permissions facultatives](https://developer.chrome.com/docs/extensions/reference/api/permissions), [cycle de vie MV3](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/lifecycle). Les permissions d’hôte doivent être vérifiées avant injection ; un bouton de page GrowthOS n’est pas présenté comme une permission fournisseur déjà obtenue. La progression est persistée pour supporter l’arrêt du service worker MV3.

Déploiement réservé au propriétaire : quatre images du même SHA **et** nouveau ZIP extension. Aucun changement de réseau Docker ou proxy résidentiel nécessaire.
