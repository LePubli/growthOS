-- ============================================================
-- GrowthOS — Init PostgreSQL
-- Exécuté au premier démarrage du container PostgreSQL
-- ============================================================

-- Extensions requises
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- Pour les recherches fuzzy

-- Schema public déjà créé par défaut

-- Permissions
GRANT ALL PRIVILEGES ON DATABASE growthos TO growthos;
GRANT ALL ON SCHEMA public TO growthos;

-- Logs
SELECT 'GrowthOS database initialized' AS status;
