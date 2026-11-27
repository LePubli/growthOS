# Sources B2B France : audit et intégration après validation du socle

Demande du propriétaire, 27 novembre 2026 : « Une fois que le système actuel fonctionnera », analyser le catalogue et ajouter les sources pour la recherche et l’enrichissement.

## Déclenchement

L’audit individuel et les nouveaux connecteurs attendent la recette fonctionnelle du système actuel en préproduction et sa validation par le propriétaire. Une CI verte ou un conteneur « running » ne remplacent pas cette recette. Aucune date de lancement ni validation utilisateur n’est présumée.

Le présent lot conserve le catalogue et prépare le travail. Il n’active aucune source, ne change pas le logiciel ni son thème, n’engage aucun abonnement et ne nécessite aucun redéploiement. Il reste sur une branche documentaire distincte pour préserver les images préprod déjà livrées.

## Inventaire préparé

- [Catalogue fourni, conservé à l’identique](CATALOGUE-B2B-FRANCE-FOURNI.md).
- [Registre de suivi des 306 entrées](REGISTRE-SOURCES-B2B-FRANCE.csv).
- 287 URL déclaratives distinctes après normalisation de forme uniquement. Ce nombre ne constitue pas un décompte de fournisseurs indépendants ni de connecteurs faisables.
- 14 entrées renvoient à des adaptateurs déjà présents dans le code. Leur disponibilité réelle reste à revalider ; les réseaux en navigation/saisie assistée ne sont pas présentés comme automatisés.
- Les doublons d’URL sont reliés sans supprimer les entrées ni leurs particularités. Une URL commune peut désigner un alias, un réseau ou plusieurs services : qualification à faire pendant l’audit.
- Toutes les entrées restent `en_attente_recette_du_socle`, avec accès non vérifié, décision non prise et priorité non définie.

Empreinte SHA-256 du fichier fourni : `afb05b55868089afeed7c5d820e5dfac28eb6d7ee24b4d63268d87c1f62f6291`.

## Audit attendu pour chaque source

1. Vérifier la source sur ses pages officielles et sa documentation actuelle : URL, existence d’un répertoire exploitable, couverture et fraîcheur. Un média ou une fédération n’est pas automatiquement un annuaire.
2. Constater la voie d’accès réellement disponible : API officielle, fichiers ouverts, export autorisé, compte utilisateur, navigateur intégré, consultation manuelle ou absence d’accès exploitable. Conserver liens de preuve et date de vérification.
3. Relever authentification, coûts, quotas, droits d’extraction, stockage et réutilisation, contraintes et maintenance. Éviter les intermédiaires commerciaux ; aucun achat ni dépendance payante n’est engagé par cet audit. Les données réglementées ne deviennent pas accessibles par simple ajout au catalogue.
4. Évaluer séparément les capacités : **recherche de nouveaux prospects**, **identification légale**, **enrichissement d’un prospect existant**, **qualification sectorielle** et **signaux commerciaux**. Une source ne proposant qu’une partie des fonctions ne doit pas afficher des boutons inopérants pour les autres.
5. Tester les champs réellement obtenus sur des exemples documentés, y compris données absentes, homonymes, établissements distincts et dossiers fermés. Ne pas transformer une mention indicative du catalogue en capacité confirmée.
6. Définir le rapprochement : SIRET pour l’établissement, SIREN pour l’unité légale ; sinon plusieurs indices concordants. Distinguer l’ancien établissement, le siège actuel et les informations historiques. Refuser une identité ambiguë ou contradictoire.
7. Conserver provenance, URL de preuve, date, portée, qualité et confiance par champ. Les données INSEE republiées par plusieurs sites ne sont pas plusieurs confirmations indépendantes.
8. Chiffrer valeur, couverture, qualité, coût et effort de maintenance puis proposer l’ordre d’intégration. Aucune priorité de fournisseur n’est imposée à ce stade.

## Fiche technique à produire après audit

Pour chaque source : `source_id`, entrées d’origine et alias, nom, catégorie, couverture, secteurs, URL actuelle, documentation/API, méthode d’accès vérifiée, authentification, coût, quotas, licence et droits de réutilisation, fréquence, champs constatés, limites, rapprochement, confiance, provenance, date de vérification, dernier test, capacités recherche/enrichissement/signaux, effort, décision, priorité motivée et motif d’indisponibilité ou de refus.

Le registre CSV actuel est un pointage de départ ; les champs encore inconnus restent vides ou explicitement non vérifiés. L’audit détaillé ne sera pas annoncé comme terminé avant les vérifications individuelles.

## Intégration dans GrowthOS après qualification

- Réutiliser le parcours de recherche et les tâches persistantes existants, les filtres géographiques, les sélections en lot, la pagination/reprise, la détection des doublons et les reçus d’import CRM.
- Raccorder les sources d’enrichissement admissibles au bouton de la fiche et à l’onglet **Enrichissements**, avec progression, bilan par source, désaccords et journal avant/après.
- Utiliser l’API native ou les données ouvertes quand elles conviennent, sinon un adaptateur de navigateur par source. Les comptes restent isolés par utilisateur/agence ; Chrome conserve son rôle de secours externe.
- Ajouter uniquement les capacités effectivement implémentées et testées au catalogue. Pour une source indisponible ou nécessitant un contrat, afficher son état réel plutôt qu’une promesse d’automatisation.
- Livrer par lots indépendants, préserver le thème et les modifications de l’autre agent, documenter dans le suivi et ne pas écraser la branche partagée.

## Conditions de validation d’un connecteur

Recherche et/ou enrichissement réellement exécutés selon les capacités annoncées ; sélection/import et dédoublonnage corrects ; homonyme et autre établissement rejetés ; champs absents non inventés ; reprise sans perte ni doublon ; isolation des agences ; traçabilité des changements ; panne ou accès restreint signalés sans bloquer les autres sources. Vérifier les limites observées en situation réelle, pas uniquement les fixtures.

Après chaque lot : contrôles appropriés, synchronisation de la branche commune et publication vérifiée des images nécessaires avant d’annoncer le feu vert de redéploiement. Le propriétaire déploie et réalise la recette. Les notes temporaires de coordination restent conservées jusqu’à son autorisation de lancement final en production.
