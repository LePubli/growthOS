import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding GrowthOS...');

  // ── Plans ────────────────────────────────────────────────────
  const plans = await Promise.all([
    prisma.plan.upsert({
      where: { name: 'starter' },
      create: {
        name: 'starter', displayName: 'Starter',
        description: 'Plan gratuit 14 jours — idéal pour tester',
        priceMonthly: 0, priceYearly: 0,
        features: { plugins: 5, users: 2, ai_requests: 100 },
        limits: { prospects_per_month: 500, emails_per_month: 1000, workflows: 3 },
      },
      update: {},
    }),
    prisma.plan.upsert({
      where: { name: 'pro' },
      create: {
        name: 'pro', displayName: 'Pro',
        description: 'Pour les équipes commerciales actives',
        priceMonthly: 49, priceYearly: 490,
        features: { plugins: 20, users: 5, ai_requests: 1000 },
        limits: { prospects_per_month: 5000, emails_per_month: 10000, workflows: 20 },
      },
      update: {},
    }),
    prisma.plan.upsert({
      where: { name: 'agency' },
      create: {
        name: 'agency', displayName: 'Agency',
        description: 'Pour les agences avec plusieurs clients',
        priceMonthly: 149, priceYearly: 1490,
        features: { plugins: -1, users: 25, ai_requests: -1, white_label: true },
        limits: { prospects_per_month: -1, emails_per_month: -1, workflows: -1 },
      },
      update: {},
    }),
  ]);
  console.log(`✓ ${plans.length} plans créés`);

  // ── Plugins core ─────────────────────────────────────────────
  const corePlugins = [
    { name: 'crm-prospecting', displayName: 'CRM & Prospecting', description: 'Module complet B2B — scraping, pipeline, scoring, signaux', category: 'PROSPECTING', icon: '🎯', isCore: false, isPublic: true, isFree: true, isVerified: true, version: '1.0.0', author: 'GrowthOS' },
    { name: 'seo-audit', displayName: 'SEO Audit Pro', description: 'Audit SEO complet, analyse mots-clés, suivi positionnement', category: 'SEO', icon: '🔍', isCore: false, isPublic: true, isFree: false, isVerified: true, version: '2.1.0', author: 'GrowthOS' },
    { name: 'linkedin-auto', displayName: 'LinkedIn Automation', description: 'Automatisation LinkedIn — connexions, messages, extraction', category: 'MARKETING', icon: '💼', isCore: false, isPublic: true, isFree: false, isVerified: true, version: '1.3.0', author: 'GrowthOS' },
    { name: 'email-warmup', displayName: 'Email Warmup', description: 'Améliore la délivrabilité — pool warmup, monitoring réputation', category: 'MARKETING', icon: '🔥', isCore: false, isPublic: true, isFree: true, isVerified: true, version: '1.0.0', author: 'GrowthOS' },
    { name: 'reputation-monitor', displayName: 'E-Réputation Monitor', description: 'Surveillance avis Google/Trustpilot, alertes mentions', category: 'SEO', icon: '⭐', isCore: false, isPublic: true, isFree: false, isVerified: true, version: '1.1.0', author: 'GrowthOS' },
    { name: 'ab-testing', displayName: 'A/B Testing Suite', description: 'Tests A/B emails et séquences, analyse statistique', category: 'ANALYTICS', icon: '📊', isCore: false, isPublic: true, isFree: true, isVerified: true, version: '1.2.0', author: 'GrowthOS' },
    { name: 'hubspot-sync', displayName: 'HubSpot Sync Pro', description: 'Synchronisation bidirectionnelle HubSpot', category: 'INTEGRATION', icon: '🔄', isCore: false, isPublic: true, isFree: false, isVerified: true, version: '2.0.0', author: 'GrowthOS' },
  ];

  for (const plugin of corePlugins) {
    await prisma.plugin.upsert({
      where: { name: plugin.name },
      create: plugin as any,
      update: { version: plugin.version },
    });
  }
  console.log(`✓ ${corePlugins.length} plugins marketplace créés`);

  // ── Thèmes builtin ────────────────────────────────────────────
  const themes = [
    {
      name: 'odoo-default', slug: 'odoo-default', displayName: 'GrowthOS Default',
      description: "Thème officiel inspiré d'Odoo Community",
      author: 'GrowthOS', version: '1.0.0', previewColor: '#017E84', previewBg: '#F9F9F9',
      isBuiltin: true, isPublic: true,
      tokens: {
        colors: { primary: '#017E84', brand: '#714B67', secondary: '#2C3E50', bgApp: '#F9F9F9', bgCard: '#FFFFFF', bgSidebar: '#2C3E50', textPrimary: '#212529', textSidebar: 'rgba(255,255,255,0.85)' },
        typography: { fontFamily: '"Noto Sans", sans-serif' },
        layout: { sidebarWidth: '220px', headerHeight: '46px' },
      },
    },
    {
      name: 'dark-pro', slug: 'dark-pro', displayName: 'Dark Pro',
      description: 'Interface entièrement sombre — confort nocturne maximal',
      author: 'GrowthOS', version: '1.0.0', previewColor: '#6366F1', previewBg: '#1A1B23',
      isBuiltin: true, isPublic: true,
      tokens: {
        colors: { primary: '#6366F1', bgApp: '#1A1B23', bgCard: '#242533', bgSidebar: '#15161E', textPrimary: '#E2E8F0', textSidebar: '#E2E8F0' },
        typography: { fontFamily: '"Noto Sans", sans-serif' },
        layout: { sidebarWidth: '220px', headerHeight: '46px' },
      },
    },
    {
      name: 'light-blue', slug: 'light-blue', displayName: 'Light Blue',
      description: 'Sidebar bleue, fond clair — moderne et professionnel',
      author: 'GrowthOS', version: '1.0.0', previewColor: '#0D6EFD', previewBg: '#F2F6FF',
      isBuiltin: true, isPublic: true,
      tokens: {
        colors: { primary: '#0D6EFD', bgApp: '#F2F6FF', bgCard: '#FFFFFF', bgSidebar: '#1E40AF', textPrimary: '#212529', textSidebar: '#FFFFFF' },
        typography: { fontFamily: '"Noto Sans", sans-serif' },
        layout: { sidebarWidth: '220px', headerHeight: '46px' },
      },
    },
  ];

  for (const theme of themes) {
    await prisma.theme.upsert({
      where: { slug: theme.slug },
      create: theme as any,
      update: { tokens: theme.tokens as any },
    });
  }
  console.log(`✓ ${themes.length} thèmes créés`);

  // ── Admin initial ────────────────────────────────────────────
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@le-publicitaire.fr';
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const adminCompany = process.env.ADMIN_COMPANY || 'Le Publicitaire';

  const existingAdmin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!existingAdmin) {
    const passwordHash = await bcrypt.hash(adminPassword, 12);
    const starterPlan = await prisma.plan.findUnique({ where: { name: 'starter' } });

    const user = await prisma.user.create({
      data: { email: adminEmail, passwordHash, firstName: 'Admin', lastName: '', emailVerified: true },
    });

    const slug = adminCompany.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 25) + '-' + Math.random().toString(36).slice(2, 8);
    const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

    const tenant = await prisma.tenant.create({
      data: {
        name: adminCompany, slug, schemaName,
        planId: starterPlan!.id, status: 'TRIAL',
        trialEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        branding: { companyName: adminCompany },
        settings: { timezone: 'Europe/Paris', language: 'fr' },
      },
    });

    await prisma.tenantUser.create({
      data: { tenantId: tenant.id, userId: user.id, role: 'owner', joinedAt: new Date() },
    });

    console.log(`✓ Admin créé: ${adminEmail}`);
    console.log(`✓ Tenant créé: ${adminCompany} (schema: ${schemaName})`);
    console.log('');
    console.log('⚠️  IMPORTANT — créez le schema PostgreSQL manuellement:');
    console.log(`   docker compose exec postgres psql -U growthos -d growthos -c "CREATE SCHEMA IF NOT EXISTS \\"${schemaName}\\""`);
  } else {
    console.log(`✓ Admin existant: ${adminEmail}`);
  }

  console.log('');
  console.log('✅ Seed terminé !');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
