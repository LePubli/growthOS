# Régressions des sources publiques — 27 novembre 2026

`annuaire-nord-artisan.json` : sous-ensemble de la réponse publique https://recherche-entreprises.api.gouv.fr/search?q=Nord%20Artisan&code_postal=59800&per_page=25&limite_matching_etablissements=100 . Ne contient que les champs nécessaires à la régression : siège actif 00020, ancien établissement fermé 00012, complément BUREAU 3.

Les cartes Societe.com du test Chromium reprennent la structure DOM observée le 27/11 sur https://www.societe.com/recherche?q=Nord%20Artisan&ftStatus=0 : lien superposé vide avec aria-label, titre séparé, ville dans un paragraphe. Les noms de personnes des tests sont fictifs. Le test Cloudflare reproduit seulement le texte de blocage observé, ne résout aucun challenge.
