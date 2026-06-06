import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256 } from "@/lib/crypto.server";
import { verifyMsg91AccessToken, normalisePhone } from "@/lib/msg91.server";

function maskPhone(p?: string | null): string {
  if (!p) return "";
  const digits = p.replace(/\D/g, "");
  if (digits.length < 4) return "•".repeat(digits.length);
  return "••••••" + digits.slice(-4);
}

// Check whether this device is already trusted for the signed-in user.
// Also returns user's phone (masked for UI, full for OTP send) + admin flag.
export const checkDeviceTrust = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string }) =>
    z.object({ deviceId: z.string().min(8).max(128) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const deviceHash = sha256(data.deviceId);

    const [{ data: prof }, { data: row }, { data: role }] = await Promise.all([
      supabaseAdmin.from("profiles").select("phone, disabled").eq("id", userId).single(),
      supabaseAdmin
        .from("trusted_devices")
        .select("id")
        .eq("user_id", userId)
        .eq("device_hash", deviceHash)
        .maybeSingle(),
      supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle(),
    ]);

    if (prof?.disabled) throw new Error("Account disabled.");

    if (row) {
      await supabaseAdmin
        .from("trusted_devices")
        .update({ last_seen_at: new Date().toISOString() })
        .eq("id", row.id);
    }

    return {
      trusted: !!row,
      isAdmin: !!role,
      phone: prof?.phone ?? null,
      maskedPhone: maskPhone(prof?.phone),
      hasPhone: !!prof?.phone,
    };
  });

// After widget OTP succeeds, exchange the MSG91 access-token for a device-trust record.
export const trustDeviceWithOtp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { deviceId: string; msg91Token: string; userAgent?: string }) =>
    z.object({
      deviceId: z.string().min(8).max(128),
      msg91Token: z.string().min(10).max(4096),
      userAgent: z.string().max(512).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;

    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("phone")
      .eq("id", userId)
      .single();
    if (!prof?.phone) throw new Error("No phone number on file. Contact your admin.");

    const v = await verifyMsg91AccessToken(data.msg91Token);
    if (!v.ok) throw new Error(`OTP verification failed: ${v.error}`);

    const verifiedDigits = v.identifier.replace(/\D/g, "");
    const phoneDigits = normalisePhone(prof.phone).replace(/\D/g, "");
    if (verifiedDigits.length < 6 || !verifiedDigits.endsWith(phoneDigits.slice(-10))) {
      throw new Error("OTP was verified for a different number.");
    }

    const deviceHash = sha256(data.deviceId);
    await supabaseAdmin
      .from("trusted_devices")
      .upsert(
        {
          user_id: userId,
          device_hash: deviceHash,
          user_agent: data.userAgent?.slice(0, 512) ?? null,
          last_seen_at: new Date().toISOString(),
        },
        { onConflict: "user_id,device_hash" },
      );

    return { ok: true };
  });
