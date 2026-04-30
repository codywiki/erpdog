import { UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService } from "@nestjs/jwt";
import { Injectable } from "@nestjs/common";

import type { LoginResponse, PermissionCode, RoleCode } from "@erpdog/contracts";

import { PrismaService } from "../../common/prisma/prisma.service";
import { LoginDto } from "./dto/login.dto";
import { PasswordService } from "./password.service";

@Injectable()
export class AuthService {
  constructor(
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
    private readonly prisma: PrismaService
  ) {}

  async login(dto: LoginDto): Promise<LoginResponse> {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                permissions: {
                  include: {
                    permission: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!user?.passwordHash || !user.isActive) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const passwordMatches = await this.passwordService.compare(
      dto.password,
      user.passwordHash
    );

    if (!passwordMatches) {
      throw new UnauthorizedException("Invalid email or password.");
    }

    const roles = user.userRoles.map((userRole) => userRole.role.code as RoleCode);
    const permissions = Array.from(
      new Set(
        user.userRoles.flatMap((userRole) =>
          userRole.role.permissions.map(
            (rolePermission) =>
              rolePermission.permission.code as PermissionCode
          )
        )
      )
    );

    const payload = {
      id: user.id,
      orgId: user.orgId,
      email: user.email,
      name: user.name,
      roles,
      permissions
    };

    return {
      accessToken: await this.jwtService.signAsync(payload),
      tokenType: "Bearer",
      expiresIn: this.config.get<string>("JWT_ACCESS_TTL", "15m"),
      user: payload
    };
  }
}

