import {
  HttpException,
  HttpStatus,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";

import type {
  LoginResponse,
  PermissionCode,
  RoleCode,
} from "@erpdog/contracts";

import { PrismaService } from "../../common/prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { PasswordService } from "./password.service";

const LOGIN_FAILURE_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_LOCK_MS = 15 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;

type LoginFailureRecord = {
  count: number;
  firstFailedAt: number;
  lockedUntil?: number;
};

@Injectable()
export class AuthService {
  private readonly loginFailures = new Map<string, LoginFailureRecord>();

  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService,
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const account = dto.email.trim();
    const lookup = account.toLowerCase();
    this.assertLoginAllowed(lookup);

    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: lookup }, { phone: account }],
      },
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

    if (!user?.passwordHash || !user.isActive) {
      this.recordFailedLogin(lookup);
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatches = await this.passwordService.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      this.recordFailedLogin(lookup);
      throw new UnauthorizedException("Invalid email or password.");
    }

    this.loginFailures.delete(lookup);

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

    const payload = {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      phone: user.phone,
      name: user.name,
      roles,
      permissions,
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: "Bearer",
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "30d"),
      user: payload,
    };
  }

  private assertLoginAllowed(email: string) {
    const record = this.loginFailures.get(email);

    if (!record) {
      return;
    }

    const now = Date.now();

    if (record.lockedUntil && record.lockedUntil > now) {
      throw new HttpException(
        "Too many failed login attempts.",
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    if (now - record.firstFailedAt > LOGIN_FAILURE_WINDOW_MS) {
      this.loginFailures.delete(email);
    }
  }

  private recordFailedLogin(email: string) {
    const now = Date.now();
    const current = this.loginFailures.get(email);

    if (!current || now - current.firstFailedAt > LOGIN_FAILURE_WINDOW_MS) {
      this.loginFailures.set(email, {
        count: 1,
        firstFailedAt: now,
      });
      return;
    }

    const count = current.count + 1;
    this.loginFailures.set(email, {
      count,
      firstFailedAt: current.firstFailedAt,
      lockedUntil:
        count >= MAX_LOGIN_FAILURES ? now + LOGIN_LOCK_MS : undefined,
    });
  }
}
