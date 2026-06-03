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
