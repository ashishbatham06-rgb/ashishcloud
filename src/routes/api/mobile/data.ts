import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("files"), folder: z.string().max(60).optional() }).strict(),
  z.object({ action: z.literal("folders") }).strict(),
  z.object({ action: z.literal("profile") }).strict(),
]);

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export const Route = createFileRoute("/api/mobile/data")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { consumeGatewayLimit, consumeRequestNonce, isSameOriginRequest, resolveGatewayIdentity } = await import("@/lib/auth-session.server");
        const origin = request.headers.get("origin");
        if ((origin && !isSameOriginRequest(request)) || !await consumeRequestNonce(request, "mobile-data")) {
          return reply({ error: "Forbidden request." }, 403);
        }
        const identity = await resolveGatewayIdentity(request, true);
        if (!identity) return reply({ error: "Please sign in again." }, 401);
        if (!await consumeGatewayLimit(`mobile-data:${identity.userId}`, 180, 60)) return reply({ error: "Too many requests." }, 429);
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return reply({ error: "Invalid request." }, 400);
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        if (parsed.data.action === "files") {
          const folder = parsed.data.folder;
          if (folder !== undefined && folder !== "/" && !/^[a-zA-Z0-9 _-]{1,60}$/.test(folder)) return reply({ error: "Invalid folder." }, 400);
          let query = supabaseAdmin
            .from("files")
            .select("id,name,size_bytes,mime,folder,created_at")
            .eq("owner_id", identity.userId)
            .is("deleted_at", null)
            .order("created_at", { ascending: false })
            .limit(500);
          if (folder) query = query.eq("folder", folder);
          const { data, error } = await query;
          if (error) return reply({ error: "Files could not be loaded." }, 503);
          return reply(data ?? []);
        }

        if (parsed.data.action === "folders") {
          const { data, error } = await supabaseAdmin
            .from("folders")
            .select("name")
            .eq("owner_id", identity.userId)
            .order("name", { ascending: true });
          if (error) return reply({ error: "Folders could not be loaded." }, 503);
          return reply((data ?? []).map((row) => row.name));
        }

        const { data, error } = await supabaseAdmin
          .from("profiles")
          .select("display_name,email,storage_quota_bytes,storage_used_bytes")
          .eq("id", identity.userId)
          .maybeSingle();
        if (error) return reply({ error: "Account details could not be loaded." }, 503);
        return reply(data);
      },
    },
  },
});