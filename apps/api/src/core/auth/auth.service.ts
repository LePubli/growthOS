import {
  Injectable, UnauthorizedException, ConflictException,
  BadRequestException, Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../shared/database/prisma.service';
import { TenantPrismaService } from '../../shared/database/tenant-prisma.service';
import * as bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

export interface JwtPayload {
  sub: string;       // userId
  email: string;
  tenantId?: string;
  tenantSchema?: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantPrisma: TenantPrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  /**
   * Inscription + création du premier tenant
   */
  async register(dto: RegisterDto): Promise<AuthTokens> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email déjà utilisé');

    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Transaction : créer user + tenant + relation
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Créer l'utilisateur
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          firstName: dto.firstName,
          lastName: dto.lastName,
        },
      });

      // 2. Créer le plan par défaut (trial)
      let plan = await tx.plan.findFirst({ where: { name: 'starter' } });
      if (!plan) {
        plan = await tx.plan.create({
          data: {
            name: 'starter',
            displayName: 'Starter',
            description: 'Plan gratuit 14 jours',
            priceMonthly: 0,
            priceYearly: 0,
            features: { plugins: 5, users: 2, prospects: 1000 },
            limits: { prospects_per_month: 500, emails_per_month: 1000 },
          },
        });
      }

      // 3. Générer le slug du tenant
      const baseSlug = dto.companyName
        ? dto.companyName.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').slice(0, 30)
        : dto.email.split('@')[0].replace(/[^a-z0-9]/g, '-').slice(0, 20);
      const slug = `${baseSlug}-${randomUUID().slice(0, 6)}`;
      const schemaName = `tenant_${slug.replace(/-/g, '_')}`;

      // 4. Créer le tenant
      const tenant = await tx.tenant.create({
        data: {
          name: dto.companyName || dto.email.split('@')[0],
          slug,
          schemaName,
          planId: plan.id,
          status: 'TRIAL',
          trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
          branding: { companyName: dto.companyName },
          settings: { timezone: 'Europe/Paris', language: 'fr' },
        },
      });

      // 5. Relation owner
      await tx.tenantUser.create({
        data: { tenantId: tenant.id, userId: user.id, role: 'owner', joinedAt: new Date() },
      });

      return { user, tenant };
    });

    // 6. Créer le schema PostgreSQL du tenant
    await this.tenantPrisma.createTenantSchema(result.tenant.schemaName);

    // 7. Générer les tokens
    return this.generateTokens(result.user.id, result.user.email, result.tenant.id, result.tenant.schemaName, 'owner');
  }

  /**
   * Connexion
   */
  async login(dto: LoginDto, tenantSlug?: string): Promise<AuthTokens & { tenant?: any; user?: any }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) throw new UnauthorizedException('Identifiants invalides');

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Identifiants invalides');

    // Trouver le tenant
    let tenantUser: any = null;
    if (tenantSlug) {
      const tenant = await this.prisma.tenant.findUnique({ where: { slug: tenantSlug } });
      if (tenant) {
        tenantUser = await this.prisma.tenantUser.findUnique({
          where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } },
          include: { tenant: true },
        });
      }
    } else {
      // Premier tenant du user
      tenantUser = await this.prisma.tenantUser.findFirst({
        where: { userId: user.id, isActive: true },
        include: { tenant: true },
        orderBy: { createdAt: 'asc' },
      });
    }

    if (!tenantUser) throw new UnauthorizedException('Accès tenant refusé');

    // Mise à jour last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const tokens = await this.generateTokens(
      user.id, user.email,
      tenantUser.tenant.id,
      tenantUser.tenant.schemaName,
      tenantUser.role,
    );

    return {
      ...tokens,
      user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName, avatar: user.avatar },
      tenant: { id: tenantUser.tenant.id, name: tenantUser.tenant.name, slug: tenantUser.tenant.slug, branding: tenantUser.tenant.branding },
    };
  }

  /**
   * Refresh access token
   */
  async refreshTokens(refreshToken: string): Promise<AuthTokens> {
    const stored = await this.prisma.refreshToken.findUnique({ where: { token: refreshToken }, include: { user: true } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token invalide ou expiré');
    }

    // Révoque l'ancien et génère de nouveaux
    await this.prisma.refreshToken.update({ where: { id: stored.id }, data: { revokedAt: new Date() } });

    const tenantUser = await this.prisma.tenantUser.findFirst({
      where: { userId: stored.userId, isActive: true },
      include: { tenant: true },
    });

    if (!tenantUser) throw new UnauthorizedException('Tenant introuvable');

    return this.generateTokens(stored.userId, stored.user.email, tenantUser.tenant.id, tenantUser.tenant.schemaName, tenantUser.role);
  }

  /**
   * Génère un access token + refresh token
   */
  private async generateTokens(
    userId: string, email: string,
    tenantId: string, tenantSchema: string, role: string,
  ): Promise<AuthTokens> {
    const payload: JwtPayload = { sub: userId, email, tenantId, tenantSchema, role };
    const expiresIn = 15 * 60; // 15 minutes

    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, { expiresIn }),
      this.generateRefreshToken(userId),
    ]);

    return { accessToken, refreshToken, expiresIn };
  }

  private async generateRefreshToken(userId: string): Promise<string> {
    const token = randomUUID() + '-' + randomUUID();
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours

    await this.prisma.refreshToken.create({ data: { userId, token, expiresAt } });
    return token;
  }

  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user && user.passwordHash && await bcrypt.compare(password, user.passwordHash)) {
      const { passwordHash, ...result } = user;
      return result;
    }
    return null;
  }
}
