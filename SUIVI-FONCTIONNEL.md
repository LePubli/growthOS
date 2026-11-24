# GrowthOS — suivi fonctionnel

Mis à jour le **24 novembre 2026**. Ce registre suit le parcours d’une agence qui cherche des entreprises, les qualifie, propose un site ou une prestation SEO, puis suit l’affaire dans le CRM.

**Prochain contrôle en préproduction** — sur une ancienne fiche qui possède déjà un code APE, retrouver la dénomination officielle, puis chercher quelques mots de cette dénomination dans Prospects. Version de référence pour les validations précédentes : `f6c967e`. Le lot CRM et sources est sur `feat/recette-crm-sources`.

## Comment tenir ce fichier

À chaque changement fonctionnel, mettre à jour la ligne correspondante dans la même PR. Ajouter la date, la version ou le lien du test, son environnement, le résultat observé et le prochain contrôle. Si le contrôle échoue, inscrire le symptôme et rouvrir la ligne. Pour ajouter une source, tester une création, un réimport, un homonyme et une collecte vide. Utiliser des données de test pour les captures et les journaux.

| État | Preuve attendue |
|---|---|
| Validé en usage | Parcours exécuté en préproduction et résultat relu après actualisation. La validation porte sur le scénario nommé. |
| Testé en isolation | Contrôle reproductible sur une base ou un navigateur de test. Mentionner les fournisseurs simulés. |
| À vérifier | Code présent ou essai rapporté, recette réelle encore incomplète. |
| À développer | Fonction absente ou parcours bloqué. Mettre en œuvre le mécanisme manquant avant recette. |

## Sourcing et CRM

| Point | Fait et preuve | Reste à vérifier pour clôturer |
|---|---|---|
| 01 · Annuaire des Entreprises | Import essayé en usage. La suite vérifie la sélection, l’établissement local et le filtre géographique. | Comparer siège et établissement dans deux départements. Vérifier le choix explicite des résultats. |
| 02 · PagesJaunes | Collecte et détails essayés par l’utilisateur. En isolation, téléphone, horaires, provenance et réimport vérifiés. | Vérifier sur une fiche actuelle les données réellement présentes, puis le comportement si le site est indisponible. |
| 03 · Google Maps vers Prospects | **Validé en usage le 24/11** pour la capture, l’import et la relecture. La PR 28 inclut sélection par lots de 25, parcours continu et reprise des fiches restantes. | Chronométrer un vrai lot de plus de 25 avec interruption volontaire et vérifier le décompte final. |
| 04 · Google Search | Capture essayée. Le connecteur conserve en brouillon une adresse incomplète. | Comparer la fiche avant et après enrichissement et vérifier qu’une fiche traitée quitte la sélection. |
| 05 · Bing | Capture d’une carte simulée et import dans le CRM testés. | Ouvrir un résultat local réel, contrôler nom/adresse avant import, puis réimporter et essayer un homonyme. |
| 06 · LinkedIn | Saisie assistée d’une page entreprise. Prévisualisation et réimport testés avec une URL de test. | Depuis un compte Chrome, confirmer une page entreprise, contrôler la provenance sur le prospect et essayer un homonyme. |
| 07 · Societe.com | Saisie assistée depuis une fiche société. Le SIREN provient du lien et le SIRET saisi est contrôlé contre ce SIREN. | Rapprocher une entreprise déjà connue, essayer deux établissements proches et vérifier la décision proposée. |
| 08 · Facebook Pages | Confirmation manuelle d’une page professionnelle et conservation de son URL dans l’historique. | Tester une page d’agence réelle, une page de même nom et un lien vers une publication. |
| 09 · Instagram professionnel | Confirmation manuelle du profil et import testés sur données fictives. | Vérifier dans Chrome le propriétaire du compte, la prévisualisation, le réimport et le rejet d’un lien de publication. |
| 10 · TikTok professionnel | À développer après la recette Facebook et Instagram. | Définir les renseignements utiles, confirmer le lien de l’entreprise, couvrir doublons et profils ambigus. |
| 11 · Secteur APE / NAF | Référentiels Insee intégrés. Résolution du libellé dans les aperçus et le CRM, recalcul des fiches existantes. Tri et recherche par activité couverts côté API. | Sur une ancienne fiche puis sur un nouvel import, comparer le libellé à l’Insee. Vérifier le filtre par mots du libellé et le cas d’un code inconnu. |
| 12 · Doublons et conflits | Tests de fusion de champs absents, conservation des valeurs en conflit et arbitrage. | Vérifier les homonymes, les établissements d’un même SIREN, puis deux imports simultanés du même prospect. |
| 13 · Prospect et pipeline | **Validé en usage le 24/11** pour l’enregistrement d’une note et la persistance du changement d’étape. | Élargir la recette aux contacts, aux comptes, aux modifications et aux droits d’un second utilisateur. |
| 14 · Historique des notes | Test sur un prospect et deux deals. Note générale consultable depuis les deux affaires ; note d’affaire liée à son deal dans l’historique du prospect ; édition du même enregistrement. | Rejouer création et édition dans les écrans de préproduction, puis contrôler les deux affaires après actualisation. |
| 15 · Import CSV, carte et export | Cas de doublons CSV couverts dans le test d’installation. | Vérifier les colonnes, les accents, la pagination de l’export et les adresses sans coordonnées. |
| 16 · Ergonomie de sourcing | Sélection de sources, régions, départements et codes postaux présente. | Tester retour/reprise, absence de résultats, source indisponible et import direct sans perdre les autres sources du lot. |

## Autres fonctions à rendre opérationnelles

| Point | Situation actuelle | Critère de clôture |
|---|---|---|
| 17 · Installation, connexion, paramètres et équipe | Assistant et création du premier compte testés en isolation. | Refaire la première installation et la reconnexion depuis un navigateur, puis vérifier rôles, invitations et refus d’accès entre comptes. |
| 18 · Audit de site et SEO | Collecteur HTTPS et contrôles de lecture en place. | Comparer au HTML d’un vrai site son titre, H1, description, canonical et indexation. Tester aussi un échec réseau. |
| 19 · IA, assistant commercial, coach et mémoire | Tests fournisseurs simulés. Les clés de test réelles restent à utiliser. | Exécuter un cas reproductible pour Claude, OpenAI et DeepSeek, vérifier le contexte du bon prospect, les quotas et le traitement d’une erreur. |
| 20 · Enrichissement et intelligence contact | Adaptateurs présents, couverture fournisseur partielle. | Vérifier chaque fournisseur activé, sa clé, sa provenance et le coût. Afficher clairement les données manquantes. |
| 21 · Séquences, modèles, SMTP et réponses | Les brouillons sont disponibles. Moteur d’envoi à compléter. | Vérifier destinataire de test, planification, arrêt sur réponse ou opposition, désabonnement, quotas et absence de double envoi à la reprise. |
| 22 · Workflows, autopilot et webhooks | Brouillons et définitions présents. Exécution et relances à terminer ou à démontrer. | Un événement de test déclenche exactement l’action prévue. Simuler une panne, reprendre et consulter l’historique. |
| 23 · Activités, tâches, réunions et calendrier | Activités CRM partiellement testées. Transcription à implémenter. | Planifier, modifier et terminer une tâche, relire au calendrier ; produire une transcription d’essai avec gestion d’erreur. |
| 24 · E-réputation et portail client | Parcours partiels. Veille, collecte sociale et réseau de sites à raccorder ou à qualifier. | Suivre une campagne, tracer l’origine d’une mesure et vérifier validation et accès avec deux clients distincts. |
| 25 · Tableaux de bord, analytics, signaux, ABM, revenus, rapports et objectifs | Couverture métier à établir. | Retrouver dans les indicateurs une opération chiffrée connue ; vérifier période, compte, droits et état vide. |
| 26 · Acquisition entrante, propositions et parrainage | Plusieurs écrans indiquent une indisponibilité. | Enregistrer un lead de test, rattacher une proposition persistante au deal et tracer un parrainage de bout en bout. |
| 27 · Intégrations, CRM externes, API, plugins et marketplace | Connecteurs et configuration partiels. | Tester une connexion, un échange, la révocation et l’isolation de chaque intégration proposée. |
| 28 · Facturation, plans, quotas et administration | Parcours de paiement à vérifier. | Dans un environnement fournisseur de test, couvrir abonnement, facture, annulation et contrôle de quota avec les bons rôles. |
| 29 · Travail en équipe, base de connaissances et partage | Comptes, contacts, documents et tableaux partagés à vérifier par rôle. | Créer une ressource, la partager avec un utilisateur autorisé, révoquer l’accès et vérifier les droits. |
| 30 · Sécurité, SSO, conformité et journaux | Des tests techniques existent. La couverture complète reste ouverte. | Vérifier les accès entre agences, la révocation des clés, l’export/suppression des données et la traçabilité des mutations. |
| 31 · Exploitation et reprise | Images de préproduction déjà publiées pour la PR 28. | Restaurer une sauvegarde sur une base isolée, mesurer la reprise et vérifier la persistance et la version après relance. |
| 32 · Navigation, mobile et accessibilité | Recette visuelle incomplète. | Tester chaque parcours exposé sur ordinateur et mobile, au clavier, puis en état vide, lent et en erreur. |

## Journal des preuves

- **22/11/2026** — audits initiaux et limites détaillées. [État de validation](AUDIT_STATUS.md) · [Remise en état de la préproduction](docs/PREPROD-REMISE-EN-ETAT.md).
- **24/11/2026** — PR 28 fusionnée. Images web/API et ZIP Chrome produits. L’utilisateur a confirmé capture Maps, import, note persistante et changement d’étape persistant. [PR 28](https://github.com/LePubli/growthOS/pull/28) · [CI des images](https://github.com/LePubli/growthOS/actions/runs/45359612117) · [Paquet Chrome](https://github.com/LePubli/growthOS/actions/runs/45359611980).
- **24/11/2026 · lot CRM et sources** — Compilation web et API, vérification TypeScript et tests du connecteur. Test d’intégration exécuté sur PostgreSQL 16.14 isolé avec sources externes simulées. Les contrôles ajoutés couvrent la nomenclature, les notes partagées et la répétition d’un import de chacune des cinq sources. [Suite API](scripts/smoke-wizard.mjs) · [Tests du connecteur](scripts/test-multisource-extension.mjs) · [Catalogue des activités](lib/db/src/naf.ts).
- **Prochaine revue** — compléter d’abord les points 11 et 14 sur cette version, puis 05 à 09 source par source. Ajouter une preuve datée par résultat. La validation globale reste ouverte jusqu’à la recette des parcours et de la restauration.
