/**
 * Attachment contracts (Stage 5, APDR-0007) — large clinical files (reports,
 * scans) go directly to object storage via PRESIGNED URLs; the API never
 * proxies bytes. Flow: presign-upload → client PUTs to storage → register
 * metadata → presign-download for reads. Object keys are tenant-scoped.
 */
import { isoTimestampSchema, uuidSchema } from "@aiims/domain-types";
import { z } from "zod";

const contentTypeSchema = z.string().regex(/^[\w.-]+\/[\w.+-]+$/, "MIME type");

/** Ask for a presigned PUT URL before uploading a file. */
export const presignUploadRequestSchema = z.object({
  fileName: z.string().trim().min(1).max(200),
  contentType: contentTypeSchema,
  sizeBytes: z.number().int().positive().max(52_428_800), // 50 MiB cap
});
export type PresignUploadRequest = z.infer<typeof presignUploadRequestSchema>;

export const presignUploadResponseSchema = z.object({
  objectKey: z.string(),
  uploadUrl: z.string(),
  expiresInSeconds: z.number().int(),
});
export type PresignUploadResponse = z.infer<typeof presignUploadResponseSchema>;

/** Register the uploaded object's metadata (after the client PUT succeeds). */
export const registerAttachmentRequestSchema = z.object({
  objectKey: z.string().min(1),
  contentType: contentTypeSchema,
  sizeBytes: z.number().int().positive().max(52_428_800),
  sha256: z
    .string()
    .regex(/^[a-f0-9]{64}$/i, "hex sha-256")
    .optional(),
});
export type RegisterAttachmentRequest = z.infer<typeof registerAttachmentRequestSchema>;

export const attachmentResponseSchema = z.object({
  id: uuidSchema,
  encounterId: uuidSchema,
  objectKey: z.string(),
  contentType: z.string(),
  sizeBytes: z.number().int(),
  sha256: z.string().nullable(),
  uploadedAt: isoTimestampSchema,
});
export type AttachmentResponse = z.infer<typeof attachmentResponseSchema>;

export const presignDownloadResponseSchema = z.object({
  objectKey: z.string(),
  downloadUrl: z.string(),
  expiresInSeconds: z.number().int(),
});
export type PresignDownloadResponse = z.infer<typeof presignDownloadResponseSchema>;
