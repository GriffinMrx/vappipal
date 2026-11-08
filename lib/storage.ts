import "server-only";

import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * Private file storage on Neon Object Storage (S3-compatible).
 * Credentials, endpoint and region come from the AWS_* env vars that
 * `neon deploy` / `neon env pull` write; they never reach the browser.
 * The browser only gets a short-lived POST policy for one exact key, or a
 * short-lived GET URL for its own file.
 */

export const BUCKET = process.env.STORAGE_BUCKET || "course-files";

/** Signed URLs (upload policy and file links) live this long. */
export const SIGNED_URL_SECONDS = 5 * 60;

const globalForS3 = globalThis as unknown as { s3?: S3Client };
const s3 = (globalForS3.s3 ??= new S3Client({ forcePathStyle: true }));

/** Presigned browser form upload, pinned to one key, one content type and a size range. */
export async function presignUpload({
  key,
  contentType,
  maxBytes,
}: {
  key: string;
  contentType: string;
  maxBytes: number;
}) {
  return createPresignedPost(s3, {
    Bucket: BUCKET,
    Key: key,
    Conditions: [
      ["eq", "$key", key],
      ["eq", "$Content-Type", contentType],
      ["content-length-range", 1, maxBytes],
    ],
    Fields: { "Content-Type": contentType },
    Expires: SIGNED_URL_SECONDS,
  });
}

/** Size and type of a stored object, or null when it does not exist. */
export async function headObject(key: string): Promise<{ size: number; contentType: string } | null> {
  try {
    const res = await s3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return { size: res.ContentLength ?? 0, contentType: res.ContentType ?? "" };
  } catch (err) {
    const status = (err as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
    if (status === 404 || (err as Error).name === "NotFound") return null;
    throw err;
  }
}

/** First `length` bytes of an object (for file-signature checks). */
export async function readHead(key: string, length = 16): Promise<Uint8Array> {
  const res = await s3.send(
    new GetObjectCommand({ Bucket: BUCKET, Key: key, Range: `bytes=0-${length - 1}` }),
  );
  return (await res.Body?.transformToByteArray()) ?? new Uint8Array();
}

/** Whole object as bytes (used by the processing job). */
export async function readObject(key: string): Promise<Uint8Array> {
  const res = await s3.send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  return (await res.Body?.transformToByteArray()) ?? new Uint8Array();
}

/** Short-lived GET link that opens the file inline with its original name. */
export function presignGet(key: string, fileName: string, contentType: string) {
  const ascii = fileName.replace(/[^\x20-\x7e]/g, "_").replace(/["\\]/g, "_");
  return getSignedUrl(
    s3,
    new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
      ResponseContentDisposition: `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      ResponseContentType: contentType,
    }),
    { expiresIn: SIGNED_URL_SECONDS },
  );
}

export async function deleteObject(key: string) {
  await s3.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
}
