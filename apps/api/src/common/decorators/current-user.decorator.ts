import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Décorateur de paramètre @CurrentUser() — extrait l'utilisateur authentifié
 * du contexte de la requête (placé là par JwtAuthGuard).
 *
 * Exemple :
 *   @Get('me')
 *   async getMe(@CurrentUser() user: UserPayload) { return user; }
 *
 * Avec un champ spécifique :
 *   @CurrentUser('id') userId: string
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
