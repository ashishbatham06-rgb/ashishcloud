import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { sha256 } from "@/lib/crypto.server";

const COOKIE_NAME = "__Host-ashish-session";
const WEB_SESSION_SECONDS = 8 * 60 * 60;
const encoder = new TextEncoder();

type AuthUser = { id: string; email?: string | null };
type AuthTokens = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
};
type StoredSession = AuthTokens & { session_expires_at: number };

export type GatewayIdentity = {
  userId: string;
  email: string | null;
  accessToken: string;
  session?: StoredSession;
  setCookie?: string;
  clearCookie?: boolean;
};

class AuthGatewayError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function authConfig() {
  const baseUrl = process.env["SUPABASE_URL"]?.replace(/\/+$/, "");
  const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!baseUrl || !publishableKey) throw new Error("Authentication service is unavailable.");
  return { baseUrl, publishableKey };
}

function bytesToBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes, (value) => String.fromCharCode(value)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;
  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(base64 + "=".repeat((4 - (base64.length % 4)) % 4));
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
  } catch {
    return null;
  }
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

async function sessionKey(): Promise<CryptoKey> {
  const secret = process.env["BFF_SESSION_SECRET"];
  if (!secret || secret.length < 32) throw new Error("Secure session configuration is unavailable.");
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function sealSession(session: StoredSession): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await sessionKey();
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(COOKIE_NAME) },
    key,
    encoder.encode(JSON.stringify(session)),
  );
  return `${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(ciphertext))}`;
}

async function openSession(value: string): Promise<StoredSession | null> {
  const [ivPart, dataPart, extra] = value.split(".");
  if (!ivPart || !dataPart || extra) return null;
  const iv = base64UrlToBytes(ivPart);
  const ciphertext = base64UrlToBytes(dataPart);
  if (!iv || iv.length !== 12 || !ciphertext) return null;
  try {
    const key = await sessionKey();
    const clear = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(iv), additionalData: encoder.encode(COOKIE_NAME) },
      key,
      toArrayBuffer(ciphertext),
    );
    const parsed = JSON.parse(new TextDecoder().decode(clear)) as Partial<StoredSession>;
    if (
      typeof parsed.access_token !== "string" ||
      typeof parsed.refresh_token !== "string" ||
      typeof parsed.expires_at !== "number" ||
      typeof parsed.session_expires_at !== "number" ||
      typeof parsed.user?.id !== "string"
    ) return null;
    return parsed as StoredSession;
  } catch {
    return null;
  }
}

function cookieValue(request: Request): string | null {
  const raw = request.headers.get("cookie") ?? "";
  for (const part of raw.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");
    if (name === COOKIE_NAME) return valueParts.join("=") || null;
  }
  return null;
}

export async function createSessionCookie(tokens: AuthTokens, sessionExpiresAt = Math.floor(Date.now() / 1000) + WEB_SESSION_SECONDS): Promise<string> {
  const session: StoredSession = { ...tokens, session_expires_at: sessionExpiresAt };
  const maxAge = Math.max(0, Math.min(WEB_SESSION_SECONDS, sessionExpiresAt - Math.floor(Date.now() / 1000)));
  const sealed = await sealSession(session);
  return `${COOKIE_NAME}=${sealed}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;
}

export function clearSessionCookie(): string {
  return `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`;
}

async function authRequest(path: string, body: Record<string, unknown>, accessToken?: string): Promise<Record<string, unknown>> {
  const { baseUrl, publishableKey } = authConfig();
  const headers = new Headers({
    apikey: publishableKey,
    "content-type": "application/json",
  });
  if (accessToken) headers.set("authorization", `Bearer ${accessToken}`);
  const response = await fetch(`${baseUrl}/auth/v1/${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    redirect: "manual",
  });
  const result = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!response.ok || !result) {
    const isCredentials = response.status === 400 || response.status === 401;
    throw new AuthGatewayError(isCredentials ? "Email or password is incorrect." : "Authentication is temporarily unavailable.", isCredentials ? 401 : 502);
  }
  return result;
}

function tokensFromPayload(payload: Record<string, unknown>): AuthTokens | null {
  const user = payload.user as AuthUser | undefined;
  if (
    typeof payload.access_token !== "string" ||
    typeof payload.refresh_token !== "string" ||
    !user || typeof user.id !== "string"
  ) return null;
  const expiresIn = typeof payload.expires_in === "number" ? payload.expires_in : 3600;
  const expiresAt = typeof payload.expires_at === "number" ? payload.expires_at : Math.floor(Date.now() / 1000) + expiresIn;
  return {
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: expiresAt,
    user: { id: user.id, email: user.email ?? null },
  };
}

export async function passwordGrant(email: string, password: string): Promise<AuthTokens> {
  const payload = await authRequest("token?grant_type=password", { email, password });
  const tokens = tokensFromPayload(payload);
  if (!tokens) throw new AuthGatewayError("Sign-in could not be completed.", 502);
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: profile, error } = await supabaseAdmin
    .from("profiles")
    .select("disabled")
    .eq("id", tokens.user.id)
    .maybeSingle();
  if (error || profile?.disabled) {
    await revokeAccessToken(tokens.access_token).catch(() => null);
    throw new AuthGatewayError(profile?.disabled ? "This account is disabled." : "Account access could not be verified.", 403);
  }
  return tokens;
}

export async function rotateRefreshToken(refreshToken: string): Promise<AuthTokens> {
  const payload = await authRequest("token?grant_type=refresh_token", { refresh_token: refreshToken });
  const tokens = tokensFromPayload(payload);
  if (!tokens) throw new AuthGatewayError("Your session expired. Please sign in again.", 401);
  return tokens;
}

export async function revokeAccessToken(accessToken: string): Promise<void> {
  const { baseUrl, publishableKey } = authConfig();
  await fetch(`${baseUrl}/auth/v1/logout`, {
    method: "POST",
    headers: { apikey: publishableKey, authorization: `Bearer ${accessToken}` },
    redirect: "manual",
  });
}

async function verifiedIdentity(accessToken: string): Promise<{ userId: string; email: string | null } | null> {
  const { baseUrl, publishableKey } = authConfig();
  const supabase = createClient<Database>(baseUrl, publishableKey, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) return null;
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("disabled")
    .eq("id", data.user.id)
    .maybeSingle();
  if (profileError || profile?.disabled) return null;
  return { userId: data.user.id, email: data.user.email ?? null };
}

export async function resolveGatewayIdentity(request: Request, allowBearer = false): Promise<GatewayIdentity | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  if (allowBearer && authHeader.startsWith("Bearer ")) {
    const accessToken = authHeader.slice(7).trim();
    if (!accessToken) return null;
    const identity = await verifiedIdentity(accessToken);
    return identity ? { ...identity, accessToken } : null;
  }

  const sealed = cookieValue(request);
  if (!sealed) return null;
  let session = await openSession(sealed);
  if (!session) return { userId: "", email: null, accessToken: "", clearCookie: true };
  const now = Math.floor(Date.now() / 1000);
  if (session.session_expires_at <= now) return { userId: "", email: null, accessToken: "", clearCookie: true };

  let setCookie: string | undefined;
  if (session.expires_at <= now + 90) {
    try {
      const rotated = await rotateRefreshToken(session.refresh_token);
      session = { ...rotated, session_expires_at: session.session_expires_at };
      setCookie = await createSessionCookie(session, session.session_expires_at);
    } catch {
      return { userId: "", email: null, accessToken: "", clearCookie: true };
    }
  }

  const identity = await verifiedIdentity(session.access_token);
  if (!identity) return { userId: "", email: null, accessToken: "", clearCookie: true };
  return { ...identity, accessToken: session.access_token, session, ...(setCookie ? { setCookie } : {}) };
}

export class GatewayRateLimitError extends Error {}

export async function consumeGatewayLimit(key: string, max: number, windowSeconds: number): Promise<boolean> {
  if (!key || key.length > 256) return false;
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin.rpc("consume_gateway_rate_limit", {
      p_bucket_hash: sha256(`ashish-gateway-rate-v1:${key}`),
      p_max_hits: max,
      p_window_seconds: windowSeconds,
    });
    if (error) {
      console.error("[gateway] persistent request limit unavailable", error.message);
      return false;
    }
    return data === true;
  } catch (error) {
    console.error("[gateway] persistent request limit failed", error);
    return false;
  }
}

export async function consumeRequestNonce(request: Request, scope: string): Promise<boolean> {
  const nonce = request.headers.get("x-request-nonce") ?? "";
  if (!/^[A-Za-z0-9_-]{16,128}$/.test(nonce)) return false;
  return consumeGatewayLimit(`nonce:${scope}:${nonce}`, 1, 86_400);
}

export function isSameOriginRequest(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

export function gatewayErrorStatus(error: unknown): number {
  return error instanceof AuthGatewayError ? error.status : 500;
}

export function gatewayErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Request failed.";
}