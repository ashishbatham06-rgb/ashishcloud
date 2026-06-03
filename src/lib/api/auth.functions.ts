import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateOtpCode, hashSecret, compareSecret } from "@/lib/crypto.server";
import { sendEmail, otpEmailHtml } from "@/lib/email.server";
import { logAudit, rateLimit } from "@/lib/audit.server";

// Email OTP disabled (no sender domain configured). Password auth alone is used.
// To re-enable: set up an email domain, then restore OTP logic here.
export const startAdminOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    if (!rateLimit(`otp-start:${userId}`, 10, 60_000)) {
      throw new Error("Too many requests. Please wait a minute.");
    }
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("disabled")
      .eq("id", userId)
      .single();
    if (prof?.disabled) throw new Error("Account disabled.");

    const { data: isAdmin } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    await logAudit({ actorId: userId, action: isAdmin ? "admin.login" : "user.login" });
    return { needsOtp: false, isAdmin: !!isAdmin };
  });

export const verifyAdminOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { code: string }) => z.object({ code: z.string().regex(/^\d{6}$/) }).parse(d))
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    if (!rateLimit(`otp-verify:${userId}`, 10, 60_000)) {
      throw new Error("Too many attempts.");
    }
    const { data: rows } = await supabaseAdmin
      .from("admin_otps")
      .select("id, code_hash, expires_at, attempts, consumed_at")
      .eq("user_id", userId)
      .is("consumed_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = rows?.[0];
    if (!row) throw new Error("No active code. Request a new one.");
    if (new Date(row.expires_at) < new Date()) throw new Error("Code expired.");
    if (row.attempts >= 5) throw new Error("Too many failed attempts.");

    const ok = await compareSecret(data.code, row.code_hash);
    await supabaseAdmin.from("admin_otps").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    if (!ok) throw new Error("Invalid code.");
    await supabaseAdmin.from("admin_otps").update({ consumed_at: new Date().toISOString() }).eq("id", row.id);
    await logAudit({ actorId: userId, action: "admin.otp.verified" });
    return { ok: true };
  });

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabaseAdmin.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("user_roles").select("role").eq("user_id", userId),
    ]);
    return {
      userId,
      profile,
      isAdmin: !!roles?.some((r) => r.role === "admin"),
      roles: roles?.map((r) => r.role) ?? [],
    };
  });
