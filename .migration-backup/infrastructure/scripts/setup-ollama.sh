#!/bin/bash
# ============================================================
# GrowthOS — Setup Ollama local
# Lance ce script après le démarrage d'Ollama
# ============================================================

OLLAMA_HOST=${OLLAMA_HOST:-http://localhost:11434}

echo "🤖 GrowthOS — Setup Ollama"
echo "Host: $OLLAMA_HOST"
echo ""

# Attendre Ollama
echo "⏳ Attente du démarrage d'Ollama..."
until curl -s "$OLLAMA_HOST/api/tags" > /dev/null 2>&1; do
  sleep 2
done
echo "✓ Ollama opérationnel"
echo ""

# Modèles recommandés selon les ressources
echo "📦 Modèles disponibles par niveau de ressources :"
echo ""
echo "  💻 CPU seulement (min 8GB RAM) :"
echo "     llama3.2        3.8GB  — Bon équilibre performance/taille"
echo "     mistral         4.1GB  — Excellent pour le français"
echo "     phi4            2.4GB  — Rapide et léger"
echo ""
echo "  🖥️ CPU puissant / GPU (16GB+ RAM) :"
echo "     llama3.1:8b     4.7GB  — Meilleure qualité"
echo "     qwen2.5:7b      4.4GB  — Très bon en multilangue"
echo "     deepseek-r1     4.7GB  — Excellent pour le raisonnement"
echo ""
echo "  🚀 GPU (24GB+ VRAM) :"
echo "     llama3.1:70b    40GB   — Qualité GPT-4 niveau"
echo "     qwen2.5:32b     19GB   — Meilleur modèle local"
echo ""

# Pull du modèle par défaut
DEFAULT_MODEL=${1:-llama3.2}

echo "🔄 Téléchargement du modèle: $DEFAULT_MODEL"
curl -s -X POST "$OLLAMA_HOST/api/pull" \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$DEFAULT_MODEL\", \"stream\": false}" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  print('✓ Modèle prêt:', data.get('status', 'ok'))
except:
  print('✓ Téléchargement en cours...')
"

echo ""
echo "📋 Modèles installés :"
curl -s "$OLLAMA_HOST/api/tags" | python3 -c "
import sys, json
try:
  data = json.load(sys.stdin)
  models = data.get('models', [])
  for m in models:
    size = m.get('size', 0) / (1024**3)
    print(f'  ✓ {m[\"name\"]} ({size:.1f}GB)')
  if not models:
    print('  Aucun modèle installé')
except Exception as e:
  print('  Erreur:', e)
"

echo ""
echo "✅ Ollama configuré ! Variables à ajouter dans .env :"
echo ""
echo "   OLLAMA_HOST=$OLLAMA_HOST"
echo "   OLLAMA_DEFAULT_MODEL=$DEFAULT_MODEL"
echo ""
echo "🚀 Tester avec :"
echo "   curl $OLLAMA_HOST/api/chat -d '{\"model\":\"$DEFAULT_MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"Bonjour !\"}],\"stream\":false}'"
