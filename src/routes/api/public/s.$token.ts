import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256, compareSecret } from "@/lib/crypto.server";
import { presignGetUrl } from "@/lib/r2.server";
import { logAudit, rateLimit } from "@/lib/audit.server";

// Public share endpoint.
// - POST { password?, mode?: "view"|"download" } → JSON { url, mime, name }
// - GET (back-compat) → 302 redirect; refuses if password is required.
export const Route = createFileRoute("/api/public/s/$token")({
  server: {
    handlers: {
      OPTIONS: async () =>
        new Response(null, {
          status: 204,
          headers: {
            "access-control-allow-origin": "*",
            "access-control-allow-methods": "GET, POST, OPTIONS",
            "access-control-allow-headers": "content-type",
            "access-control-max-age": "86400",
          },
        }),

      POST: async ({ request, params }) => {
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
        if (!rateLimit(`share:${ip}`, 30, 60_000)) return jsonErr(429, "Too many requests");
        if (!rateLimit(`share-token:${params.token}`, 20, 60_000)) return jsonErr(429, "Too many requests");

        let body: { password?: string; mode?: "view" | "download" } = {};
        try {
          body = (await request.json()) as typeof body;
        } catch {
          body = {};
        }
        const password = typeof body.password === "string" ? body.password : "";
        const wantDl = body.mode === "download";

        const link = await loadLink(params.token);
        if ("error" in link) return jsonErr(link.status, link.error);

        if (link.password_hash) {
          if (!password) return jsonErr(401, "Password required");
          const ok = await compareSecret(password, link.password_hash);
          if (!ok) return jsonErr(403, "Wrong password");
        }

        const { data: file } = await supabaseAdmin.from("files").select("r2_key, name, mime").eq("id", link.file_id).single();
        if (!file) return jsonErr(404, "File missing");
        const inlineOk = !!file.mime && (file.mime.startsWith("image/") || file.mime.startsWith("video/") || file.mime.startsWith("audio/") || file.mime === "application/pdf");
        const signed = await presignGetUrl(file.r2_key, wantDl || !inlineOk ? file.name : undefined);

        await supabaseAdmin.from("share_links").update({ downloads: link.downloads + 1 }).eq("id", link.id);
        await logAudit({ action: "share.access", target: link.file_id, meta: { ip, dl: wantDl } });

        return Response.json(
          { url: signed, mime: file.mime, name: file.name },
          { headers: { "cache-control": "no-store", "access-control-allow-origin": "*" } },
        );
      },

      GET: async ({ request, params }) => {
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
        if (!rateLimit(`share:${ip}`, 30, 60_000)) return new Response("Too many requests", { status: 429 });
        const link = await loadLink(params.token);
        if ("error" in link) return new Response(link.error, { status: link.status });
        if (link.password_hash) {
          // Do not accept password in URL. Redirect to UI.
          return Response.redirect(new URL(`/s/${params.token}`, request.url).toString(), 302);
        }
        const { data: file } = await supabaseAdmin.from("files").select("r2_key, name, mime").eq("id", link.file_id).single();
        if (!file) return new Response("File missing", { status: 404 });
        const inlineOk = !!file.mime && (file.mime.startsWith("image/") || file.mime.startsWith("video/") || file.mime.startsWith("audio/") || file.mime === "application/pdf");
        const signed = await presignGetUrl(file.r2_key, inlineOk ? undefined : file.name);
        await supabaseAdmin.from("share_links").update({ downloads: link.downloads + 1 }).eq("id", link.id);
        await logAudit({ action: "share.access", target: link.file_id, meta: { ip } });
        return Response.redirect(signed, 302);
      },
    },
  },
});

function jsonErr(status: number, message: string) {
  return Response.json({ error: message }, { status, headers: { "access-control-allow-origin": "*" } });
}

type Link = {
  id: string; file_id: string; password_hash: string | null;
  expires_at: string | null; max_downloads: number | null; downloads: number; revoked: boolean;
};

async function loadLink(token: string): Promise<Link | { error: string; status: number }> {
  const { data: link } = await supabaseAdmin
    .from("share_links")
    .select("id, file_id, password_hash, expires_at, max_downloads, downloads, revoked")
    .eq("token_hash", sha256(token))
    .maybeSingle();
  if (!link || link.revoked) return { error: "Link not found", status: 404 };
  if (link.expires_at && new Date(link.expires_at) < new Date()) return { error: "Link expired", status: 410 };
  if (link.max_downloads && link.downloads >= link.max_downloads) return { error: "Download limit reached", status: 410 };
  return link as Link;
}
