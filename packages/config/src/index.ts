import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => value === true || value === "true");

export const serverEnvSchema = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    APP_URL: z.string().url().default("http://localhost:3000"),
    API_URL: z.string().url().default("http://localhost:4000"),
    DATABASE_URL: z.string().min(1),
    REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
    JWT_SECRET: z.string().min(24),
    JWT_ACCESS_TTL: z.string().default("15m"),
    S3_ENDPOINT: z.string().url().optional(),
    S3_REGION: z.string().default("local"),
    S3_BUCKET: z.string().default("erpdog"),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
    S3_FORCE_PATH_STYLE: booleanFromString.default(true),
    ADMIN_EMAIL: z.string().email().default("admin@erpdog.local"),
    ADMIN_PASSWORD: z.string().min(8).default("ChangeMe123!"),
    ADMIN_NAME: z.string().min(1).default("System Admin"),
  })
  .superRefine((env, context) => {
    if (env.NODE_ENV !== "production") {
      return;
    }

    if (
      env.JWT_SECRET === "replace-with-a-long-random-secret" ||
      env.JWT_SECRET === "replace-with-at-least-24-random-characters" ||
      env.JWT_SECRET.includes("replace-with") ||
      env.JWT_SECRET.startsWith("generate-")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "JWT_SECRET must be changed before running in production.",
        path: ["JWT_SECRET"],
      });
    }

    if (
      env.ADMIN_PASSWORD === "ChangeMe123!" ||
      env.ADMIN_PASSWORD.startsWith("generate-")
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "ADMIN_PASSWORD must be changed before running in production.",
        path: ["ADMIN_PASSWORD"],
      });
    }
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function parseServerEnv(env: NodeJS.ProcessEnv): ServerEnv {
  return serverEnvSchema.parse(env);
}
