/**
 * Real object storage (Stage 8, APDR-0007) — genuine AWS Signature V4 presigned
 * URLs (path-style, works against AWS S3 and MinIO) behind the StorageGateway
 * port. Dependency-free: SigV4 is computed with node:crypto. Disabled until
 * `ADAPTER_STORAGE=real` + `S3_ENDPOINT`/`S3_REGION`/`S3_BUCKET` +
 * `S3_ACCESS_KEY_ID`/`S3_SECRET_ACCESS_KEY`; constructed only then. Bytes never
 * touch the API — the client transfers directly to storage with the URL.
 */
import { createHash, createHmac } from "node:crypto";
import type { AppConfig } from "@aiims/config";
import type { StorageGateway } from "../ports";

const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";

export class RealStorageGateway implements StorageGateway {
  private readonly endpoint: URL;
  private readonly region: string;
  private readonly bucket: string;
  private readonly accessKeyId: string;
  private readonly secretAccessKey: string;

  constructor(config: AppConfig) {
    if (!config.S3_ENDPOINT || !config.S3_ACCESS_KEY_ID || !config.S3_SECRET_ACCESS_KEY) {
      throw new Error(
        "StorageGateway: ADAPTER_STORAGE=real requires S3_ENDPOINT, S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY",
      );
    }
    this.endpoint = new URL(config.S3_ENDPOINT);
    this.region = config.S3_REGION;
    this.bucket = config.S3_BUCKET;
    this.accessKeyId = config.S3_ACCESS_KEY_ID;
    this.secretAccessKey = config.S3_SECRET_ACCESS_KEY;
  }

  async presignUpload(input: {
    objectKey: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = input.expiresInSeconds ?? 900;
    return { url: this.presign("PUT", input.objectKey, expiresInSeconds), expiresInSeconds };
  }

  async presignDownload(input: {
    objectKey: string;
    expiresInSeconds?: number;
  }): Promise<{ url: string; expiresInSeconds: number }> {
    const expiresInSeconds = input.expiresInSeconds ?? 900;
    return { url: this.presign("GET", input.objectKey, expiresInSeconds), expiresInSeconds };
  }

  /** AWS SigV4 query-parameter (presigned) URL — path-style addressing. */
  private presign(method: "GET" | "PUT", objectKey: string, expires: number): string {
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, ""); // YYYYMMDDTHHMMSSZ
    const dateStamp = amzDate.slice(0, 8);
    const host = this.endpoint.host;
    const credentialScope = `${dateStamp}/${this.region}/${SERVICE}/aws4_request`;
    const canonicalUri = `/${this.bucket}/${objectKey.split("/").map(encodeURIComponent).join("/")}`;

    const query: Record<string, string> = {
      "X-Amz-Algorithm": ALGORITHM,
      "X-Amz-Credential": `${this.accessKeyId}/${credentialScope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(expires),
      "X-Amz-SignedHeaders": "host",
    };
    const canonicalQuery = Object.keys(query)
      .sort()
      .map((k) => `${encodeRfc3986(k)}=${encodeRfc3986(query[k]!)}`)
      .join("&");

    const canonicalHeaders = `host:${host}\n`;
    const canonicalRequest = [
      method,
      canonicalUri,
      canonicalQuery,
      canonicalHeaders,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");

    const stringToSign = [
      ALGORITHM,
      amzDate,
      credentialScope,
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");

    const signingKey = hmacChain(`AWS4${this.secretAccessKey}`, [
      dateStamp,
      this.region,
      SERVICE,
      "aws4_request",
    ]);
    const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex");

    return `${this.endpoint.origin}${canonicalUri}?${canonicalQuery}&X-Amz-Signature=${signature}`;
  }
}

function hmacChain(key: string | Buffer, parts: string[]): Buffer {
  let acc: Buffer = typeof key === "string" ? Buffer.from(key, "utf8") : key;
  for (const part of parts) acc = createHmac("sha256", acc).update(part).digest();
  return acc;
}

/** RFC 3986 encoding (AWS-strict): also escape ! * ' ( ). */
function encodeRfc3986(s: string): string {
  return encodeURIComponent(s).replace(
    /[!*'()]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}
