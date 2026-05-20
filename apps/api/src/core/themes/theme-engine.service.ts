import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/database/prisma.service';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';

/**
 * Design tokens Odoo-inspiré complet.
 * Utilisé comme base pour tous les thèmes.
 */
export const ODOO_DEFAULT_TOKENS = {
  colors: {
    // Odoo Community exact
    brand:     '#714B67',
    primary:   '#017E84',
    secondary: '#2C3E50',
    success:   '#28A745',
    danger:    '#DC3545',
    warning:   '#F0AD4E',
    info:      '#17A2B8',

    // Backgrounds
    bgApp:     '#F9F9F9',
    bgCard:    '#FFFFFF',
    bgSidebar: '#2C3E50',   // Sidebar sombre signature Odoo
    bgHeader:  '#FFFFFF',
    bgHover:   'rgba(1,126,132,0.08)',
    bgActive:  'rgba(255,255,255,0.15)',

    // Text
    textPrimary:   '#212529',
    textSecondary: '#6C757D',
    textMuted:     '#ADB5BD',
    textSidebar:   '#FFFFFF',
    textSidebarMuted: 'rgba(255,255,255,0.6)',

    // Borders
    border:    '#DEE2E6',
    borderLight: '#F0F0F0',
  },
  typography: {
    fontFamily:      '"Noto Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif',
    fontFamilyMono:  '"Noto Sans Mono", "SFMono-Regular", Consolas, monospace',
    fontSizeBase:    '14px',
    fontSizeSm:      '12px',
    fontSizeLg:      '16px',
    fontSizeXl:      '20px',
    fontWeightNormal: '400',
    fontWeightMedium: '500',
    fontWeightBold:   '600',
    lineHeight:       '1.5',
  },
  spacing: {
    xs:  '4px',
    sm:  '8px',
    md:  '16px',
    lg:  '24px',
    xl:  '32px',
    xxl: '48px',
  },
  radius: {
    sm:   '4px',
    md:   '8px',
    lg:   '8px',
    pill: '50px',
    full: '9999px',
  },
  shadows: {
    sm:   '0 1px 3px rgba(0,0,0,.08)',
    md:   '0 2px 8px rgba(0,0,0,.1)',
    lg:   '0 4px 20px rgba(0,0,0,.12)',
    card: '0 1px 3px rgba(0,0,0,.08)',
  },
  layout: {
    sidebarWidth:     '220px',
    sidebarWidthSm:   '64px',
    headerHeight:     '46px',
    contentMaxWidth:  '1440px',
    contentPadding:   '24px',
  },
};

export const BUILTIN_THEMES = [
  {
    name: 'odoo-default',
    slug: 'odoo-default',
    displayName: 'GrowthOS Default',
    description: 'Thème officiel inspiré d\'Odoo Community — sidebar sombre, interface épurée',
    author: 'GrowthOS',
    version: '1.0.0',
    previewColor: '#017E84',
    previewBg: '#F9F9F9',
    isBuiltin: true,
    isPublic: true,
    tokens: ODOO_DEFAULT_TOKENS,
  },
  {
    name: 'dark-pro',
    slug: 'dark-pro',
    displayName: 'Dark Pro',
    description: 'Interface entièrement sombre — confort nocturne maximal',
    author: 'GrowthOS',
    version: '1.0.0',
    previewColor: '#6366F1',
    previewBg: '#1A1B23',
    isBuiltin: true,
    isPublic: true,
    tokens: {
      ...ODOO_DEFAULT_TOKENS,
      colors: {
        ...ODOO_DEFAULT_TOKENS.colors,
        primary:   '#6366F1',
        bgApp:     '#1A1B23',
        bgCard:    '#242533',
        bgSidebar: '#15161E',
        bgHeader:  '#242533',
        bgHover:   'rgba(99,102,241,0.1)',
        bgActive:  'rgba(99,102,241,0.15)',
        textPrimary:   '#E2E8F0',
        textSecondary: '#94A3B8',
        textMuted:     '#64748B',
        textSidebar:   '#E2E8F0',
        border:    '#2D2F3E',
      },
    },
  },
  {
    name: 'light-blue',
    slug: 'light-blue',
    displayName: 'Light Blue',
    description: 'Thème clair avec sidebar bleue — moderne et professionnel',
    author: 'GrowthOS',
    version: '1.0.0',
    previewColor: '#0D6EFD',
    previewBg: '#F2F6FF',
    isBuiltin: true,
    isPublic: true,
    tokens: {
      ...ODOO_DEFAULT_TOKENS,
      colors: {
        ...ODOO_DEFAULT_TOKENS.colors,
        primary:   '#0D6EFD',
        bgApp:     '#F2F6FF',
        bgSidebar: '#1E40AF',
        bgHover:   'rgba(13,110,253,0.06)',
        bgActive:  'rgba(255,255,255,0.15)',
      },
    },
  },
];

@Injectable()
export class ThemeEngineService {
  private readonly logger = new Logger(ThemeEngineService.name);
  private readonly CACHE_PREFIX = 'theme:active:';

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventEmitter2,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
  ) {}

  async ensureBuiltinThemes(): Promise<void> {
    for (const bt of BUILTIN_THEMES) {
      await this.prisma.theme.upsert({
        where: { slug: bt.slug },
        create: bt as any,
        update: { tokens: bt.tokens as any, version: bt.version },
      });
    }
    this.logger.log('✓ Thèmes builtin initialisés');
  }

  async getActiveThemeForTenant(tenantId: string): Promise<any> {
    const cacheKey = `${this.CACHE_PREFIX}${tenantId}`;
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;

    const tenantTheme = await this.prisma.tenantTheme.findFirst({
      where: { tenantId, isActive: true },
      include: { theme: true },
    });

    const theme = tenantTheme?.theme || await this.prisma.theme.findUnique({ where: { slug: 'odoo-default' } });

    const result = {
      id: theme?.id,
      name: theme?.name,
      slug: theme?.slug,
      tokens: { ...(theme?.tokens as any), ...(tenantTheme?.customTokens as any || {}) },
    };

    await this.cache.set(cacheKey, result, 300_000); // 5 minutes
    return result;
  }

  async activateTheme(tenantId: string, themeId: string): Promise<any> {
    const theme = await this.prisma.theme.findUnique({ where: { id: themeId } });
    if (!theme) throw new NotFoundException('Thème introuvable');

    // Désactive tous les thèmes du tenant
    await this.prisma.tenantTheme.updateMany({
      where: { tenantId },
      data: { isActive: false },
    });

    // Active le nouveau
    await this.prisma.tenantTheme.upsert({
      where: { tenantId_themeId: { tenantId, themeId } },
      create: { tenantId, themeId, isActive: true, activatedAt: new Date() },
      update: { isActive: true, activatedAt: new Date() },
    });

    // Invalide le cache
    await this.cache.del(`${this.CACHE_PREFIX}${tenantId}`);

    this.events.emit('theme.activated', { tenantId, themeId, themeName: theme.name });
    this.logger.log(`[Tenant:${tenantId}] Thème '${theme.name}' activé`);

    return theme;
  }

  async updateCustomTokens(tenantId: string, tokens: Record<string, any>): Promise<void> {
    const active = await this.prisma.tenantTheme.findFirst({ where: { tenantId, isActive: true } });
    if (active) {
      await this.prisma.tenantTheme.update({
        where: { id: active.id },
        data: { customTokens: tokens },
      });
      await this.cache.del(`${this.CACHE_PREFIX}${tenantId}`);
    }
  }

  /**
   * Génère les CSS variables depuis les design tokens.
   */
  generateCssVariables(tokens: any): Record<string, string> {
    const vars: Record<string, string> = {};
    const flatten = (obj: any, prefix = '') => {
      for (const [key, value] of Object.entries(obj)) {
        const cssKey = `--${prefix}${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
        if (typeof value === 'object' && value !== null) {
          flatten(value, `${prefix}${key.replace(/([A-Z])/g, '-$1').toLowerCase()}-`);
        } else {
          vars[cssKey] = value as string;
        }
      }
    };
    flatten(tokens);
    return vars;
  }
}
