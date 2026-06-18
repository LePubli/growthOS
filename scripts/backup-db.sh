#!/usr/bin/env bash
# =============================================================
# GrowthOS — Backup PostgreSQL
# Usage : ./scripts/backup-db.sh [répertoire_de_backup]
# =============================================================
set -euo pipefail

# Répertoire de destination (par défaut : ./backups)
BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
BACKUP_FILE="${BACKUP_DIR}/growthos_${TIMESTAMP}.sql.gz"

# Charger .env si présent et DATABASE_URL non déjà défini
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f ".env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | grep 'DATABASE_URL\|PG' | xargs)
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ Erreur : DATABASE_URL n'est pas défini." >&2
  echo "   Définissez-la en variable d'environnement ou dans un fichier .env" >&2
  exit 1
fi

# Créer le répertoire si nécessaire
mkdir -p "${BACKUP_DIR}"

echo "🗄️  Backup GrowthOS → ${BACKUP_FILE}"
pg_dump "${DATABASE_URL}" \
  --no-password \
  --format=plain \
  --no-acl \
  --no-owner \
  | gzip > "${BACKUP_FILE}"

SIZE="$(du -sh "${BACKUP_FILE}" | cut -f1)"
echo "✅ Backup terminé : ${BACKUP_FILE} (${SIZE})"

# Purge automatique : garder seulement les 30 derniers backups
find "${BACKUP_DIR}" -name "growthos_*.sql.gz" -type f \
  | sort -r \
  | tail -n +31 \
  | xargs -r rm --
echo "🧹 Rotation : anciens backups (>30) supprimés si présents."
