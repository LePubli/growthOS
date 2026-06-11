---
name: GrowthOS E2E Test Conventions
description: Pièges récurrents dans les tests E2E GrowthOS — méthodes runner, JWT, colonnes DB
---

# GrowthOS E2E Test Conventions

## État actuel
324 tests / 33 suites — 100% passants.

## Pièges critiques

### 1. `suite.getResults()` pas `suite.results()`
La méthode sur `TestSuite` est `getResults()`. Toute nouvelle suite doit terminer par `return suite.getResults()`.

**Why:** `suite.results()` n'existe pas — throw TypeError silencieux qui fait planter le runner.

### 2. JWT doit inclure `role` dans setup.ts
`signAccessToken({ userId, tenantId, email, role: "admin" })` — le champ `role` est obligatoire pour les routes avec `requireRole`.

**Why:** Sans `role`, `req.auth?.role` est `undefined`, le fallback est `"member"`, et toute route `requireRole("admin")` retourne 403 même avec un token valide.

### 3. Table `users` — pas de colonne `is_active`
La table users a : `id, email, password_hash, first_name, last_name, role, tenant_id, created_at, updated_at`. Utiliser `true` hardcodé pour `isActive` dans les SELECT.

### 4. Table `erep_alerts` — colonnes réelles
- `type` (pas `alert_type`)
- `title` + `description` (pas `message`)
- `tenant_id` direct (pas besoin de JOIN campaigns pour filtrer)
- Pas de colonne `source_url` ni `resolved_at`

### 5. Table `sequences` — `status = 'active'` (pas `is_active`)
Pour compter les séquences actives : `COUNT(*) FILTER (WHERE status = 'active')`.

### 6. `requireRole` portail client
`router.use(requireRole("client", "admin"))` — ne pas inclure `"member"`. Les admins passent toujours grâce au short-circuit `role === "admin"` dans le middleware.

## Pattern test isolation
```typescript
const ctx2 = await createTestContext(); // tenant vide
const r = await client.get("/route", ctx2.adminToken); // note: adminToken pas userToken
assert.equal(r.body.count, 0);
await ctx2.cleanup();
```

**Why:** `userToken` a `role: "commercial"` — il sera bloqué par `requireRole("admin")`. Utiliser `adminToken` pour tester l'isolation sur des routes admin.
