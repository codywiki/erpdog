import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";

import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { PasswordService } from "./password.service";

function parseTtlSeconds(value: string): number {
  const match = /^(?<amount>\d+)(?<unit>[smhd])?$/.exec(value);

  if (!match?.groups) {
    return 900;
  }

  const amount = Number(match.groups.amount);
  const unit = match.groups.unit ?? "s";
  const multipliers = {
    s: 1,
    m: 60,
    h: 60 * 60,
    d: 60 * 60 * 24,
  };

  return amount * multipliers[unit as keyof typeof multipliers];
}

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>("JWT_SECRET"),
        signOptions: {
          expiresIn: parseTtlSeconds(
            config.get<string>("JWT_ACCESS_TTL", "15m"),
          ),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, PasswordService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
