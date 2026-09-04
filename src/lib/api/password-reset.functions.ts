import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { rateLimit } from "@/lib/audit.server";

const resetStartSchema = z.object({
  email: z.string().trim().email().max(254),
  phone: z.string().trim().min(6).max(20).regex(/^\+?[0-9 ()-]+$/, "Invalid phone"),
});

const resetCompleteSchema = z.object({
  challengeToken: z.string().min(20).max(256),
  msg91Token: z.string().min(10).max(4096),
  newPassword: z.string().min(10).max(128),
});

function digits(value: string) {
  return value.replace(/\D/g, "");
}

function maskPhone(value: string) {
  const phone = digits(value);
  return phone.length > 4 ? `••••••${phone.slice(-4)}` : "••••";
}

/** Starts a phone-verified password reset without exposing account records. */
export const startPasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resetStartSchema.parse(input))
  .handler(async ({ data }) => {
    const email = data.email.toLowerCase();
    const phone = digits(data.phone);
    const generic = { ok: false as const };

    if (
      !rateLimit(`password-reset-email:${email}`, 5, 60_000) ||
      !rateLimit(`password-reset-phone:${phone}`, 5, 60_000)
    ) {
      return generic;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { normalisePhone } = await import("@/lib/msg91.server");
    const { generateToken, sha256 } = await import("@/lib/crypto.server");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, phone, disabled")
      .eq("email", email)
      .maybeSingle();

    if (
      !profile ||
      profile.disabled ||
      !profile.phone ||
      digits(normalisePhone(profile.phone)) !== phone
    ) {
      return generic;
    }

    // Keep only one active challenge per account and make old links unusable.
    await supabaseAdmin
      .from("password_reset_challenges")
      .delete()
      .eq("user_id", profile.id)
      .is("consumed_at", null);

    const challengeToken = generateToken(32);
    const { error } = await supabaseAdmin.from("password_reset_challenges").insert({
      user_id: profile.id,
      challenge_hash: sha256(challengeToken),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });

    if (error) {
      console.error("password reset challenge creation failed", error);
      return generic;
    }

    return {
      ok: true as const,
      challengeToken,
      maskedPhone: maskPhone(profile.phone),
    };
  });

/** Verifies the provider token and changes the password server-side. */
export const completePasswordReset = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => resetCompleteSchema.parse(input))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sha256 } = await import("@/lib/crypto.server");
    const { verifyMsg91AccessToken, normalisePhone } = await import("@/lib/msg91.server");

    const { data: challenge } = await supabaseAdmin
      .from("password_reset_challenges")
      .select("id, user_id, challenge_hash, expires_at, attempts, consumed_at")
      .eq("challenge_hash", sha256(data.challengeToken))
      .maybeSingle();

    if (
      !challenge ||
      challenge.consumed_at ||
      challenge.attempts >= 5 ||
      new Date(challenge.expires_at).getTime() <= Date.now()
    ) {
      throw new Error("This reset request is invalid or expired. Start again.");
    }

    const { data: attempt } = await supabaseAdmin
      .from("password_reset_challenges")
      .update({ attempts: challenge.attempts + 1 })
      .eq("id", challenge.id)
      .is("consumed_at", null)
      .lt("attempts", 5)
      .select("id")
      .maybeSingle();
    if (!attempt) throw new Error("Too many verification attempts. Start again.");

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, phone, disabled")
      .eq("id", challenge.user_id)
      .maybeSingle();
    if (!profile || profile.disabled || !profile.phone) {
      throw new Error("This reset request is invalid or expired. Start again.");
    }

    const verified = await verifyMsg91AccessToken(data.msg91Token);
    if (!verified.ok) throw new Error("The OTP could not be verified. Try again.");
    if (digits(normalisePhone(profile.phone)) !== digits(verified.identifier)) {
      throw new Error("The OTP was verified for a different number.");
    }

    const { error } = await supabaseAdmin.auth.admin.updateUserById(profile.id, {
      password: data.newPassword,
    });
    if (error) {
      console.error("password reset update failed", error);
      throw new Error("Could not update the password. Try again.");
    }

    await supabaseAdmin
      .from("password_reset_challenges")
      .update({ consumed_at: new Date().toISOString() })
      .eq("id", challenge.id)
      .is("consumed_at", null);
    // A password reset revokes remembered devices so the new credential is meaningful.
    await supabaseAdmin.from("trusted_devices").delete().eq("user_id", profile.id);

    const { logAudit } = await import("@/lib/audit.server");
    await logAudit({ actorId: profile.id, action: "auth.password.reset" });
    return { ok: true as const };
  });