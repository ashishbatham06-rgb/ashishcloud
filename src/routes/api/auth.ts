import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const LoginBody = z.object({
  action: z.literal("login"),
  email: z.string().email().max(254).transform((value) => value.trim().toLowerCase()),
  password: z.string().min(1).max(128),
}).strict();
const ActionBody = z.object({ action: z.enum(["refresh", "logout"]) }).strict();

function json(body: unknown, status = 200, headers?: HeadersInit) {
  const responseHeaders = new Headers(headers);
  responseHeaders.set("cache-control", "no-store");
  responseHeaders.set("content-type", "application/json; charset=utf-8");
  responseHeaders.set("x-content-type-options", "nosniff");
  return new Response(JSON.stringify(body), { status, headers: responseHeaders });
}

async function validMutationRequest(request: Request): Promise<boolean> {
  const { consumeRequestNonce, isSameOriginRequest } = await import("@/lib/auth-session.server");
  if (!isSameOriginRequest(request)) return false;
  return consumeRequestNonce(request, "web-auth");
}

export const Route = createFileRoute("/api/auth")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { resolveGatewayIdentity, clearSessionCookie } = await import("@/lib/auth-session.server");
        try {
          const identity = await resolveGatewayIdentity(request);
          if (!identity || identity.clearCookie) {
            return json({ authenticated: false }, 200, identity?.clearCookie ? { "set-cookie": clearSessionCookie() } : undefined);
          }
          const headers = identity.setCookie ? { "set-cookie": identity.setCookie } : undefined;
          return json({ authenticated: true, user: { id: identity.userId, email: identity.email } }, 200, headers);
        } catch (error) {
          console.error("[gateway-auth] session check failed", error);
          return json({ authenticated: false }, 503);
        }
      },
      POST: async ({ request }) => {
        const {
          clearSessionCookie,
          consumeGatewayLimit,
          createSessionCookie,
          gatewayErrorMessage,
          gatewayErrorStatus,
          isSameOriginRequest,
          passwordGrant,
          resolveGatewayIdentity,
          revokeAccessToken,
        } = await import("@/lib/auth-session.server");
        if (!await validMutationRequest(request)) return json({ error: "Forbidden request." }, 403);
        const parsed = await request.json().catch(() => null);
        const login = LoginBody.safeParse(parsed);
        const action = ActionBody.safeParse(parsed);
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

        if (login.success) {
          if (!await consumeGatewayLimit(`web-login-ip:${ip}`, 30, 900) ||
              !await consumeGatewayLimit(`web-login-email:${login.data.email}`, 8, 900)) {
            return json({ error: "Too many sign-in attempts. Please wait and try again." }, 429);
          }
          try {
            const tokens = await passwordGrant(login.data.email, login.data.password);
            const cookie = await createSessionCookie(tokens);
            return json({ ok: true, user: { id: tokens.user.id, email: tokens.user.email ?? null } }, 200, { "set-cookie": cookie });
          } catch (error) {
            const status = gatewayErrorStatus(error);
            if (status >= 500) console.error("[gateway-auth] sign-in failed", error);
            return json({ error: gatewayErrorMessage(error) }, status);
          }
        }

        if (!action.success) return json({ error: "Invalid request." }, 400);
        if (action.data.action === "logout") {
          const identity = await resolveGatewayIdentity(request);
          if (identity?.accessToken) await revokeAccessToken(identity.accessToken).catch(() => null);
          return json({ ok: true }, 200, { "set-cookie": clearSessionCookie() });
        }

        const identity = await resolveGatewayIdentity(request);
        if (!identity || identity.clearCookie) {
          return json({ authenticated: false }, 401, { "set-cookie": clearSessionCookie() });
        }
        return json({ authenticated: true }, 200, identity.setCookie ? { "set-cookie": identity.setCookie } : undefined);
      },
    },
  },
});