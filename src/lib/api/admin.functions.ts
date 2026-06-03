import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { generateToken, sha256 } from "@/lib/crypto.server";
import { sendEmail, inviteEmailHtml } from "@/lib/email.server";
import { logAudit } from "@/lib/audit.server";
import { deleteObject } from "@/lib/r2.server";

async function assertAdmin(userId: string) {
  const { data } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (!data) throw new Error("Admin only.");
}

export const adminListUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role");
    const rolesMap = new Map<string, string[]>();
    (roles ?? []).forEach((r) => {
      const arr = rolesMap.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesMap.set(r.user_id, arr);
    });
    return (profiles ?? []).map((p) => ({ ...p, roles: rolesMap.get(p.id) ?? [] }));
  });

export const adminSetQuota = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; quotaBytes: number }) =>
    z.object({ userId: z.string().uuid(), quotaBytes: z.number().int().min(0).max(1024 ** 4) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("profiles").update({ storage_quota_bytes: data.quotaBytes }).eq("id", data.userId);
    await logAudit({ actorId: context.userId, action: "admin.set_quota", target: data.userId, meta: { quotaBytes: data.quotaBytes } });
    return { ok: true };
  });

export const adminToggleDisable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; disabled: boolean }) =>
    z.object({ userId: z.string().uuid(), disabled: z.boolean() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("profiles").update({ disabled: data.disabled }).eq("id", data.userId);
    if (data.disabled) {
      await supabaseAdmin.auth.admin.signOut(data.userId).catch(() => null);
    }
    await logAudit({ actorId: context.userId, action: data.disabled ? "admin.disable_user" : "admin.enable_user", target: data.userId });
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Cannot delete yourself.");
    // Remove R2 objects
    const { data: files } = await supabaseAdmin.from("files").select("r2_key").eq("owner_id", data.userId);
    for (const f of files ?? []) await deleteObject(f.r2_key).catch(() => null);
    // Auth delete cascades profile/files via FKs
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: context.userId, action: "admin.delete_user", target: data.userId });
    return { ok: true };
  });

export const adminCreateInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { email: string; role: "admin" | "user"; quotaBytes: number; expiresInHours: number }) =>
    z.object({
      email: z.string().email().max(255),
      role: z.enum(["admin", "user"]),
      quotaBytes: z.number().int().min(0).max(1024 ** 4),
      expiresInHours: z.number().int().min(1).max(24 * 30),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    const token = generateToken(24);
    const token_hash = sha256(token);
    const expires_at = new Date(Date.now() + data.expiresInHours * 3600 * 1000).toISOString();
    const { error } = await supabaseAdmin.from("invites").insert({
      email: data.email.toLowerCase(),
      role: data.role,
      token_hash,
      quota_bytes: data.quotaBytes,
      expires_at,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    const origin = process.env.PUBLIC_SITE_URL || "";
    const url = `${origin}/invite/${token}`;
    await sendEmail({ to: data.email, ...inviteEmailHtml(url, data.role) });
    await logAudit({ actorId: context.userId, action: "admin.invite_create", target: data.email });
    return { token, url };
  });

export const adminListInvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("invites")
      .select("id, email, role, quota_bytes, expires_at, used_at, created_at")
      .order("created_at", { ascending: false });
    return data ?? [];
  });

export const adminRevokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin.from("invites").delete().eq("id", data.id);
    return { ok: true };
  });

// Billing — R2 included tier:
// 10 GB storage, 1M Class A ops, 10M Class B ops per month.
// Overage: $0.015/GB-mo, $4.50/M Class A, $0.36/M Class B.
export const adminGetBilling = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data: state } = await supabaseAdmin.from("billing_state").select("*").eq("id", 1).single();
    const { data: profSum } = await supabaseAdmin.from("profiles").select("storage_used_bytes");
    const usedBytes = (profSum ?? []).reduce((acc, p) => acc + Number(p.storage_used_bytes ?? 0), 0);
    const gbUsed = usedBytes / (1024 ** 3);
    const classA = Number(state?.class_a_ops ?? 0);
    const classB = Number(state?.class_b_ops ?? 0);

    const storageOverGB = Math.max(0, gbUsed - 10);
    const classAOver = Math.max(0, classA - 1_000_000);
    const classBOver = Math.max(0, classB - 10_000_000);

    const storageCost = storageOverGB * 0.015;
    const classACost = (classAOver / 1_000_000) * 4.5;
    const classBCost = (classBOver / 1_000_000) * 0.36;
    const total = storageCost + classACost + classBCost;

    return {
      periodStart: state?.period_start,
      gbUsed,
      classA,
      classB,
      breakdown: {
        storage: { gbUsed, included: 10, overGB: storageOverGB, cost: storageCost },
        classA: { used: classA, included: 1_000_000, over: classAOver, cost: classACost },
        classB: { used: classB, included: 10_000_000, over: classBOver, cost: classBCost },
      },
      total,
    };
  });

export const adminResetBillingPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    await supabaseAdmin
      .from("billing_state")
      .update({ class_a_ops: 0, class_b_ops: 0, period_start: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", 1);
    await logAudit({ actorId: context.userId, action: "admin.billing_reset" });
    return { ok: true };
  });

export const adminListAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);
    const { data } = await supabaseAdmin
      .from("audit_log")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    return data ?? [];
  });
