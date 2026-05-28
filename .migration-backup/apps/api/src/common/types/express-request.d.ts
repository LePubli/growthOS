import 'express';
import { UserPayload } from '../interfaces/user-payload.interface';
import { TenantContext } from '../interfaces/tenant-context.interface';

declare module 'express' {
  interface Request {
    user?: UserPayload;
    tenant?: TenantContext;
  }
}
