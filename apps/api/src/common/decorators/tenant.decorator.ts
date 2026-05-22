import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur de paramètre @CurrentTenant() — extrait le tenant courant
 * du contexte de la requête (placé là par TenantMiddleware).
 *
 * Exemple :
 *   @Get('prospects')
 *   async list(@CurrentTenant() tenant: TenantContext) { ... }
 */
export const CurrentTenant = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const tenant = request.tenant;
    return data ? tenant?.[data] : tenant;
  },
);
