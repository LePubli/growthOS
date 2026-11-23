# PagesJaunes — navigateur auto-hébergé pour GrowthOS

Ce connecteur n'utilise aucun service de scraping externe. Le moteur Chromium
tourne dans **son propre conteneur Docker**, créé par GitHub Actions. Il n'est
pas installé sur le système hôte.

## Mise en place unique dans DockPanel

Dans **Docker Apps > growthos-preprod > Edit**, conserver la base PostgreSQL,
l'API et le web existants. Ajouter **uniquement** les lignes ci-dessous aux
services concernés :

```yaml
services:
  api-server:
    environment:
      PAGESJAUNES_BROWSER_URL: "http://pagesjaunes-browser:3199"

  pagesjaunes-browser:
    image: ghcr.io/lepubli/growthos-pagesjaunes:preprod
    pull_policy: always
    restart: unless-stopped
    init: true
    cpus: "1.0"
    mem_limit: 1g
    pids_limit: 128
    shm_size: 256m
    read_only: true
    tmpfs:
      - /tmp:size=256m,mode=1777
    security_opt:
      - no-new-privileges:true
    cap_drop:
      - ALL
    expose:
      - "3199"
```

**Attention :** cet exemple est un *extrait à fusionner* dans le YAML existant,
pas un stack Compose complet à coller à la place du stack en production. Ne pas
publier de port `3199` sur Internet. Le conteneur et l'API communiquent sur le
réseau privé du même Compose.

Ne pas exposer PostgreSQL ou l'API du système via un nouveau port. Garder les
limites déjà appliquées aux trois services GrowthOS et les volumes existants.

## Contrôles après installation

1. Les quatre services sont `running` dans DockerPanel.
2. Dans `GrowthOS > Trouver des entreprises`, l'état PagesJaunes indique
   **Navigateur Chromium privé connecté**.
3. Tester une recherche avec l'Annuaire + PagesJaunes, sur un seul code postal
   et un maximum de cinq résultats.
4. Si la source PagesJaunes affiche encore 403, elle bloque probablement aussi
   l'adresse IP du VPS (ou impose un contrôle humain). Le navigateur seul ne
   peut pas garantir de résoudre ces protections.

## Économie des ressources

- Un seul navigateur traite une recherche à la fois ; aucun navigateur n'est
  lancé tant qu'aucune recherche n'est effectuée.
- Le navigateur Chromium est fermé après 60 secondes d'inactivité.
- Le conteneur reste au maximum à **1 vCPU, 1 Gio de RAM**.
- Aucune donnée personnelle ni capture n'est persistée par ce conteneur.

## Retour arrière

Dans DockerPanel, retirer `PAGESJAUNES_BROWSER_URL` de `api-server` et supprimer
seulement le service `pagesjaunes-browser`, puis mettre à jour le stack. Les
prospects, les volumes PostgreSQL et les autres applications ne sont pas
modifiés.
