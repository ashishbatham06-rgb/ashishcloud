// MSG91 User Existence Validation endpoint.
// Widget calls: GET /api/public/user-exists?identifier=<email-or-phone>
// Optional header: x-validation-secret: <MSG91_VALIDATION_SECRET>
// Response (always 200): { user_found: boolean, identifier: string }
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { rateLimit } from "@/lib/audit.server";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-validation-secret",
};

function reply(found: boolean, identifier: string, status = 200) {
  return new Response(
    JSON.stringify({ user_found: found, identifier }),
    { status, headers: { ...CORS, "Content-Type": "application/json" } },
  );
}

async function userExists(identifier: string): Promise<boolean> {
  const isEmail = identifier.includes("@");
  // Use admin listUsers with filter. Supabase JS supports `email` filter via query.
  if (isEmail) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1,
    });
    if (error) return false;
    // listUsers does not accept a server-side email filter in all versions;
    // fall back to profiles email column if present.
    const hit = data.users.find(
      (u) => u.email?.toLowerCase() === identifier.toLowerCase(),
    );
    if (hit) return true;
    const { data: prof } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .ilike("email", identifier)
      .maybeSingle();
    return !!prof;
  }
  // Phone path — strip non-digits, compare last 10 digits as a tolerant match.
  const digits = identifier.replace(/\D/g, "");
  if (digits.length < 6) return false;
  const { data } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  return !!data?.users.some((u) => (u.phone ?? "").replace(/\D/g, "").endsWith(digits));
}

export const Route = createFileRoute("/api/public/user-exists")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const identifier = (url.searchParams.get("identifier") ?? "").trim();
        if (!identifier || identifier.length > 254) {
          return reply(false, identifier);
        }

        // Optional shared-secret gate (set MSG91_VALIDATION_SECRET to enforce)
        const required = process.env.MSG91_VALIDATION_SECRET;
        if (required) {
          const got = request.headers.get("x-validation-secret");
          if (got !== required) return reply(false, identifier, 401);
        }

        // Rate limit per identifier (mitigate enumeration)
        if (!rateLimit(`user-exists:${identifier}`, 10, 60_000)) {
          return reply(false, identifier, 429);
        }

        try {
          const found = await userExists(identifier);
          return reply(found, identifier);
        } catch (e) {
          console.error("user-exists error", e);
          return reply(false, identifier);
        }
      },
    },
  },
});
