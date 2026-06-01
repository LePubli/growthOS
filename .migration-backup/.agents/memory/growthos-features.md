---
name: GrowthOS feature progress
description: Status of all 16 requested improvements — what's built, what remains, patterns used
---

## Built (this session)

1. **Email Resend backend** — `artifacts/api-server/src/services/email.ts` + `/api/v1/email` router wired in index.ts. Reads `RESEND_API_KEY`. Falls back gracefully when not configured.
2. **NotificationsDrawer** — Bell panel with badge, 7 mock items, localStorage persistence. Replaces old hardcoded bell in AppShell.
3. **CalendarPage** (`/calendar`) — Month grid view, event CRUD modal, right sidebar with today's schedule. 4 types: call/meeting/demo/task.
4. **AI Scoring panel** — On ProspectDetailPage sidebar: SVG ring chart, 6 weighted criteria breakdown, hot/warm/cold label. Uses `computeScoring()` IIFE.
5. **ProposalsPage** (`/proposals`) — Create/edit drawer with line items, total, HTML export (open in browser → Print → PDF), preview iframe modal, send action.
6. **AccountsPage** (`/accounts`) — Prospects grouped by company, account KPIs.
7. **CommentsPanel** — Reusable collaboration feed, added to ProspectDetailPage AND PipelinePage deals.
8. **OnboardingWizard** — 4-step modal, localStorage `growthos_onboarding_done` flag.
9. **TeamMetricsPage** (`/team`) — Leaderboard, quota bars, recharts chart.
10. **Pipeline DnD persistence** — `apiClient.patch('/pipeline/${id}', { stage })` on drop.
11. **Prospect archiving** — Archive/restore button (🗂) on ProspectDetailPage header, PATCH status → 'archived'. "Archivés" filter tab added to ProspectsPage.

## Remaining / not yet built

- **Real-time WebSocket notifications** — polling only via localStorage for now
- **Mobile Expo app** — needs new artifact (follow `expo` skill)
- **Global search** — CommandPalette exists but not wired to live API data
- **Shared dashboards** — not yet implemented
- **LinkedIn CSV import improvements** — ImportPage exists but basic

## Key patterns

- All new pages follow: `artifacts/growthos/src/pages/XxxPage.tsx` → import in `App.tsx` → `<Route>` in Switch → nav item in `AppShell.tsx` NAV_ITEMS array
- API routes: add file to `artifacts/api-server/src/routes/v1/`, import + mount in `index.ts`
- wouter v3: NO `exact` prop; most-specific routes first
- ProspectDetailPage uses `computeScoring(prospect)` IIFE inside JSX for AI scoring panel
