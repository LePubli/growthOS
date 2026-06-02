import { Switch, Route, Router as WouterRouter, useLocation, Redirect } from 'wouter';
import { Toaster } from 'sonner';
import { ThemeProvider } from '@/providers/theme-provider';
import { QueryProvider } from '@/providers/query-provider';
import { useAuthStore } from '@/stores/auth.store';
import { AppShell } from '@/components/layout/AppShell';

import LoginPage from '@/pages/LoginPage';
import DashboardPage from '@/pages/DashboardPage';
import AnalyticsPage from '@/pages/AnalyticsPage';
import ProspectsPage from '@/pages/ProspectsPage';
import ProspectDetailPage from '@/pages/ProspectDetailPage';
import PipelinePage from '@/pages/PipelinePage';
import DealDetailPage from '@/pages/DealDetailPage';
import SequencesPage from '@/pages/SequencesPage';
import SequenceDetailPage from '@/pages/SequenceDetailPage';
import SignalsPage from '@/pages/SignalsPage';
import SignalDetailPage from '@/pages/SignalDetailPage';
import SourcingPage from '@/pages/SourcingPage';
import PluginsPage from '@/pages/PluginsPage';
import WorkflowsPage from '@/pages/WorkflowsPage';
import WorkflowDetailPage from '@/pages/WorkflowDetailPage';
import ThemesPage from '@/pages/ThemesPage';
import SettingsPage from '@/pages/SettingsPage';
import ProfilePage from '@/pages/settings/ProfilePage';
import TeamPage from '@/pages/settings/TeamPage';
import ApiPage from '@/pages/settings/ApiPage';
import BillingPage from '@/pages/settings/BillingPage';
import IntegrationsPage from '@/pages/settings/IntegrationsPage';
import ActivitiesPage from '@/pages/ActivitiesPage';
import TemplatesPage from '@/pages/TemplatesPage';
import WebhooksPage from '@/pages/WebhooksPage';
import InboundPage from '@/pages/InboundPage';
import ABMPage from '@/pages/ABMPage';
import AIAgentPage from '@/pages/AIAgentPage';
import { GenericPage } from '@/pages/GenericPage';
import MarketplacePage from '@/pages/MarketplacePage';
import CRMMapPage from '@/pages/CRMMapPage';
import MapPage from '@/pages/MapPage';
import ContactsPage from '@/pages/ContactsPage';
import ImportPage from '@/pages/ImportPage';
import ContactIntelPage from '@/pages/ContactIntelPage';
import CRMSyncPage from '@/pages/CRMSyncPage';
import SourcingJobPage from '@/pages/SourcingJobPage';
import PluginDetailPage from '@/pages/PluginDetailPage';
import AccountsPage from '@/pages/AccountsPage';
import MemoryPage from '@/pages/MemoryPage';
import MeetingListPage from '@/pages/MeetingListPage';
import SignalFeedPage from '@/pages/SignalFeedPage';
import AISDRPage from '@/pages/AISDRPage';
import DealCoachPage from '@/pages/DealCoachPage';
import MeetingDetailPage from '@/pages/MeetingDetailPage';
import Account360Page from '@/pages/Account360Page';
import TeamMetricsPage from '@/pages/TeamMetricsPage';
import CalendarPage from '@/pages/CalendarPage';
import ProposalsPage from '@/pages/ProposalsPage';
import SharedDashboardsPage from '@/pages/SharedDashboardsPage';

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

function AppRoutes() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/">
        {() => <Redirect to="/dashboard" />}
      </Route>

      <Route path="/dashboard">
        {() => <DashboardLayout><DashboardPage /></DashboardLayout>}
      </Route>
      <Route path="/analytics">
        {() => <DashboardLayout><AnalyticsPage /></DashboardLayout>}
      </Route>

      <Route path="/prospects">
        {() => <DashboardLayout><ProspectsPage /></DashboardLayout>}
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
      <Route path="/signals/:id">
        {() => <DashboardLayout><SignalDetailPage /></DashboardLayout>}
      </Route>

      <Route path="/sourcing">
        {() => <DashboardLayout><SourcingPage /></DashboardLayout>}
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
        {() => <DashboardLayout><BillingPage /></DashboardLayout>}
      </Route>
      <Route path="/settings/integrations">
        {() => <DashboardLayout><IntegrationsPage /></DashboardLayout>}
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
      <Route path="/inbound">
        {() => <DashboardLayout><InboundPage /></DashboardLayout>}
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
        {() => <DashboardLayout><ContactIntelPage /></DashboardLayout>}
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
        {() => <DashboardLayout><ProposalsPage /></DashboardLayout>}
      </Route>
      <Route path="/shared-dashboards">
        {() => <DashboardLayout><SharedDashboardsPage /></DashboardLayout>}
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
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <QueryProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <AppRoutes />
        </WouterRouter>
        <Toaster richColors position="top-right" />
      </QueryProvider>
    </ThemeProvider>
  );
}
