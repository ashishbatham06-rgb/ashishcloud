import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sha256, compareSecret } from "@/lib/crypto.server";
import { presignGetUrl } from "@/lib/r2.server";
import { logAudit, rateLimit } from "@/lib/audit.server";

// Public share endpoint. GET ?p=password optional.
export const Route = createFileRoute("/api/public/s/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "";
        if (!rateLimit(`share:${ip}`, 30, 60_000)) return new Response("Too many requests", { status: 429 });

        const token = params.token;
        const url = new URL(request.url);
        const password = url.searchParams.get("p") || "";

        const { data: link } = await supabaseAdmin
          .from("share_links")
          .select("id, file_id, password_hash, expires_at, max_downloads, downloads, revoked")
          .eq("token_hash", sha256(token))
          .maybeSingle();
        if (!link || link.revoked) return new Response("Link not found", { status: 404 });
        if (link.expires_at && new Date(link.expires_at) < new Date()) return new Response("Link expired", { status: 410 });
        if (link.max_downloads && link.downloads >= link.max_downloads) return new Response("Download limit reached", { status: 410 });
        if (link.password_hash) {
          if (!password) return new Response("Password required", { status: 401 });
          const ok = await compareSecret(password, link.password_hash);
          if (!ok) return new Response("Wrong password", { status: 403 });
        }
        const { data: file } = await supabaseAdmin.from("files").select("r2_key, name, mime").eq("id", link.file_id).single();
        if (!file) return new Response("File missing", { status: 404 });
        // Inline preview for images/videos/pdf; attachment download otherwise (or when ?dl=1)
        const forceDl = url.searchParams.get("dl") === "1";
        const inlineOk = !!file.mime && (file.mime.startsWith("image/") || file.mime.startsWith("video/") || file.mime.startsWith("audio/") || file.mime === "application/pdf");
        const signed = await presignGetUrl(file.r2_key, forceDl || !inlineOk ? file.name : undefined);
        await supabaseAdmin.from("share_links").update({ downloads: link.downloads + 1 }).eq("id", link.id);
        await logAudit({ action: "share.download", target: link.file_id, meta: { ip } });
        return Response.redirect(signed, 302);
      },
    },
  },
});
