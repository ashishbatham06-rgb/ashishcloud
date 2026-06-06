import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256 } from "@/lib/crypto.server";
import { verifyMsg91AccessToken, normalisePhone } from "@/lib/msg91.server";

// Public: resolve invite token to show prefilled signup form.
export const resolveInvite = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => z.object({ token: z.string().min(8).max(256) }).parse(d))
  .handler(async ({ data }) => {
    const token_hash = sha256(data.token);
    const { data: row } = await supabaseAdmin
      .from("invites")
      .select("id, email, role, quota_bytes, expires_at, used_at")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!row) throw new Error("Invalid invitation.");
    if (row.used_at) throw new Error("Invitation already used.");
    if (new Date(row.expires_at) < new Date()) throw new Error("Invitation expired.");
    return { email: row.email, role: row.role };
  });

// Public: accept invite — verifies phone OTP via MSG91, then creates auth user.
export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((d: {
    token: string;
    password: string;
    phone: string;
    msg91Token: string;
    displayName?: string;
  }) =>
    z.object({
      token: z.string().min(8).max(256),
      password: z.string().min(10).max(128),
      phone: z.string().min(6).max(20).regex(/^\+?[0-9 ()-]+$/, "Invalid phone"),
      msg91Token: z.string().min(10).max(4096),
      displayName: z.string().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const token_hash = sha256(data.token);
    const { data: row } = await supabaseAdmin
      .from("invites")
      .select("*")
      .eq("token_hash", token_hash)
      .maybeSingle();
    if (!row) throw new Error("Invalid invitation.");
    if (row.used_at) throw new Error("Invitation already used.");
    if (new Date(row.expires_at) < new Date()) throw new Error("Invitation expired.");

    const phone = normalisePhone(data.phone);

    // Ensure no other profile already uses this phone.
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (existing) throw new Error("This phone number is already linked to another account.");

    // Verify the MSG91 OTP server-side.
    const v = await verifyMsg91AccessToken(data.msg91Token);
    if (!v.ok) throw new Error(`OTP verification failed: ${v.error}`);

    // Make sure the verified identifier matches the submitted phone (last 10 digits).
    const verifiedDigits = v.identifier.replace(/\D/g, "");
    const submittedDigits = phone.replace(/\D/g, "");
    if (
      verifiedDigits.length < 6 ||
      !verifiedDigits.endsWith(submittedDigits.slice(-10))
    ) {
      throw new Error("OTP was verified for a different number.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: row.email,
      password: data.password,
      phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        display_name: data.displayName ?? row.email.split("@")[0],
        phone,
      },
    });
    if (error || !created.user) throw new Error(error?.message || "Could not create account.");

    if (row.role === "admin") {
      await supabaseAdmin
        .from("user_roles")
        .insert({ user_id: created.user.id, role: "admin" })
        .then(() => null, () => null);
    }
    await supabaseAdmin
      .from("profiles")
      .update({ storage_quota_bytes: row.quota_bytes, phone })
      .eq("id", created.user.id);
    await supabaseAdmin
      .from("invites")
      .update({ used_at: new Date().toISOString() })
      .eq("id", row.id);
    return { ok: true, email: row.email };
  });
