import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { makeKey, putObject, deleteObject, isR2Configured } from "@/lib/r2.server";
import { logAudit } from "@/lib/audit.server";

const MAX_FILE_BYTES = 1024 * 1024 * 1024;

async function getUserId(request: Request) {
  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) throw new Response("Unauthorized", { status: 401 });
  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) throw new Response("Unauthorized", { status: 401 });
  return data.user.id;
}

async function bumpBilling(field: "class_a_ops" | "class_b_ops", by = 1) {
  const { data } = await supabaseAdmin.from("billing_state").select(field).eq("id", 1).single();
  const current = Number((data as Record<string, unknown> | null)?.[field] ?? 0);
  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  patch[field] = current + by;
  await supabaseAdmin.from("billing_state").update(patch as never).eq("id", 1);
}

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          if (!isR2Configured()) return new Response("Storage is not configured yet.", { status: 503 });

          const userId = await getUserId(request);
          const form = await request.formData();
          const file = form.get("file");
          const quality = String(form.get("quality") || "original");
          if (!(file instanceof File)) return new Response("Missing file.", { status: 400 });
          if (!file.size || file.size > MAX_FILE_BYTES) return new Response("Invalid file size.", { status: 400 });
          if (!["original", "high", "medium"].includes(quality)) return new Response("Invalid quality.", { status: 400 });

          const { data: prof } = await supabaseAdmin
            .from("profiles")
            .select("storage_quota_bytes, storage_used_bytes, disabled")
            .eq("id", userId)
            .single();
          if (!prof) return new Response("Profile not found.", { status: 404 });
          if (prof.disabled) return new Response("Account disabled.", { status: 403 });
          if (prof.storage_used_bytes + file.size > prof.storage_quota_bytes) return new Response("Quota exceeded.", { status: 413 });

          const key = makeKey(userId, file.name);
          const mime = file.type || "application/octet-stream";
          await putObject(key, new Uint8Array(await file.arrayBuffer()), mime);
          await bumpBilling("class_a_ops", 1);

          const { data: saved, error } = await supabaseAdmin
            .from("files")
            .insert({ owner_id: userId, r2_key: key, name: file.name, size_bytes: file.size, mime, quality })
            .select("*")
            .single();
          if (error) {
            await deleteObject(key).catch(() => null);
            return new Response(error.message, { status: 500 });
          }

          await supabaseAdmin.from("profiles").update({ storage_used_bytes: prof.storage_used_bytes + file.size }).eq("id", userId);
          await logAudit({ actorId: userId, action: "file.upload", target: saved.id, meta: { size: file.size, name: file.name } });
          return Response.json(saved);
        } catch (error) {
          if (error instanceof Response) return error;
          return new Response(error instanceof Error ? error.message : "Upload failed.", { status: 500 });
        }
      },
    },
  },
});