import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

// Native app helper: returns a short-lived signed URL for one of the caller's own files.
const Body = z.object({ id: z.string().uuid(), download: z.boolean().optional() });

export const Route = createFileRoute("/api/mobile/file-url")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { presignGetUrl, isR2Configured } = await import("@/lib/r2.server");
        const { rateLimit } = await import("@/lib/audit.server");
        if (!isR2Configured()) return new Response("Storage not configured", { status: 503 });
        const auth = request.headers.get("authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
        if (!token) return new Response("Unauthorized", { status: 401 });
        const { data: u, error } = await supabaseAdmin.auth.getUser(token);
        if (error || !u.user) return new Response("Unauthorized", { status: 401 });
        if (!rateLimit(`mobile-url:${u.user.id}`, 240, 60_000)) return new Response("Too many requests", { status: 429 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return new Response("Bad request", { status: 400 });
        const { data: f } = await supabaseAdmin
          .from("files")
          .select("r2_key, name, owner_id, deleted_at")
          .eq("id", parsed.data.id)
          .maybeSingle();
        if (!f || f.owner_id !== u.user.id || f.deleted_at) return new Response("Not found", { status: 404 });
        const url = await presignGetUrl(f.r2_key, parsed.data.download ? f.name : undefined, 900);
        return Response.json({ url });
      },
    },
  },
});
