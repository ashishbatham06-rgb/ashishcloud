import { createFileRoute } from "@tanstack/react-router";

const MAX_FILE_BYTES = 1024 * 1024 * 1024;

export const Route = createFileRoute("/api/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { makeKey, putObject, deleteObject, isR2Configured } = await import("@/lib/r2.server");
        const { logAudit } = await import("@/lib/audit.server");

        try {
          if (!isR2Configured()) return new Response("Storage is not configured yet.", { status: 503 });

          const authHeader = request.headers.get("authorization") || "";
          const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
          if (!token) return new Response("Unauthorized", { status: 401 });
          const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
          if (userErr || !userData.user) return new Response("Unauthorized", { status: 401 });
          const userId = userData.user.id;

          const form = await request.formData();
          const file = form.get("file");
          const quality = String(form.get("quality") || "original");
          const folder = String(form.get("folder") || "/").trim() || "/";
          if (!(file instanceof File)) return new Response("Missing file.", { status: 400 });
          if (!file.size || file.size > MAX_FILE_BYTES) return new Response("Invalid file size.", { status: 400 });
          if (!["original", "high", "medium"].includes(quality)) return new Response("Invalid quality.", { status: 400 });
          if (folder !== "/" && !/^[a-zA-Z0-9 _\-]{1,60}$/.test(folder)) return new Response("Invalid folder.", { status: 400 });

          if (folder !== "/") {
            const { data: f } = await supabaseAdmin.from("folders").select("id").eq("owner_id", userId).eq("name", folder).maybeSingle();
            if (!f) return new Response("Folder not found.", { status: 404 });
          }

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

          const { data: bs } = await supabaseAdmin.from("billing_state").select("class_a_ops").eq("id", 1).single();
          const currentOps = Number((bs as Record<string, unknown> | null)?.class_a_ops ?? 0);
          await supabaseAdmin.from("billing_state").update({ class_a_ops: currentOps + 1, updated_at: new Date().toISOString() } as never).eq("id", 1);

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
