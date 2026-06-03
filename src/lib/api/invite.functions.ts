import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256 } from "@/lib/crypto.server";

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

// Public: accept invite — creates auth user with provided password.
export const acceptInvite = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string; password: string; displayName?: string }) =>
    z.object({
      token: z.string().min(8).max(256),
      password: z.string().min(10).max(128),
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

    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: row.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { display_name: data.displayName ?? row.email.split("@")[0] },
    });
    if (error || !created.user) throw new Error(error?.message || "Could not create account.");

    // Trigger handle_new_user has already added profile + 'user' role. Apply invite-specific role & quota.
    if (row.role === "admin") {
      await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" }).then(() => null, () => null);
    }
    await supabaseAdmin.from("profiles").update({ storage_quota_bytes: row.quota_bytes }).eq("id", created.user.id);
    await supabaseAdmin.from("invites").update({ used_at: new Date().toISOString() }).eq("id", row.id);
    return { ok: true, email: row.email };
  });
