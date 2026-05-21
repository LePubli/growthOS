#!/bin/bash
# ============================================================
# GrowthOS — Script de déploiement complet
# Ubuntu 24 + Docker + Coolify
# Usage: ./deploy.sh [dev|prod]
# ============================================================

set -e

MODE=${1:-prod}
REPO_URL="https://github.com/LePubli/growthos"
APP_DIR="/opt/growthos"
COMPOSE_FILE="docker-compose.yml"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
info()    { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $1"; }
error()   { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

echo ""
echo "  ██████╗ ██████╗  ██████╗ ██╗    ██╗████████╗██╗  ██╗ ██████╗ ███████╗"
echo " ██╔════╝ ██╔══██╗██╔═══██╗██║    ██║╚══██╔══╝██║  ██║██╔═══██╗██╔════╝"
echo " ██║  ███╗██████╔╝██║   ██║██║ █╗ ██║   ██║   ███████║██║   ██║███████╗"
echo " ██║   ██║██╔══██╗██║   ██║██║███╗██║   ██║   ██╔══██║██║   ██║╚════██║"
echo " ╚██████╔╝██║  ██║╚██████╔╝╚███╔███╔╝   ██║   ██║  ██║╚██████╔╝███████║"
echo "  ╚═════╝ ╚═╝  ╚═╝ ╚═════╝  ╚══╝╚══╝    ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚══════╝"
echo ""
info "Déploiement GrowthOS — Mode: $MODE"
echo ""

# ── 1. Prérequis ────────────────────────────────────────────────
info "Vérification des prérequis..."

check_cmd() { command -v "$1" &>/dev/null && success "$1 ✓" || error "$1 manquant — installez-le d'abord"; }
check_cmd docker
check_cmd docker-compose 2>/dev/null || check_cmd "docker compose"

# ── 2. Répertoire ────────────────────────────────────────────────
info "Préparation du répertoire..."
mkdir -p $APP_DIR && cd $APP_DIR
success "Répertoire: $APP_DIR"

# ── 3. .env ─────────────────────────────────────────────────────
if [ ! -f .env ]; then
  warn ".env manquant — création depuis .env.example"
  if [ -f .env.example ]; then
    cp .env.example .env
    warn "⚠️  EDITEZ .env avant de continuer : nano .env"
    warn "   Notamment : POSTGRES_PASSWORD, JWT_SECRET, ADMIN_PASSWORD"
    read -p "Appuyez sur Entrée après avoir configuré .env..."
  else
    error ".env.example introuvable"
  fi
fi
success ".env ✓"

# Charge les variables
export $(grep -v '^#' .env | xargs) 2>/dev/null || true

# ── 4. Génération JWT_SECRET si manquant ────────────────────────
if [ -z "$JWT_SECRET" ] || [ "$JWT_SECRET" = "CHANGE_ME_64_CHARS_MIN_RANDOM_SECRET" ]; then
  JWT_SEC=$(openssl rand -hex 32)
  sed -i "s/JWT_SECRET=.*/JWT_SECRET=$JWT_SEC/" .env
  info "JWT_SECRET généré automatiquement"
fi

# ── 5. Pull / Build images ───────────────────────────────────────
info "Construction des images Docker..."

if [ "$MODE" = "dev" ]; then
  docker compose -f docker-compose.dev.yml pull --quiet
  docker compose -f docker-compose.dev.yml build --parallel
else
  docker compose pull --quiet 2>/dev/null || true
  docker compose build --parallel --no-cache
fi
success "Images construites ✓"

# ── 6. Stop services existants ───────────────────────────────────
info "Arrêt des services existants..."
docker compose down --remove-orphans 2>/dev/null || true
success "Services arrêtés ✓"

# ── 7. Démarrage infrastructure ──────────────────────────────────
info "Démarrage PostgreSQL + Redis + MinIO..."
docker compose up -d postgres redis minio
info "Attente PostgreSQL..."
sleep 8
until docker compose exec -T postgres pg_isready -U "$POSTGRES_USER" -d growthos &>/dev/null; do
  sleep 2; echo -n "."
done
echo ""
success "PostgreSQL prêt ✓"

# ── 8. Migrations ────────────────────────────────────────────────
info "Exécution des migrations Prisma..."
docker compose run --rm migrate 2>&1 | tail -5
success "Migrations terminées ✓"

# ── 9. Démarrage complet ─────────────────────────────────────────
info "Démarrage de tous les services..."
docker compose up -d
success "Services démarrés ✓"

# ── 10. Ollama setup ─────────────────────────────────────────────
if docker compose ps ollama 2>/dev/null | grep -q "running"; then
  info "Configuration d'Ollama..."
  sleep 5
  DEFAULT_MODEL=${OLLAMA_DEFAULT_MODEL:-llama3.2}
  docker compose exec -T ollama ollama pull $DEFAULT_MODEL 2>/dev/null &
  info "Téléchargement de $DEFAULT_MODEL en arrière-plan..."
fi

# ── 11. Health check ─────────────────────────────────────────────
info "Vérification de la santé des services..."
sleep 10

API_PORT=${PORT:-3001}
WEB_PORT=3000
MAX_TRIES=30; tries=0

until curl -sf "http://localhost:$API_PORT/api/v1/health" &>/dev/null; do
  sleep 2; tries=$((tries+1))
  [ $tries -ge $MAX_TRIES ] && { warn "API timeout — vérifiez les logs: docker compose logs api"; break; }
  echo -n "."
done
echo ""
success "API opérationnelle ✓"

# ── 12. Rapport final ─────────────────────────────────────────────
SERVER_IP=$(curl -sf ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')

echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║            🚀 GROWTHOS DÉPLOYÉ AVEC SUCCÈS             ║"
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Frontend   : http://$SERVER_IP:$WEB_PORT              "
echo "║  API        : http://$SERVER_IP:$API_PORT/api/v1       "
echo "║  API Docs   : http://$SERVER_IP:$API_PORT/api/docs     "
echo "║  MinIO UI   : http://$SERVER_IP:9001                   "
echo "║  Ollama     : http://$SERVER_IP:11434                  "
echo "╠════════════════════════════════════════════════════════╣"
echo "║  Admin      : $ADMIN_EMAIL                             "
echo "║  Mode       : $MODE                                    "
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "Logs : docker compose logs -f api"
echo "Stop : docker compose down"
echo ""
