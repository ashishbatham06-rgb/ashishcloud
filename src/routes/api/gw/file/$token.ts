import { createFileRoute } from "@tanstack/react-router";

// Secure file gateway: the ONLY path through which browsers read file bytes.
// R2 is never contacted by the client; a short-lived HMAC capability token
// (minted after server-side authorization) is required.
export const Route = createFileRoute("/api/gw/file/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { verifyGatewayToken } = await import("@/lib/crypto.server");
        const { getObjectStream, isR2Configured } = await import("@/lib/r2.server");
        const { rateLimit } = await import("@/lib/audit.server");
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ip = request.headers.get("cf-connecting-ip") || "anon";
        if (!rateLimit(`gw:${ip}`, 600, 60_000)) return new Response("Too many requests", { status: 429 });
        if (!isR2Configured()) return new Response("Unavailable", { status: 503 });
        const claims = verifyGatewayToken(params.token);
        if (!claims) return new Response("Forbidden", { status: 403 });
        const { data: file } = await supabaseAdmin.from("files").select("r2_key, name, mime, deleted_at").eq("id", claims.f).maybeSingle();
        if (!file || file.deleted_at) return new Response("Not found", { status: 404 });
        const range = request.headers.get("range");
        if (range && !/^bytes=\d*-\d*$/.test(range)) return new Response("Bad range", { status: 416 });
        try {
          const obj = await getObjectStream(file.r2_key, range);
          const h = new Headers({
            "content-type": file.mime || obj.contentType || "application/octet-stream",
            "accept-ranges": "bytes",
            "cache-control": "private, max-age=300",
            "x-content-type-options": "nosniff",
            "content-security-policy": "default-src 'none'; img-src 'self'; media-src 'self'",
            "cross-origin-resource-policy": "same-origin",
          });
          if (obj.contentLength != null) h.set("content-length", String(obj.contentLength));
          if (obj.contentRange) h.set("content-range", obj.contentRange);
          const safe = encodeURIComponent(file.name);
          h.set("content-disposition", `${claims.d ? "attachment" : "inline"}; filename*=UTF-8''${safe}`);
          return new Response(obj.body, { status: obj.contentRange ? 206 : 200, headers: h });
        } catch (e) {
          console.error("[gw] stream failed", e);
          return new Response("Not found", { status: 404 });
        }
      },
    },
  },
});
