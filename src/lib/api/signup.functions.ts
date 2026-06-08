import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { verifyMsg91AccessToken, normalisePhone } from "@/lib/msg91.server";

const FREE_QUOTA_BYTES = 1024 * 1024 * 1024; // 1 GB

// Public: free-tier self-signup. Requires verified MSG91 OTP for the phone.
export const freeSignup = createServerFn({ method: "POST" })
  .inputValidator((d: {
    email: string;
    password: string;
    phone: string;
    msg91Token: string;
    displayName?: string;
  }) =>
    z.object({
      email: z.string().email().max(254),
      password: z.string().min(10).max(128),
      phone: z.string().min(6).max(20).regex(/^\+?[0-9 ()-]+$/, "Invalid phone"),
      msg91Token: z.string().min(10).max(4096),
      displayName: z.string().max(80).optional(),
    }).parse(d),
  )
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    const phone = normalisePhone(data.phone);

    // Email uniqueness — check profiles (auth.users may also reject duplicates).
    const { data: existingEmail } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();
    if (existingEmail) throw new Error("An account with this email already exists. Please sign in.");

    // Phone uniqueness.
    const { data: existingPhone } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("phone", phone)
      .maybeSingle();
    if (existingPhone) throw new Error("This phone number is already linked to another account.");

    // Verify the MSG91 OTP server-side.
    const v = await verifyMsg91AccessToken(data.msg91Token);
    if (!v.ok) throw new Error(`OTP verification failed: ${v.error}`);

    const verifiedDigits = v.identifier.replace(/\D/g, "");
    const submittedDigits = phone.replace(/\D/g, "");
    if (
      verifiedDigits.length < 6 ||
      !verifiedDigits.endsWith(submittedDigits.slice(-10))
    ) {
      throw new Error("OTP was verified for a different number.");
    }

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: data.password,
      phone,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        display_name: data.displayName ?? email.split("@")[0],
        phone,
      },
    });
    if (error || !created.user) throw new Error(error?.message || "Could not create account.");

    await supabaseAdmin
      .from("profiles")
      .update({ storage_quota_bytes: FREE_QUOTA_BYTES, phone })
      .eq("id", created.user.id);

    return { ok: true, email };
  });
