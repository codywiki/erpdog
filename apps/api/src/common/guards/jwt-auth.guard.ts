import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import type {
  AuthenticatedUser,
  PermissionCode,
  RoleCode,
} from "@erpdog/contracts";

import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";
import { PrismaService } from "../prisma/prisma.service";

type RequestWithAuth = {
  headers: {
    authorization?: string;
  };
  user?: AuthenticatedUser;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(
      IS_PUBLIC_ROUTE,
      [context.getHandler(), context.getClass()],
    );

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    try {
      const payload =
        await this.jwtService.verifyAsync<AuthenticatedUser>(token);
      request.user = await this.currentUser(payload.id);
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired bearer token.");
    }
  }

  private extractBearerToken(header?: string): string | undefined {
    const [type, token] = header?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }

  private async currentUser(userId: string): Promise<AuthenticatedUser> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, isActive: true },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!user) {
      throw new UnauthorizedException("Invalid or expired bearer token.");
    }

    const roles = user.userRoles.map(
      (userRole) => userRole.role.code as RoleCode,
    );
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) =>
              rolePermission.permission.code as PermissionCode,
          ),
        ),
      ),
    );

    return {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      roles,
      permissions,
    };
  }
}
