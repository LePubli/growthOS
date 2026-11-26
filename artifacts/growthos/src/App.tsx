import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { lazy, Suspense, useEffect, useState } from 'react';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/providers/theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { useAuthStore } from '@/stores/auth.store';
import { AppShell } from '@/components/layout/AppShell';

import LoginPage from '@/pages/LoginPage';
import { GenericPage } from '@/pages/GenericPage';
import OnboardingWizardPage from '@/pages/OnboardingWizardPage';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { useSignalNotifications } from '@/hooks/useSignalNotifications';
import { ClientShell } from '@/plugins/client-portal/ClientShell';
import LandingPage from '@/pages/public/LandingPage';
import UnavailablePage from '@/pages/UnavailablePage';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const AnalyticsPage = lazy(() => import('@/pages/AnalyticsPage'));
const ProspectsPage = lazy(() => import('@/pages/ProspectsPage'));
const CloudBrowserPage=lazy(()=>import('@/pages/CloudBrowserPage'));
const CollectionToolsPage = lazy(() => import('@/pages/CollectionToolsPage'));
const ConnectorImportPage = lazy(() => import('@/pages/ConnectorImportPage'));
const ProspectDetailPage = lazy(() => import('@/pages/ProspectDetailPage'));
const PipelinePage = lazy(() => import('@/pages/PipelinePage'));
const DealDetailPage = lazy(() => import('@/pages/DealDetailPage'));
const SequencesPage = lazy(() => import('@/pages/SequencesPage'));
const SequenceDetailPage = lazy(() => import('@/pages/SequenceDetailPage'));
const SignalsPage = lazy(() => import('@/pages/SignalsPage'));
const SignalDetailPage = lazy(() => import('@/pages/SignalDetailPage'));
const SourcingPage = lazy(() => import('@/pages/SourcingPage'));
const SiteAuditPage = lazy(() => import('@/pages/SiteAuditPage'));
const PluginsPage = lazy(() => import('@/pages/PluginsPage'));
const WorkflowsPage = lazy(() => import('@/pages/WorkflowsPage'));
const WorkflowDetailPage = lazy(() => import('@/pages/WorkflowDetailPage'));
const ThemesPage = lazy(() => import('@/pages/ThemesPage'));
const SettingsPage = lazy(() => import('@/pages/SettingsPage'));
const ProfilePage = lazy(() => import('@/pages/settings/ProfilePage'));
const TeamPage = lazy(() => import('@/pages/settings/TeamPage'));
const ApiPage = lazy(() => import('@/pages/settings/ApiPage'));
const BillingPage = lazy(() => import('@/pages/settings/BillingPage'));
const IntegrationsPage = lazy(() => import('@/pages/settings/IntegrationsPage'));
const IntegrationsHubPage = lazy(() => import('@/pages/IntegrationsPage'));
const ActivitiesPage = lazy(() => import('@/pages/ActivitiesPage'));
const TemplatesPage = lazy(() => import('@/pages/TemplatesPage'));
const WebhooksPage = lazy(() => import('@/pages/WebhooksPage'));
const InboundPage = lazy(() => import('@/pages/InboundPage'));
const ABMPage = lazy(() => import('@/pages/ABMPage'));
const AIAgentPage = lazy(() => import('@/pages/AIAgentPage'));
const MarketplacePage = lazy(() => import('@/pages/MarketplacePage'));
const CRMMapPage = lazy(() => import('@/pages/CRMMapPage'));
const MapPage = lazy(() => import('@/pages/MapPage'));
const ContactsPage = lazy(() => import('@/pages/ContactsPage'));
const ImportPage = lazy(() => import('@/pages/ImportPage'));
const ContactIntelPage = lazy(() => import('@/pages/ContactIntelPage'));
const CRMSyncPage = lazy(() => import('@/pages/CRMSyncPage'));
const SourcingJobPage = lazy(() => import('@/pages/SourcingJobPage'));
const PluginDetailPage = lazy(() => import('@/pages/PluginDetailPage'));
const AccountsPage = lazy(() => import('@/pages/AccountsPage'));
const MemoryPage = lazy(() => import('@/pages/MemoryPage'));
const MeetingListPage = lazy(() => import('@/pages/MeetingListPage'));
const SignalFeedPage = lazy(() => import('@/pages/SignalFeedPage'));
const AISDRPage = lazy(() => import('@/pages/AISDRPage'));
const DealCoachPage = lazy(() => import('@/pages/DealCoachPage'));
const RevenueDashboard = lazy(() => import('@/plugins/revenue-intelligence/RevenueDashboard'));
const KnowledgeBasePage = lazy(() => import('@/plugins/knowledge-base/KnowledgeBasePage'));
const CommandCenterPage = lazy(() => import('@/plugins/executive-command/CommandCenterPage'));
const MeetingDetailPage = lazy(() => import('@/pages/MeetingDetailPage'));
const Account360Page = lazy(() => import('@/pages/Account360Page'));
const TeamMetricsPage = lazy(() => import('@/pages/TeamMetricsPage'));
const CalendarPage = lazy(() => import('@/pages/CalendarPage'));
const ProposalsPage = lazy(() => import('@/pages/ProposalsPage'));
const SharedDashboardsPage = lazy(() => import('@/pages/SharedDashboardsPage'));
const RouteAuditPage = lazy(() => import('@/pages/RouteAuditPage'));
const PluginUploadPage = lazy(() => import('@/pages/PluginUploadPage'));
const DeepAuditPage = lazy(() => import('@/pages/DeepAuditPage'));
const EnrichmentPage = lazy(() => import('@/pages/EnrichmentPage'));
const ERepDashboardPage = lazy(() => import('@/plugins/ereputation/ERepDashboardPage'));
const ERepCampaignsPage = lazy(() => import('@/plugins/ereputation/CampaignsPage'));
const ERepSERPPage = lazy(() => import('@/plugins/ereputation/SERPTrackingPage'));
const ERepSentimentPage = lazy(() => import('@/plugins/ereputation/SentimentFeedPage'));
const ERepSocialPage = lazy(() => import('@/plugins/ereputation/SocialCalendarPage'));
const ERepPBNPage = lazy(() => import('@/plugins/ereputation/PBNManagerPage'));
const TasksPage = lazy(() => import('@/pages/TasksPage'));
const HelpCenterPage = lazy(() => import('@/pages/HelpCenterPage'));
const ReferralPage = lazy(() => import('@/pages/ReferralPage'));
const AuditTrailPage = lazy(() => import('@/pages/AuditTrailPage'));
const CompliancePage = lazy(() => import('@/pages/CompliancePage'));
const SSOConfigPage = lazy(() => import('@/pages/settings/SSOConfigPage'));
const APIDocsPage = lazy(() => import('@/pages/APIDocsPage'));
const ProductAnalyticsPage = lazy(() => import('@/pages/ProductAnalyticsPage'));
const UsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const PlansPage = lazy(() => import('@/pages/admin/PlansPage'));
const AuditPage = lazy(() => import('@/pages/admin/AuditPage'));
const ApiKeysPage = lazy(() => import('@/pages/admin/ApiKeysPage'));
const QuotaMonitoringPage = lazy(() => import('@/pages/admin/QuotaMonitoringPage'));
const PricingPage = lazy(() => import('@/pages/public/PricingPage'));
const RegisterPage = lazy(() => import('@/pages/public/RegisterPage'));
const AutopilotPage = lazy(() => import('@/pages/settings/AutopilotPage'));
const ClientDashboardPage = lazy(() => import('@/plugins/client-portal/ClientDashboardPage'));
const ClientCampaignsPage = lazy(() => import('@/plugins/client-portal/ClientCampaignsPage'));
const ClientApprovalsPage = lazy(() => import('@/plugins/client-portal/ClientApprovalsPage'));
const ClientReportsPage = lazy(() => import('@/plugins/client-portal/ClientReportsPage'));

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const [location] = useLocation();
  if (!isAuthenticated) {
    return <Redirect to={`/login?next=${encodeURIComponent(location)}`} />;
  }
  return <>{children}</>;
}

function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}

function HomeEntry({ authenticated }: { authenticated: boolean }) {
  const [firstRun, setFirstRun] = useState(false);
  useEffect(() => {
    fetch('/api/v1/setup/status', { cache: 'no-store' })
      .then(response => response.ok ? response.json() : null)
      .then(status => { if (status?.needsBootstrap) setFirstRun(true); })
      .catch(() => undefined);
  }, []);
  if (firstRun) return <Redirect to="/setup" />;
  return authenticated ? <Redirect to="/dashboard" /> : <LandingPage />;
}

function AppRoutes() {
  useSignalNotifications();
  const { isAuthenticated } = useAuthStore();

  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'var(--body-bg)', color: 'var(--text-muted)' }}>
        Chargement de GrowthOS…
      </div>
    }>
    <Switch>
      {/* ── Routes publiques (pas d'auth requise) ─────────────────────── */}
      <Route path="/">
        {() => <HomeEntry authenticated={isAuthenticated} />}
      </Route>
      <Route path="/setup">
        {() => <OnboardingWizardPage />}
      </Route>
      <Route path="/pricing" component={PricingPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/login" component={LoginPage} />

      <Route path="/dashboard">
        {() => <DashboardLayout><DashboardPage /></DashboardLayout>}
      </Route>
      <Route path="/analytics">
        {() => <DashboardLayout><AnalyticsPage /></DashboardLayout>}
      </Route>

      <Route path="/prospects">
        {() => <DashboardLayout><ProspectsPage /></DashboardLayout>}
      </Route>
      <Route path="/navigateur">
        {()=><DashboardLayout><CloudBrowserPage/></DashboardLayout>}
      </Route>
      <Route path="/outils">
        {() => <DashboardLayout><CollectionToolsPage /></DashboardLayout>}
      </Route>
      <Route path="/prospects/connecteur">
        {() => <DashboardLayout><ConnectorImportPage /></DashboardLayout>}
      </Route>
      <Route path="/prospects/:id">
        {() => <DashboardLayout><ProspectDetailPage /></DashboardLayout>}
      </Route>

      <Route path="/pipeline">
        {() => <DashboardLayout><PipelinePage /></DashboardLayout>}
      </Route>
      <Route path="/pipeline/:id">
        {() => <DashboardLayout><DealDetailPage /></DashboardLayout>}
      </Route>

      <Route path="/sequences">
        {() => <DashboardLayout><SequencesPage /></DashboardLayout>}
      </Route>
      <Route path="/sequences/:id">
        {() => <DashboardLayout><SequenceDetailPage /></DashboardLayout>}
      </Route>

      <Route path="/signals">
        {() => <DashboardLayout><SignalFeedPage /></DashboardLayout>}
      </Route>
      <Route path="/ai-sdr">
        {() => <DashboardLayout><AISDRPage /></DashboardLayout>}
      </Route>
      <Route path="/deal-coach">
        {() => <DashboardLayout><DealCoachPage /></DashboardLayout>}
      </Route>
      <Route path="/revenue">
        {() => <DashboardLayout><RevenueDashboard /></DashboardLayout>}
      </Route>
      <Route path="/knowledge">
        {() => <DashboardLayout><KnowledgeBasePage /></DashboardLayout>}
      </Route>
      <Route path="/executive">
        {() => <DashboardLayout><CommandCenterPage /></DashboardLayout>}
      </Route>
      <Route path="/signals/:id">
        {() => <DashboardLayout><SignalDetailPage /></DashboardLayout>}
      </Route>

      <Route path="/sourcing">
        {() => <DashboardLayout><SourcingPage /></DashboardLayout>}
      </Route>
      <Route path="/seo-check">
        {() => <DashboardLayout><SiteAuditPage /></DashboardLayout>}
      </Route>
      <Route path="/sourcing/:id">
        {() => <DashboardLayout><SourcingJobPage /></DashboardLayout>}
      </Route>

      <Route path="/plugins">
        {() => <DashboardLayout><PluginsPage /></DashboardLayout>}
      </Route>
      <Route path="/plugins/:name">
        {() => <DashboardLayout><PluginDetailPage /></DashboardLayout>}
      </Route>

      <Route path="/workflows">
        {() => <DashboardLayout><WorkflowsPage /></DashboardLayout>}
      </Route>
      <Route path="/workflows/:id">
        {() => <DashboardLayout><WorkflowDetailPage /></DashboardLayout>}
      </Route>

      <Route path="/themes">
        {() => <DashboardLayout><ThemesPage /></DashboardLayout>}
      </Route>

      <Route path="/settings">
        {() => <DashboardLayout><SettingsPage /></DashboardLayout>}
      </Route>
      <Route path="/settings/profile">
        {() => <DashboardLayout><ProfilePage /></DashboardLayout>}
      </Route>
      <Route path="/settings/team">
        {() => <DashboardLayout><TeamPage /></DashboardLayout>}
      </Route>
      <Route path="/settings/api">
        {() => <DashboardLayout><ApiPage /></DashboardLayout>}
      </Route>
      <Route path="/settings/billing">
        {() => <DashboardLayout><UnavailablePage feature="Facturation" description="Le parcours de paiement Stripe et les factures réelles ne sont pas encore certifiés." /></DashboardLayout>}
      </Route>
      <Route path="/settings/integrations">
        {() => <DashboardLayout><UnavailablePage feature="Intégrations externes" description="Les statuts Gmail, Slack et autres fournisseurs doivent être reliés aux connexions réelles avant affichage." /></DashboardLayout>}
      </Route>
      <Route path="/settings/autopilot">
        {() => <DashboardLayout><AutopilotPage /></DashboardLayout>}
      </Route>

      <Route path="/activities">
        {() => <DashboardLayout><ActivitiesPage /></DashboardLayout>}
      </Route>
      <Route path="/templates">
        {() => <DashboardLayout><TemplatesPage /></DashboardLayout>}
      </Route>
      <Route path="/webhooks">
        {() => <DashboardLayout><WebhooksPage /></DashboardLayout>}
      </Route>
      <Route path="/integrations">
        {() => <DashboardLayout><IntegrationsHubPage /></DashboardLayout>}
      </Route>
      <Route path="/inbound">
        {() => <DashboardLayout><UnavailablePage feature="Prospection entrante" description="Les formulaires, leads et conversions affichés auparavant étaient des données de démonstration." /></DashboardLayout>}
      </Route>
      <Route path="/abm">
        {() => <DashboardLayout><ABMPage /></DashboardLayout>}
      </Route>
      <Route path="/ai">
        {() => <DashboardLayout><AIAgentPage /></DashboardLayout>}
      </Route>

      <Route path="/contacts">
        {() => <DashboardLayout><ContactsPage /></DashboardLayout>}
      </Route>
      <Route path="/contact-intel">
        {() => <DashboardLayout><UnavailablePage feature="Intelligence contact" description="Les données d'enrichissement contact ne sont pas encore vérifiées auprès de fournisseurs réels." /></DashboardLayout>}
      </Route>
      <Route path="/crm-sync">
        {() => <DashboardLayout><CRMSyncPage /></DashboardLayout>}
      </Route>
      <Route path="/marketplace">
        {() => <DashboardLayout><MarketplacePage /></DashboardLayout>}
      </Route>
      <Route path="/map">
        {() => <DashboardLayout><MapPage /></DashboardLayout>}
      </Route>
      <Route path="/import">
        {() => <DashboardLayout><ImportPage /></DashboardLayout>}
      </Route>

      <Route path="/enrichment">
        {() => <DashboardLayout><EnrichmentPage /></DashboardLayout>}
      </Route>

      <Route path="/ereputation/campaigns">
        {() => <DashboardLayout><ERepCampaignsPage /></DashboardLayout>}
      </Route>
      <Route path="/ereputation/serp">
        {() => <DashboardLayout><ERepSERPPage /></DashboardLayout>}
      </Route>
      <Route path="/ereputation/sentiment">
        {() => <DashboardLayout><UnavailablePage feature="Veille des mentions" description="La collecte externe d'avis et le flux de sentiments doivent être raccordés à des sources vérifiables." /></DashboardLayout>}
      </Route>
      <Route path="/ereputation/social">
        {() => <DashboardLayout><UnavailablePage feature="Calendrier social" description="Les publications et résultats sociaux ne sont pas encore synchronisés avec les réseaux réels." /></DashboardLayout>}
      </Route>
      <Route path="/ereputation/pbn">
        {() => <DashboardLayout><UnavailablePage feature="Réseau de sites" description="Aucun indicateur d'autorité ou de backlinks non mesuré ne doit être présenté comme réel." /></DashboardLayout>}
      </Route>
      <Route path="/ereputation">
        {() => <DashboardLayout><ERepDashboardPage /></DashboardLayout>}
      </Route>

      <Route path="/memory">
        {() => <DashboardLayout><MemoryPage /></DashboardLayout>}
      </Route>

      <Route path="/meetings/:id">
        {(params) => <DashboardLayout><MeetingDetailPage /></DashboardLayout>}
      </Route>
      <Route path="/meetings">
        {() => <DashboardLayout><MeetingListPage /></DashboardLayout>}
      </Route>

      <Route path="/accounts/:accountId">
        {() => <DashboardLayout><Account360Page /></DashboardLayout>}
      </Route>
      <Route path="/accounts">
        {() => <DashboardLayout><AccountsPage /></DashboardLayout>}
      </Route>
      <Route path="/team">
        {() => <DashboardLayout><TeamMetricsPage /></DashboardLayout>}
      </Route>
      <Route path="/calendar">
        {() => <DashboardLayout><CalendarPage /></DashboardLayout>}
      </Route>
      <Route path="/proposals">
        {() => <DashboardLayout><UnavailablePage feature="Propositions commerciales" description="Le générateur de propositions n'est pas encore connecté au CRM et à un stockage permanent." /></DashboardLayout>}
      </Route>
      <Route path="/shared-dashboards">
        {() => <DashboardLayout><UnavailablePage feature="Tableaux de bord partagés" description="La gestion réelle des accès et des tableaux partagés n'a pas encore été validée." /></DashboardLayout>}
      </Route>
      <Route path="/route-audit">
        {() => <DashboardLayout><RouteAuditPage /></DashboardLayout>}
      </Route>
      <Route path="/admin/plugins-upload">
        {() => <DashboardLayout><PluginUploadPage /></DashboardLayout>}
      </Route>
      <Route path="/admin/deep-audit">
        {() => <DashboardLayout><DeepAuditPage /></DashboardLayout>}
      </Route>

      <Route path="/tasks">
        {() => <DashboardLayout><TasksPage /></DashboardLayout>}
      </Route>
      <Route path="/onboarding">
        {() => <RequireAuth><OnboardingWizardPage /></RequireAuth>}
      </Route>
      <Route path="/help">
        {() => <DashboardLayout><HelpCenterPage /></DashboardLayout>}
      </Route>
      <Route path="/referral">
        {() => <DashboardLayout><UnavailablePage feature="Parrainage" description="Aucun programme de parrainage réel ni statistiques de commissions ne sont configurés." /></DashboardLayout>}
      </Route>

      <Route path="/audit-trail">
        {() => <DashboardLayout><AuditTrailPage /></DashboardLayout>}
      </Route>
      <Route path="/compliance">
        {() => <DashboardLayout><CompliancePage /></DashboardLayout>}
      </Route>
      <Route path="/settings/sso">
        {() => <DashboardLayout><SSOConfigPage /></DashboardLayout>}
      </Route>
      <Route path="/api-docs">
        {() => <DashboardLayout><APIDocsPage /></DashboardLayout>}
      </Route>
      <Route path="/analytics/product">
        {() => <DashboardLayout><ProductAnalyticsPage /></DashboardLayout>}
      </Route>
      <Route path="/admin/users">
        {() => <DashboardLayout><UsersPage /></DashboardLayout>}
      </Route>
      <Route path="/admin/plans">
        {() => <DashboardLayout><PlansPage /></DashboardLayout>}
      </Route>
      <Route path="/admin/audit">
        {() => <DashboardLayout><AuditPage /></DashboardLayout>}
      </Route>
      <Route path="/admin/api-keys">
        {() => <DashboardLayout><ApiKeysPage /></DashboardLayout>}
      </Route>
      <Route path="/admin/quotas">
        {() => <DashboardLayout><QuotaMonitoringPage /></DashboardLayout>}
      </Route>

      {/* ── Portail Client E-Réputation ─────────────────────────────────── */}
      <Route path="/client/ereputation/campaigns">
        {() => <RequireAuth><ClientShell><ClientCampaignsPage /></ClientShell></RequireAuth>}
      </Route>
      <Route path="/client/ereputation/approvals">
        {() => <RequireAuth><ClientShell><ClientApprovalsPage /></ClientShell></RequireAuth>}
      </Route>
      <Route path="/client/ereputation/reports">
        {() => <RequireAuth><ClientShell><ClientReportsPage /></ClientShell></RequireAuth>}
      </Route>
      <Route path="/client/ereputation">
        {() => <RequireAuth><ClientShell><ClientDashboardPage /></ClientShell></RequireAuth>}
      </Route>

      <Route>
        {() => (
          <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--body-bg)' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🔍</div>
              <h1 style={{ fontSize: 24, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>Page introuvable</h1>
              <a href="/dashboard" style={{ color: 'var(--color-primary)', fontSize: 14 }}>Retour au tableau de bord →</a>
            </div>
          </div>
        )}
      </Route>
    </Switch>
    </Suspense>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <ErrorBoundary label="L'application a rencontré une erreur critique">
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppRoutes />
          </WouterRouter>
        </ErrorBoundary>
        <Toaster richColors position="top-right" />
      </QueryProvider>
    </ThemeProvider>
  );
}
