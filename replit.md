# GrowthOS

GrowthOS is a French B2B SaaS growth intelligence platform — CRM, prospecting, email sequences, signals, pipeline, analytics, plugins, themes, and workflows — migrated from Next.js to a Vite + React artifact in this pnpm monorepo.

## Run & Operate

- `pnpm --filter @workspace/growthos run dev` — run GrowthOS frontend (port 20945, preview at `/`)
- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- **Frontend**: React + Vite, Tailwind CSS v4, wouter (routing), Zustand (auth store), @tanstack/react-query, sonner (toasts), lucide-react, recharts
- **API client**: Axios with auto-refresh interceptors
- Theme system: CSS custom properties (`--color-primary`, `--sidebar-bg`, etc.) toggled via ThemeProvider

## Where things live

- `artifacts/growthos/src/` — main React app
  - `App.tsx` — all routes (wouter Switch)
  - `components/layout/AppShell.tsx` — sidebar nav + header
  - `providers/theme-provider.tsx` — 7 built-in themes, CSS vars on `<html>`
  - `stores/auth.store.ts` — Zustand persist store (login/register/logout)
  - `lib/api-client.ts` — Axios instance with 401 refresh + tenant header
  - `pages/` — one file per route (Dashboard, Prospects, Pipeline, Sequences, Signals, Sourcing, Plugins, Workflows, Themes, Settings/*)
- `.migration-backup/apps/web/` — original Next.js source (reference only)

## Architecture decisions

- `next/link` → wouter `<Link>`; `useRouter().push()` → wouter `useLocation()` setter; `useParams()` stays identical
- `process.env.NEXT_PUBLIC_API_URL` → `import.meta.env.VITE_API_URL`
- `@/plugins/ui-slots` (Next.js plugin system) → stubbed out (not ported)
- Auth guard via `<RequireAuth>` wrapping `<AppShell>` — unauthenticated users redirected to `/login`
- Demo mode: "Accès démo" button on login sets Zustand state directly without API call

## Product

- Login / Register (+ demo mode without backend)
- Dashboard with customizable widgets, recent prospects, quick actions
- CRM: Prospects list + detail, Pipeline (Kanban + list), Activities
- Marketing: Email Sequences editor, Signals (intent alerts), Inbound, ABM/TAM, Templates
- Sourcing: Scraping jobs launcher (LinkedIn, Google, Societe.info, custom)
- Intelligence: AI Agent, Workflows automation builder
- System: Plugins manager, Themes (7 built-ins), Webhooks, Settings (Profile, Team, API keys, Billing, Integrations)

## Gotchas

- Tailwind v4 uses `@import "tailwindcss"` not `@tailwind base/components/utilities`
- Theme CSS vars are set on `document.documentElement` via JS (ThemeProvider), not Tailwind config
- wouter v3 does NOT have an `exact` prop on `<Route>` — order routes from most-specific to least
- The `@` alias resolves to `artifacts/growthos/src/` (set in vite.config.ts)
- Demo login bypasses the API by calling `useAuthStore.setState(...)` directly

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
