import "reflect-metadata";

import { type INestApplication, ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";

type SecurityHeaderResponse = {
  setHeader(name: string, value: string): void;
};

function useSecurityHeaders(app: INestApplication, isProduction: boolean) {
  app.use(
    (_request: unknown, response: SecurityHeaderResponse, next: () => void) => {
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.setHeader("X-Frame-Options", "DENY");
      response.setHeader("Referrer-Policy", "no-referrer");
      response.setHeader(
        "Permissions-Policy",
        "camera=(), microphone=(), geolocation=()",
      );

      if (isProduction) {
        response.setHeader(
          "Strict-Transport-Security",
          "max-age=15552000; includeSubDomains",
        );
      }

      next();
    },
  );
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const config = app.get(ConfigService);
  const appUrl = config.getOrThrow<string>("APP_URL");
  const isProduction = config.get<string>("NODE_ENV") === "production";

  app.setGlobalPrefix("api/v1");
  app.enableCors({ origin: appUrl, credentials: true });
  useSecurityHeaders(app, isProduction);
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  if (!isProduction) {
    const swaggerConfig = new DocumentBuilder()
      .setTitle("erpdog API")
      .setDescription("Internal ERP API for long-running service operations.")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup("api/docs", app, document);
  }

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
}

void bootstrap();
