// MSG91 server-side helpers.
// Verifies the JWT access-token returned by the MSG91 widget against MSG91's
// `verifyAccessToken` endpoint. Returns the verified identifier on success.

export type Msg91VerifyResult =
  | { ok: true; identifier: string; raw: unknown }
  | { ok: false; error: string };

export async function verifyMsg91AccessToken(token: string): Promise<Msg91VerifyResult> {
  const authkey = process.env.MSG91_AUTH_KEY;
  if (!authkey) return { ok: false, error: "MSG91_AUTH_KEY not configured" };
  if (!token || typeof token !== "string" || token.length < 10) {
    return { ok: false, error: "Missing OTP access token" };
  }
  try {
    const res = await fetch("https://control.msg91.com/api/v5/widget/verifyAccessToken", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ authkey, "access-token": token }),
    });
    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const type = String(json.type ?? "").toLowerCase();
    if (!res.ok || type !== "success") {
      return { ok: false, error: String(json.message ?? "OTP verification failed") };
    }
    // MSG91 returns the verified identifier in `message` (phone or email).
    const identifier = String(json.message ?? "");
    return { ok: true, identifier, raw: json };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "MSG91 request failed" };
  }
}

export function normalisePhone(input: string): string {
  // Keep leading + if present, strip spaces / dashes / parens.
  const trimmed = input.trim();
  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/\D/g, "");
  return plus ? `+${digits}` : digits;
}
