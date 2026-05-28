---
name: GrowthOS Next.js → Vite migration
description: Key patterns and gotchas from migrating GrowthOS from Next.js to Vite+React in the pnpm monorepo
---

## Rules learned

**Routing conversion:**
- `next/link` → wouter `<Link>` (same API)
- `useRouter().push(path)` → `const [, navigate] = useLocation(); navigate(path)`
- `useParams()` stays identical in wouter v3
- wouter v3 has NO `exact` prop on `<Route>` — order routes most-specific first inside `<Switch>`

**Env vars:**
- `process.env.NEXT_PUBLIC_API_URL` → `import.meta.env.VITE_API_URL`

**Tailwind:**
- v4 uses `@import "tailwindcss"` (not `@tailwind base/components/utilities`)
- Theme tokens are CSS custom properties on `:root`, toggled via JS ThemeProvider, NOT Tailwind config

**Auth:**
- Demo login bypasses API: call `useAuthStore.setState({isAuthenticated:true, user:..., tenant:..., accessToken:'demo-token'})` directly
- Auth guard: `<RequireAuth>` wraps `<AppShell>`, redirects to `/login`

**Why:**
- Wouter v3 changed API from v2; exact prop was removed
- Tailwind v4 changed directive syntax entirely
- Next.js plugin UI-slots (`@/plugins/ui-slots`) was not ported — stubbed as no-op
