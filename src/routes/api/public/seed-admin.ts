import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// One-shot admin bootstrap. POST with header x-seed-secret: <ADMIN_SEED_SECRET>.
// Creates an admin user from ADMIN_SEED_EMAIL + ADMIN_SEED_PASSWORD if no admin exists yet.
export const Route = createFileRoute("/api/public/seed-admin")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const provided = request.headers.get("x-seed-secret") || "";
        const expected = process.env.ADMIN_SEED_SECRET || "";
        if (!expected || provided !== expected) return new Response("Forbidden", { status: 403 });

        const { count } = await supabaseAdmin
          .from("user_roles")
          .select("*", { count: "exact", head: true })
          .eq("role", "admin");
        if ((count ?? 0) > 0) return Response.json({ ok: false, reason: "Admin already exists" }, { status: 409 });

        const email = process.env.ADMIN_SEED_EMAIL;
        const password = process.env.ADMIN_SEED_PASSWORD;
        if (!email || !password) return Response.json({ ok: false, reason: "Missing ADMIN_SEED_EMAIL/PASSWORD" }, { status: 400 });

        const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: "Admin" },
        });
        if (error || !created.user) return Response.json({ ok: false, reason: error?.message }, { status: 500 });

        await supabaseAdmin.from("user_roles").insert({ user_id: created.user.id, role: "admin" }).then(() => null, () => null);
        await supabaseAdmin.from("profiles").update({ storage_quota_bytes: 1024 ** 4 }).eq("id", created.user.id);
        return Response.json({ ok: true, email });
      },
    },
  },
});
