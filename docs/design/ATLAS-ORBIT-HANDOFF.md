# GrowthOS — Coordination design ATLAS × ORBIT

**26 novembre 2026 — Note de relais de l'agent design à l'agent développement.**

> NE PAS SUPPRIMER ce document ni le fichier COORDINATION-AGENTS.md avant le lancement final **avec autorisation explicite du propriétaire**. Un redéploiement de recette n'est pas cette autorisation.

## Périmètres et collaboration

L'agent design traite UI, interactions, accessibilité, parcours Prospect 360°, carte relationnelle et documentation. L'autre agent traite APIs, données, intégrations, sécurité, persistance et métier. Les deux agents conservent les changements de l'autre. La branche de développement partagée est fix/growthos-functional-redesign. Aucun push forcé.

Le fichier **COORDINATION-AGENTS.md** a été publié par l'autre agent dans le commit 23a976e puis fusionné dans la branche fonctionnelle via la PR 39. Respecter ses règles de non-écrasement et l'enrichir uniquement dans la section relais design.

## Ce qui a été développé dans le lot UX

| Fichier relatif à artifacts/growthos/src | Rôle |
| --- | --- |
| providers/theme-provider.tsx | Thème ATLAS × ORBIT par défaut si aucune préférence enregistrée. Les anciens choix sont respectés. |
| atlas-orbit.css, index.css | Design bleu/blanc, sidebar claire, lisibilité, cards, états et comportements responsives. |
| components/layout/AppShell.tsx | Styles de navigation ATLAS sans modification des routes métier. |
| components/atlas/ProspectQuickPreview.tsx | Aperçu latéral depuis la liste, complétude, prochain geste suggéré, CTA Ouvrir la fiche 360°. |
| pages/ProspectsPage.tsx | Clic ligne → aperçu ; bouton 360 → vraie page de détails. |
| pages/ProspectDetailPage.tsx | Navigation pleine page avec Vue 360°, Cartographie, raccourcis Contacts, Sources, Activités, Surveillance. |
| components/atlas/ProspectRelationshipMap.tsx | Zoom molette/±, pan par glisser, recentrage, vue dirigeants, anciens mandats activables, détail des nœuds. |

Le composant de cartographie géographique Leaflet déjà présent dans la fiche prospect **n'est pas modifié** : carte géographique et graphe relationnel ont deux usages distincts.

## Sources exactes et modèle de confiance

La seule carte relationnelle préremplie est un **instantané documentaire** de SOLUTION ENR, SIREN 981075252, relevé le 26/11/2026. Ce n'est **pas** un appel API en temps réel.

1. Société : https://www.pappers.fr/entreprise/solution-enr-981075252
2. Soheyb BETKA : https://www.pappers.fr/dirigeant/soheyb_betka_1990-07 — président SOLUTION ENR et MELIO HABITAT ; entrepreneur individuel ; anciens mandats EPC PAC et GROUPE NORD ENERGIE.
3. Abdelwahid BOUSSADIA : https://www.pappers.fr/dirigeant/abdelwahid_boussadia_1997-02 — directeur général SOLUTION ENR ; entrepreneur individuel ; ancien mandat EPC PAC.
4. API officielle Pappers : https://www.pappers.fr/api/documentation ; l'API comprend les informations des entreprises et une fonction de cartographie. Vérifier contrat et accès avant implémentation.

Référence visible dans le dossier : SAS, siège 141 rue Jules Guesde à Roubaix, capital 1 000 €, résultat net 2024 3,53 k€, fonds propres 2024 4,53 k€, trésorerie 2024 101 €, annonce BODACC de dépôt des comptes le 12/02/2026. Comptes 2024 **partiellement confidentiels**.

N'utiliser ces éléments pour **aucune autre société** ; identifier d'abord son SIREN/SIRET. Ne pas confondre mandat, lien relationnel et propriété du capital ; ne pas afficher de données de bénéficiaires effectifs non autorisées.

## Contrat d'intégration attendu du deuxième agent

Proposition de route à valider dans l'API existante :

```text
GET /api/prospects/:id/relationships?includeHistorical=true
```

Chaque résultat doit contenir des nœuds entreprise/personne avec des identifiants stables, des arêtes mandat/actionnariat autorisé avec dates et statut historique, la source, l'URL, fetchedAt, l'état du cache et les erreurs. Le type client RelationshipData se trouve dans ProspectRelationshipMap.tsx. Les coordonnées x/y sont visuelles et ne doivent pas être stockées comme des faits juridiques.

À implémenter serveur :

1. Recherche et correspondance SIREN/SIRET fiable ; ambiguïtés non attribuées automatiquement.
2. Appels Pappers avec clé API **côté serveur uniquement** ; limites de consommation, coût, disponibilité et cache.
3. Déduplication par identifiants métier et mandat daté, jamais par simple similarité du nom.
4. Historique des sources, fraîcheur par champ, conflits et confirmation utilisateur avant d'écraser le CRM.
5. Respect RGPD, CGU/licences et restrictions sur les bénéficiaires effectifs.
6. Couverture exhaustive des cas vides, des erreurs, des historiques et des graphes volumineux.

## Comparatif fonctionnalités / sources

| Sujet | Déjà visible dans le dépôt | Complément demandé |
| --- | --- | --- |
| Identité INSEE | SIREN, SIRET, APE, vérifications et conflits existants | Historique de preuve et indicateurs de confiance |
| Google/Bing et PagesJaunes | Capture, fiches sources et enrichissement déjà présents | Normalisation provenance et contrôle avant insertion |
| Societe.com | Dialogue d'enrichissement déjà présent | Recette fiabilité/conditions d'accès |
| Pappers | Nouvelle carte **visuelle de référence uniquement** | Connecteur serveur entreprise + dirigeants + cartographie + actes + bilans + BODACC |
| Activités, deals, commentaire | Fonctionnel en page Prospect | Chronologie unifiée et raccourcis contextuels |
| ORBIT | Assistant IA existant en lecture seule | Recommandations explicables et actions proposées **avec validation** |
| Surveillance | Surveillance entreprise en partie existante | Changements de mandats/dirigeants, alerte BODACC, historique et coût |
| Extension collecte | Parcours d'import en place | Brouillon avant insertion, anti-doublon, source et consentement |

## Recette conjointe

- [ ] Liste → panneau latéral → bouton 360° → page complète ; retour et Escape.
- [ ] Contrôler les onglets/ancres et les panneaux existants, notamment CRUD/deals.
- [ ] Souris molette, trackpad, boutons de zoom, drag, reset, vues dirigeants/historiques et mobile.
- [ ] Un autre SIREN doit afficher une attente de données et **jamais** les liens SOLUTION ENR.
- [ ] Ancien mandat visuellement distinct d'un mandat actuel ; pièces datées et attribuées.
- [ ] Les préférences de thèmes existantes ne sont pas écrasées.
- [ ] Connecteur Pappers, quotas, sécurité, coûts et droit de consultation validés par l'agent métier.
- [ ] Conserver les documents de coordination jusqu'à l'autorisation finale explicite.
