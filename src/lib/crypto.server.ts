// Server-only crypto helpers for tokens and OTPs.
import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function generateOtpCode(): string {
  // 6-digit numeric
  const n = randomBytes(3).readUIntBE(0, 3) % 1000000;
  return n.toString().padStart(6, "0");
}

export async function hashSecret(secret: string): Promise<string> {
  return bcrypt.hash(secret, 10);
}

export async function compareSecret(secret: string, hash: string): Promise<boolean> {
  return bcrypt.compare(secret, hash);
}

// ---- Gateway capability tokens (HMAC-SHA256, short-lived, tamper-proof) ----
import { createHmac, timingSafeEqual } from "crypto";

function gwSecret(): string {
  const base = process.env["GATEWAY_SIGNING_SECRET"] || process.env["R2_SECRET_ACCESS_KEY"] || process.env["SUPABASE_SERVICE_ROLE_KEY"];
  if (!base) throw new Error("Gateway signing secret unavailable");
  return createHash("sha256").update("ashish-gw-v1:" + base).digest("hex");
}

export type GwClaims = { f: string; d: 0 | 1; e: number; n: string };

export function signGatewayToken(fileId: string, download: boolean, ttlSec = 600): string {
  const claims: GwClaims = { f: fileId, d: download ? 1 : 0, e: Math.floor(Date.now() / 1000) + ttlSec, n: randomBytes(8).toString("base64url") };
  const body = Buffer.from(JSON.stringify(claims)).toString("base64url");
  const sig = createHmac("sha256", gwSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyGatewayToken(token: string): GwClaims | null {
  const [body, sig] = token.split(".");
  if (!body || !sig || token.length > 512) return null;
  const expected = createHmac("sha256", gwSecret()).update(body).digest();
  const got = Buffer.from(sig, "base64url");
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const c = JSON.parse(Buffer.from(body, "base64url").toString()) as GwClaims;
    if (typeof c.f !== "string" || typeof c.e !== "number" || c.e < Date.now() / 1000) return null;
    return c;
  } catch { return null; }
}
