import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { PositionLevel, RoleCode } from '../../generated/prisma/client.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  fullName: string;
  role: RoleCode;
  position: PositionLevel;
  department: string | null;
  mustChangePassword: boolean;
  tokenVersion: number;
  jti?: string;
}

export const CurrentUser = createParamDecorator(
  (field: keyof AuthenticatedUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const user = request.user;
    if (!user) {
      return undefined;
    }
    return field ? user[field] : user;
  },
);

