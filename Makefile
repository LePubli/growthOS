.PHONY: dev prod stop logs migrate seed shell-api shell-db ollama-pull clean

# ── Développement ─────────────────────────────────────────────
dev:
	docker compose -f docker-compose.dev.yml up -d
	@echo "✓ Infrastructure lancée"
	@echo "  PostgreSQL : localhost:5432"
	@echo "  Redis      : localhost:6379"
	@echo "  Ollama     : localhost:11434"
	npm run dev

# ── Production ────────────────────────────────────────────────
prod:
	./infrastructure/scripts/deploy.sh prod

# ── Stop ─────────────────────────────────────────────────────
stop:
	docker compose down

# ── Logs ─────────────────────────────────────────────────────
logs:
	docker compose logs -f api

logs-all:
	docker compose logs -f

# ── Database ──────────────────────────────────────────────────
migrate:
	cd apps/api && npx prisma migrate deploy

migrate-dev:
	cd apps/api && npx prisma migrate dev

seed:
	cd apps/api && npx ts-node prisma/seed.ts

db-studio:
	cd apps/api && npx prisma studio

# ── Shells ────────────────────────────────────────────────────
shell-api:
	docker compose exec api sh

shell-db:
	docker compose exec postgres psql -U growthos -d growthos

# ── Ollama ────────────────────────────────────────────────────
ollama-pull:
	./infrastructure/scripts/setup-ollama.sh $(MODEL)

ollama-models:
	curl -s http://localhost:11434/api/tags | python3 -c "import sys,json; [print(m['name']) for m in json.load(sys.stdin).get('models',[])]"

# ── Plugins ───────────────────────────────────────────────────
plugin-zip:
	cd plugins/$(NAME) && zip -r ../../$(NAME).zip . -x "*/node_modules/*" -x "*/.git/*"
	@echo "✓ plugins/$(NAME).zip créé"

# ── Tests ─────────────────────────────────────────────────────
test:
	cd apps/api && npm test

test-e2e:
	cd apps/api && npm run test:e2e

# ── Clean ─────────────────────────────────────────────────────
clean:
	docker compose down -v
	rm -rf apps/api/dist apps/web/.next
	@echo "✓ Nettoyage terminé"
