import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { PermissionCode, AuthenticatedUser } from "@erpdog/contracts";

import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";
import { REQUIRED_PERMISSIONS } from "../decorators/permissions.decorator";

type RequestWithUser = {
  user?: AuthenticatedUser;
};

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const required = this.reflector.getAllAndOverride<PermissionCode[]>(
      REQUIRED_PERMISSIONS,
      [context.getHandler(), context.getClass()]
    );

    if (!required?.length) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const userPermissions = new Set(request.user?.permissions ?? []);
    const canAccess = required.some((permission) =>
      userPermissions.has(permission)
    );

    if (!canAccess) {
      throw new ForbiddenException("You do not have permission for this action.");
    }

    return true;
  }
}
