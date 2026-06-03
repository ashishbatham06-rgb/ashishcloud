// Server-only R2 (S3-compatible) helpers.
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing R2 secret: ${name}. Add it in Lovable Cloud secrets.`);
  return v;
}

let _client: S3Client | null = null;
export function r2Client(): S3Client {
  if (_client) return _client;
  const accountId = getEnv("R2_ACCOUNT_ID");
  _client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: getEnv("R2_ACCESS_KEY_ID"),
      secretAccessKey: getEnv("R2_SECRET_ACCESS_KEY"),
    },
  });
  return _client;
}

export function bucket(): string {
  return getEnv("R2_BUCKET");
}

export function isR2Configured(): boolean {
  return !!(process.env.R2_ACCOUNT_ID && process.env.R2_ACCESS_KEY_ID && process.env.R2_SECRET_ACCESS_KEY && process.env.R2_BUCKET);
}

export async function presignPutUrl(key: string, contentType: string, expiresIn = 600): Promise<string> {
  const cmd = new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType });
  return getSignedUrl(r2Client(), cmd, { expiresIn });
}

export async function presignGetUrl(key: string, filename?: string, expiresIn = 600): Promise<string> {
  const cmd = new GetObjectCommand({
    Bucket: bucket(),
    Key: key,
    ResponseContentDisposition: filename ? `attachment; filename="${encodeURIComponent(filename)}"` : undefined,
  });
  return getSignedUrl(r2Client(), cmd, { expiresIn });
}

export async function deleteObject(key: string): Promise<void> {
  await r2Client().send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}

export async function headObject(key: string): Promise<{ size: number } | null> {
  try {
    const res = await r2Client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
    return { size: Number(res.ContentLength ?? 0) };
  } catch {
    return null;
  }
}

export function makeKey(userId: string, filename: string): string {
  const safe = filename.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  const stamp = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `users/${userId}/${stamp}-${rand}-${safe}`;
}
