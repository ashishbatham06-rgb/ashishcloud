// Server-only audit log + simple in-memory rate limiter.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export async function logAudit(opts: {
  actorId?: string | null;
  action: string;
  target?: string;
  meta?: Record<string, unknown>;
  ip?: string;
  ua?: string;
}) {
  try {
    await supabaseAdmin.from("audit_log").insert({
      actor_id: opts.actorId ?? null,
      action: opts.action,
      target: opts.target ?? null,
      meta: (opts.meta ?? {}) as never,
      ip: opts.ip ?? null,
      ua: opts.ua ?? null,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

// Best-effort in-memory rate limiter (per worker instance).
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || b.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (b.count >= max) return false;
  b.count += 1;
  return true;
}
