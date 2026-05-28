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
import PipelinePage from '@/pages/PipelinePage';
import SequencesPage from '@/pages/SequencesPage';
import SignalsPage from '@/pages/SignalsPage';
import SourcingPage from '@/pages/SourcingPage';
import PluginsPage from '@/pages/PluginsPage';
import WorkflowsPage from '@/pages/WorkflowsPage';
import ThemesPage from '@/pages/ThemesPage';
import SettingsPage from '@/pages/SettingsPage';
import ProfilePage from '@/pages/settings/ProfilePage';
import TeamPage from '@/pages/settings/TeamPage';
import ApiPage from '@/pages/settings/ApiPage';
import BillingPage from '@/pages/settings/BillingPage';
import IntegrationsPage from '@/pages/settings/IntegrationsPage';
import { GenericPage } from '@/pages/GenericPage';

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
        {(p) => <DashboardLayout><GenericPage title={`Prospect #${p.id}`} icon="👤" description="Fiche détaillée du prospect : enrichissement, activités, emails, deals." /></DashboardLayout>}
      </Route>

      <Route path="/pipeline">
        {() => <DashboardLayout><PipelinePage /></DashboardLayout>}
      </Route>
      <Route path="/pipeline/:id">
        {(p) => <DashboardLayout><GenericPage title={`Deal #${p.id}`} icon="💼" description="Détails du deal, historique d'activités, modification du stade." /></DashboardLayout>}
      </Route>

      <Route path="/sequences">
        {() => <DashboardLayout><SequencesPage /></DashboardLayout>}
      </Route>
      <Route path="/sequences/:id">
        {(p) => <DashboardLayout><GenericPage title={`Séquence ${p.id === 'new' ? '(nouvelle)' : `#${p.id}`}`} icon="📧" description="Éditeur de séquence email — étapes, délais, templates personnalisés." /></DashboardLayout>}
      </Route>

      <Route path="/signals">
        {() => <DashboardLayout><SignalsPage /></DashboardLayout>}
      </Route>
      <Route path="/signals/:id">
        {(p) => <DashboardLayout><GenericPage title={`Signal #${p.id}`} icon="⚡" description="Détail du signal d'intention — analyse, actions recommandées." /></DashboardLayout>}
      </Route>

      <Route path="/sourcing">
        {() => <DashboardLayout><SourcingPage /></DashboardLayout>}
      </Route>
      <Route path="/sourcing/:id">
        {(p) => <DashboardLayout><GenericPage title={`Scraping #${p.id}`} icon="🔍" description="Configuration et résultats du scraping — prospects collectés." /></DashboardLayout>}
      </Route>

      <Route path="/plugins">
        {() => <DashboardLayout><PluginsPage /></DashboardLayout>}
      </Route>
      <Route path="/plugins/:name">
        {(p) => <DashboardLayout><GenericPage title={`Plugin : ${p.name}`} icon="🧩" description="Configuration, logs et statut du plugin installé." /></DashboardLayout>}
      </Route>

      <Route path="/workflows">
        {() => <DashboardLayout><WorkflowsPage /></DashboardLayout>}
      </Route>
      <Route path="/workflows/:id">
        {(p) => <DashboardLayout><GenericPage title={`Workflow ${p.id === 'new' ? '(nouveau)' : `#${p.id}`}`} icon="⚙️" description="Éditeur de workflow — déclencheurs, conditions, actions." /></DashboardLayout>}
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
        {() => <DashboardLayout><GenericPage title="Activités" icon="📋" description="Journal d'activités CRM — appels, réunions, notes, emails." /></DashboardLayout>}
      </Route>
      <Route path="/contacts">
        {() => <DashboardLayout><GenericPage title="Contact Intel" icon="🔎" description="Intelligence contact — enrichissement, doublons, historique." /></DashboardLayout>}
      </Route>
      <Route path="/inbound">
        {() => <DashboardLayout><GenericPage title="Inbound" icon="📥" description="Gestion des leads entrants — formulaires, landing pages, scoring." /></DashboardLayout>}
      </Route>
      <Route path="/abm">
        {() => <DashboardLayout><GenericPage title="ABM / TAM" icon="🎯" description="Account-Based Marketing — ciblage stratégique et marché adressable." /></DashboardLayout>}
      </Route>
      <Route path="/templates">
        {() => <DashboardLayout><GenericPage title="Templates Email" icon="📄" description="Bibliothèque de templates email — personnalisation et variables." /></DashboardLayout>}
      </Route>
      <Route path="/crm-sync">
        {() => <DashboardLayout><GenericPage title="CRM Sync" icon="🔄" description="Synchronisation bidirectionnelle avec HubSpot, Salesforce, etc." /></DashboardLayout>}
      </Route>
      <Route path="/ai">
        {() => <DashboardLayout><GenericPage title="Agent IA" icon="🤖" description="Assistant commercial IA — suggestions, rédaction, analyse prédictive." /></DashboardLayout>}
      </Route>
      <Route path="/marketplace">
        {() => <DashboardLayout><GenericPage title="Marketplace" icon="🛒" description="Découvrez et installez des plugins et connecteurs GrowthOS." /></DashboardLayout>}
      </Route>
      <Route path="/webhooks">
        {() => <DashboardLayout><GenericPage title="Webhooks" icon="🔗" description="Configurez des webhooks pour intégrer GrowthOS à vos systèmes." /></DashboardLayout>}
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
