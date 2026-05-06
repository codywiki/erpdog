import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  type BucketLocationConstraint,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const PRESIGNED_URL_EXPIRES_IN = 15 * 60;
const ALLOWED_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
  "image/webp",
  "text/csv",
  "text/plain",
]);

export type PresignedUploadRequest = {
  orgId: string;
  fileName: string;
  contentType?: string;
  sizeBytes?: number;
};

export type PresignedUploadResponse = {
  storageKey: string;
  upload: {
    url: string;
    method: "PUT";
    headers: Record<string, string>;
    expiresIn: number;
  };
};

export type PresignedDownloadResponse = {
  url: string;
  expiresIn: number;
};

export type PresignedDownloadDisposition = "attachment" | "inline";

@Injectable()
export class StorageService {
  private client?: S3Client;
  private bucketReady?: Promise<void>;

  constructor(private readonly config: ConfigService) {}

  async createPresignedUpload(
    request: PresignedUploadRequest,
  ): Promise<PresignedUploadResponse> {
    this.validateAttachment(request);
    const storageKey = this.createStorageKey(request.orgId, request.fileName);
    const contentType = request.contentType ?? "application/octet-stream";
    await this.ensureBucket();

    const command = new PutObjectCommand({
      Bucket: this.bucket(),
      Key: storageKey,
      ContentType: contentType,
      ContentLength: request.sizeBytes,
    });

    return {
      storageKey,
      upload: {
        url: await getSignedUrl(this.s3(), command, {
          expiresIn: PRESIGNED_URL_EXPIRES_IN,
        }),
        method: "PUT",
        headers: {
          "Content-Type": contentType,
        },
        expiresIn: PRESIGNED_URL_EXPIRES_IN,
      },
    };
  }

  async createPresignedDownload(
    storageKey: string,
    fileName: string,
    disposition: PresignedDownloadDisposition = "attachment",
  ): Promise<PresignedDownloadResponse> {
    await this.ensureBucket();
    const command = new GetObjectCommand({
      Bucket: this.bucket(),
      Key: storageKey,
      ResponseContentDisposition: `${disposition}; filename="${this.asciiFileName(fileName)}"`,
    });

    return {
      url: await getSignedUrl(this.s3(), command, {
        expiresIn: PRESIGNED_URL_EXPIRES_IN,
      }),
      expiresIn: PRESIGNED_URL_EXPIRES_IN,
    };
  }

  private s3() {
    if (this.client) {
      return this.client;
    }

    const endpoint = this.config.get<string>("S3_ENDPOINT");
    const accessKeyId = this.config.get<string>("S3_ACCESS_KEY");
    const secretAccessKey = this.config.get<string>("S3_SECRET_KEY");

    if (!endpoint || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException(
        "S3 storage is not configured. Set S3_ENDPOINT, S3_ACCESS_KEY, and S3_SECRET_KEY.",
      );
    }

    this.client = new S3Client({
      endpoint,
      region: this.config.get<string>("S3_REGION", "local"),
      forcePathStyle: this.config.get<boolean>("S3_FORCE_PATH_STYLE", true),
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    return this.client;
  }

  private bucket() {
    return this.config.get<string>("S3_BUCKET", "erpdog");
  }

  private ensureBucket() {
    this.bucketReady ??= this.createBucketIfMissing();
    return this.bucketReady;
  }

  private async createBucketIfMissing() {
    const bucket = this.bucket();
    try {
      await this.s3().send(new HeadBucketCommand({ Bucket: bucket }));
      return;
    } catch {
      const region = this.config.get<string>("S3_REGION", "local");
      await this.s3().send(
        new CreateBucketCommand({
          Bucket: bucket,
          CreateBucketConfiguration:
            region === "local" || region === "us-east-1"
              ? undefined
              : {
                  LocationConstraint: region as BucketLocationConstraint,
                },
        }),
      );
    }
  }

  private validateAttachment(request: PresignedUploadRequest) {
    if (
      request.contentType &&
      !ALLOWED_ATTACHMENT_TYPES.has(request.contentType)
    ) {
      throw new BadRequestException("Unsupported attachment content type.");
    }

    if (
      request.sizeBytes !== undefined &&
      (request.sizeBytes <= 0 || request.sizeBytes > MAX_ATTACHMENT_BYTES)
    ) {
      throw new BadRequestException(
        "Attachment size must be greater than 0 and no larger than 20 MB.",
      );
    }
  }

  private createStorageKey(orgId: string, fileName: string) {
    const today = new Date();
    const month = `${today.getUTCFullYear()}-${String(
      today.getUTCMonth() + 1,
    ).padStart(2, "0")}`;
    return [
      "attachments",
      orgId,
      month,
      `${randomUUID()}-${this.safeFileName(fileName)}`,
    ].join("/");
  }

  private safeFileName(fileName: string) {
    return (
      fileName
        .normalize("NFKD")
        .replace(/[^\w.-]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 120) || "attachment"
    );
  }

  private asciiFileName(fileName: string) {
    return this.safeFileName(fileName).replace(/"/g, "");
  }
}
