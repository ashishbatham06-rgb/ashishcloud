import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  presignPutUrl,
  presignGetUrl,
  deleteObject,
  makeKey,
  isR2Configured,
} from "@/lib/r2.server";
import { generateToken, sha256, hashSecret } from "@/lib/crypto.server";
import { logAudit, rateLimit } from "@/lib/audit.server";

const MAX_FILE_BYTES = 1024 * 1024 * 1024; // 1 GB

async function assertActiveProfile(userId: string) {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("storage_quota_bytes, storage_used_bytes, disabled")
    .eq("id", userId)
    .single();
  if (!data) throw new Error("Profile not found.");
  if (data.disabled) throw new Error("Account disabled.");
  return data;
}

async function bumpBilling(field: "class_a_ops" | "class_b_ops", by = 1) {
  const { data } = await supabaseAdmin.from("billing_state").select(field).eq("id", 1).single();
  const current = Number((data as Record<string, unknown> | null)?.[field] ?? 0);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  patch[field] = current + by;
  await supabaseAdmin.from("billing_state").update(patch as never).eq("id", 1);
}

export const presignUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; size: number; mime: string; quality?: string }) =>
    z.object({
      name: z.string().min(1).max(255),
      size: z.number().int().positive().max(MAX_FILE_BYTES),
      mime: z.string().min(1).max(127),
      quality: z.enum(["original", "high", "medium"]).default("original"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (!isR2Configured()) throw new Error("Storage is not configured yet. Admin needs to add Cloudflare R2 secrets.");
    const userId = context.userId;
    const prof = await assertActiveProfile(userId);
    if (prof.storage_used_bytes + data.size > prof.storage_quota_bytes) {
      throw new Error(`Quota exceeded. ${Math.round((prof.storage_quota_bytes - prof.storage_used_bytes) / 1024 / 1024)} MB free.`);
    }
    const key = makeKey(userId, data.name);
    const url = await presignPutUrl(key, data.mime);
    await bumpBilling("class_a_ops", 1);
    return { uploadUrl: url, key };
  });

export const confirmUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { key: string; name: string; size: number; mime: string; quality?: string; folder?: string }) =>
    z.object({
      key: z.string().min(1),
      name: z.string().min(1).max(255),
      size: z.number().int().positive().max(MAX_FILE_BYTES),
      mime: z.string().min(1).max(127),
      quality: z.enum(["original", "high", "medium"]).default("original"),
      folder: z.string().default("/"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const userId = context.userId;
    const prof = await assertActiveProfile(userId);
    if (!data.key.startsWith(`users/${userId}/`)) throw new Error("Invalid key.");
    if (prof.storage_used_bytes + data.size > prof.storage_quota_bytes) {
      // Roll back the object — quota raced
      await deleteObject(data.key).catch(() => null);
      throw new Error("Quota exceeded.");
    }
    const { data: file, error } = await supabaseAdmin
      .from("files")
      .insert({
        owner_id: userId,
        r2_key: data.key,
        name: data.name,
        size_bytes: data.size,
        mime: data.mime,
        quality: data.quality,
        folder: data.folder,
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("profiles")
      .update({ storage_used_bytes: prof.storage_used_bytes + data.size })
      .eq("id", userId);
    await logAudit({ actorId: userId, action: "file.upload", target: file.id, meta: { size: data.size, name: data.name } });
    return file;
  });

export const listFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("files")
      .select("*")
      .eq("owner_id", context.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("folders")
      .select("id, name, created_at")
      .eq("owner_id", context.userId)
      .order("name", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const createFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) =>
    z.object({
      name: z.string().trim().min(1).max(60).regex(/^[a-zA-Z0-9 _\-]+$/, "Only letters, numbers, space, _ and - allowed"),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("folders")
      .insert({ owner_id: context.userId, name: data.name })
      .select("id, name, created_at")
      .single();
    if (error) {
      if (error.code === "23505") throw new Error("Folder already exists.");
      throw new Error(error.message);
    }
    await logAudit({ actorId: context.userId, action: "folder.create", target: row.id, meta: { name: data.name } });
    return row;
  });

export const deleteFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; moveTo?: string }) =>
    z.object({
      name: z.string().min(1).max(60),
      moveTo: z.string().min(1).max(60).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const target = data.moveTo ?? "/";
    await supabaseAdmin
      .from("files")
      .update({ folder: target })
      .eq("owner_id", context.userId)
      .eq("folder", data.name);
    await supabaseAdmin
      .from("folders")
      .delete()
      .eq("owner_id", context.userId)
      .eq("name", data.name);
    await logAudit({ actorId: context.userId, action: "folder.delete", meta: { name: data.name, moveTo: target } });
    return { ok: true };
  });

export const moveFiles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileIds: string[]; folder: string }) =>
    z.object({
      fileIds: z.array(z.string().uuid()).min(1).max(500),
      folder: z.string().min(1).max(60),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    if (data.folder !== "/") {
      const { data: f } = await supabaseAdmin
        .from("folders")
        .select("id")
        .eq("owner_id", context.userId)
        .eq("name", data.folder)
        .maybeSingle();
      if (!f) throw new Error("Folder not found.");
    }
    const { error } = await supabaseAdmin
      .from("files")
      .update({ folder: data.folder })
      .in("id", data.fileIds)
      .eq("owner_id", context.userId);
    if (error) throw new Error(error.message);
    await logAudit({ actorId: context.userId, action: "file.move", meta: { count: data.fileIds.length, folder: data.folder } });
    return { ok: true };
  });

export const presignView = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string }) => z.object({ fileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: file } = await supabaseAdmin.from("files").select("*").eq("id", data.fileId).single();
    if (!file) throw new Error("File not found.");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (file.owner_id !== context.userId && !isAdmin) throw new Error("Not allowed.");
    // inline view (no attachment disposition)
    const url = await presignGetUrl(file.r2_key);
    await bumpBilling("class_b_ops", 1);
    return { url, mime: file.mime, name: file.name };
  });

export const presignDownload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string }) => z.object({ fileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: file } = await supabaseAdmin.from("files").select("*").eq("id", data.fileId).single();
    if (!file) throw new Error("File not found.");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (file.owner_id !== context.userId && !isAdmin) throw new Error("Not allowed.");
    const url = await presignGetUrl(file.r2_key, file.name);
    await bumpBilling("class_b_ops", 1);
    await logAudit({ actorId: context.userId, action: "file.download", target: file.id });
    return { url };
  });

export const softDeleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string }) => z.object({ fileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: file } = await supabaseAdmin.from("files").select("*").eq("id", data.fileId).single();
    if (!file) throw new Error("File not found.");
    const { data: roles } = await supabaseAdmin.from("user_roles").select("role").eq("user_id", context.userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (file.owner_id !== context.userId && !isAdmin) throw new Error("Not allowed.");
    await supabaseAdmin.from("files").update({ deleted_at: new Date().toISOString() }).eq("id", file.id);
    // Permanently remove from R2 and update quota
    await deleteObject(file.r2_key).catch(() => null);
    const { data: prof } = await supabaseAdmin.from("profiles").select("storage_used_bytes").eq("id", file.owner_id).single();
    if (prof) {
      await supabaseAdmin
        .from("profiles")
        .update({ storage_used_bytes: Math.max(0, prof.storage_used_bytes - file.size_bytes) })
        .eq("id", file.owner_id);
    }
    await logAudit({ actorId: context.userId, action: "file.delete", target: file.id });
    return { ok: true };
  });

export const createShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string; password?: string; expiresInHours?: number; maxDownloads?: number }) =>
    z.object({
      fileId: z.string().uuid(),
      password: z.string().min(4).max(64).optional(),
      expiresInHours: z.number().int().min(1).max(24 * 30).optional(),
      maxDownloads: z.number().int().min(1).max(10000).optional(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { data: file } = await supabaseAdmin.from("files").select("id, owner_id").eq("id", data.fileId).single();
    if (!file || file.owner_id !== context.userId) throw new Error("Not allowed.");
    const token = generateToken(24);
    const token_hash = sha256(token);
    const password_hash = data.password ? await hashSecret(data.password) : null;
    const expires_at = data.expiresInHours ? new Date(Date.now() + data.expiresInHours * 3600 * 1000).toISOString() : null;
    const { error } = await supabaseAdmin.from("share_links").insert({
      file_id: file.id,
      created_by: context.userId,
      token_hash,
      password_hash,
      expires_at,
      max_downloads: data.maxDownloads ?? null,
    });
    if (error) throw new Error(error.message);
    await logAudit({ actorId: context.userId, action: "share.create", target: file.id });
    return { token };
  });

export const listShareLinks = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { fileId: string }) => z.object({ fileId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows } = await supabaseAdmin
      .from("share_links")
      .select("id, expires_at, max_downloads, downloads, revoked, created_at, password_hash")
      .eq("file_id", data.fileId)
      .eq("created_by", context.userId)
      .order("created_at", { ascending: false });
    return (rows ?? []).map((r) => ({ ...r, has_password: !!r.password_hash, password_hash: undefined }));
  });

export const revokeShareLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { linkId: string }) => z.object({ linkId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await supabaseAdmin.from("share_links").update({ revoked: true }).eq("id", data.linkId).eq("created_by", context.userId);
    return { ok: true };
  });
