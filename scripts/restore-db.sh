#!/usr/bin/env bash
# =============================================================
# GrowthOS — Restauration PostgreSQL
# Usage : ./scripts/restore-db.sh <chemin_vers_backup.sql.gz>
# =============================================================
set -euo pipefail

BACKUP_FILE="${1:-}"

if [[ -z "${BACKUP_FILE}" ]]; then
  echo "Usage : $0 <chemin_vers_backup.sql.gz>" >&2
  echo ""
  echo "Backups disponibles dans ./backups :"
  ls -lh ./backups/growthos_*.sql.gz 2>/dev/null || echo "  (aucun backup trouvé)"
  exit 1
fi

if [[ ! -f "${BACKUP_FILE}" ]]; then
  echo "❌ Erreur : fichier introuvable : ${BACKUP_FILE}" >&2
  exit 1
fi

# Charger .env si présent et DATABASE_URL non déjà défini
if [[ -z "${DATABASE_URL:-}" ]] && [[ -f ".env" ]]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | grep 'DATABASE_URL\|PG' | xargs)
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "❌ Erreur : DATABASE_URL n'est pas défini." >&2
  exit 1
fi

echo "⚠️  ATTENTION : Cette opération va écraser la base de données actuelle."
echo "   Backup source : ${BACKUP_FILE}"
echo "   Cible         : ${DATABASE_URL//:*@/:***@}"
echo ""
read -r -p "Confirmer la restauration ? [oui/NON] : " CONFIRM

if [[ "${CONFIRM}" != "oui" ]]; then
  echo "Restauration annulée."
  exit 0
fi

echo "🔄 Restauration en cours..."
gunzip -c "${BACKUP_FILE}" | psql "${DATABASE_URL}" --no-password

echo "✅ Restauration terminée depuis ${BACKUP_FILE}"
