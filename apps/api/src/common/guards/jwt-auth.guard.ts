import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { JwtService } from "@nestjs/jwt";

import type { AuthenticatedUser } from "@erpdog/contracts";

import { IS_PUBLIC_ROUTE } from "../decorators/public.decorator";

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
    private readonly jwtService: JwtService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_ROUTE, [
      context.getHandler(),
      context.getClass()
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithAuth>();
    const token = this.extractBearerToken(request.headers.authorization);

    if (!token) {
      throw new UnauthorizedException("Missing bearer token.");
    }

    try {
      request.user = await this.jwtService.verifyAsync<AuthenticatedUser>(
        token
      );
      return true;
    } catch {
      throw new UnauthorizedException("Invalid or expired bearer token.");
    }
  }

  private extractBearerToken(header?: string): string | undefined {
    const [type, token] = header?.split(" ") ?? [];
    return type === "Bearer" ? token : undefined;
  }
}

