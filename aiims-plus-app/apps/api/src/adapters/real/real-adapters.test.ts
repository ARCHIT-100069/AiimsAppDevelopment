/**
 * Stage 8 real-adapter tests. These prove the adapters are BUILT and disabled:
 *   - each fails fast when selected without credentials (never silent fallback);
 *   - the real S3 SigV4 presigner produces a deterministic, well-formed URL
 *     (no network needed) — the same algorithm AWS/MinIO verify.
 */
import { describe, expect, it } from "vitest";
import type { AppConfig } from "@aiims/config";
import { RealAbdmGateway } from "./real-abdm.gateway";
import { RealNotificationSender } from "./real-notification.sender";
import { RealPaymentGateway } from "./real-payment.gateway";
import { RealStorageGateway } from "./real-storage.gateway";

const base = { S3_REGION: "ap-south-1", S3_BUCKET: "aiims-clinical" } as unknown as AppConfig;

describe("real adapters fail fast without credentials (Stage 8)", () => {
  it("ABDM requires base URL + client id/secret", () => {
    expect(() => new RealAbdmGateway(base)).toThrow(/requires/);
  });
  it("payment requires base URL + api key", () => {
    expect(() => new RealPaymentGateway(base)).toThrow(/requires/);
  });
  it("notification requires base URL + api key", () => {
    expect(() => new RealNotificationSender(base)).toThrow(/requires/);
  });
  it("storage requires endpoint + access key + secret", () => {
    expect(() => new RealStorageGateway(base)).toThrow(/requires/);
  });
});

describe("real S3 SigV4 presigner (production-shaped, offline)", () => {
  const gw = new RealStorageGateway({
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "ap-south-1",
    S3_BUCKET: "aiims-clinical",
    S3_ACCESS_KEY_ID: "minioadmin",
    S3_SECRET_ACCESS_KEY: "minioadmin",
  } as unknown as AppConfig);

  it("produces a well-formed presigned PUT URL with all SigV4 query params", async () => {
    const { url, expiresInSeconds } = await gw.presignUpload({
      objectKey: "t/tenant-a/enc/e1/file.pdf",
      contentType: "application/pdf",
    });
    expect(expiresInSeconds).toBe(900);
    expect(url).toContain("http://localhost:9000/aiims-clinical/t/tenant-a/enc/e1/file.pdf?");
    for (const p of [
      "X-Amz-Algorithm=AWS4-HMAC-SHA256",
      "X-Amz-Credential=minioadmin",
      "X-Amz-Date=",
      "X-Amz-Expires=900",
      "X-Amz-SignedHeaders=host",
      "X-Amz-Signature=",
    ]) {
      expect(url).toContain(p);
    }
    // Signature is a 64-char lowercase hex HMAC-SHA256.
    const sig = new URL(url).searchParams.get("X-Amz-Signature") ?? "";
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });

  it("download URL differs from upload URL (method is signed)", async () => {
    const put = await gw.presignUpload({ objectKey: "k", contentType: "text/plain" });
    const get = await gw.presignDownload({ objectKey: "k" });
    // Same key, different HTTP verb ⇒ different signature (canonical request differs).
    const putSig = new URL(put.url).searchParams.get("X-Amz-Signature");
    const getSig = new URL(get.url).searchParams.get("X-Amz-Signature");
    expect(putSig).not.toBe(getSig);
  });
});
