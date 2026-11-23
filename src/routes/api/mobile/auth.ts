import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("login"), email: z.string().email().max(254), password: z.string().min(1).max(128) }).strict(),
  z.object({ action: z.literal("refresh"), refreshToken: z.string().min(10).max(4096) }).strict(),
  z.object({ action: z.literal("logout"), refreshToken: z.string().min(10).max(4096).optional() }).strict(),
]);

function reply(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}

export const Route = createFileRoute("/api/mobile/auth")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const {
          consumeGatewayLimit,
          consumeRequestNonce,
          gatewayErrorMessage,
          gatewayErrorStatus,
          isSameOriginRequest,
          passwordGrant,
          resolveGatewayIdentity,
          revokeAccessToken,
          rotateRefreshToken,
        } = await import("@/lib/auth-session.server");

        const origin = request.headers.get("origin");
        if ((origin && !isSameOriginRequest(request)) || !await consumeRequestNonce(request, "mobile-auth")) {
          return reply({ error: "Forbidden request." }, 403);
        }
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return reply({ error: "Invalid request." }, 400);
        const ip = request.headers.get("cf-connecting-ip") ?? "unknown";

        if (parsed.data.action === "login") {
          const email = parsed.data.email.trim().toLowerCase();
          if (!await consumeGatewayLimit(`mobile-login-ip:${ip}`, 30, 900) ||
              !await consumeGatewayLimit(`mobile-login-email:${email}`, 8, 900)) {
            return reply({ error: "Too many sign-in attempts. Please wait and try again." }, 429);
          }
          try {
            const session = await passwordGrant(email, parsed.data.password);
            return reply({ session });
          } catch (error) {
            return reply({ error: gatewayErrorMessage(error) }, gatewayErrorStatus(error));
          }
        }

        if (parsed.data.action === "refresh") {
          if (!await consumeGatewayLimit(`mobile-refresh:${ip}`, 120, 900)) return reply({ error: "Too many requests." }, 429);
          try {
            const session = await rotateRefreshToken(parsed.data.refreshToken);
            const requestWithToken = new Request(request.url, { headers: { authorization: `Bearer ${session.access_token}` } });
            const identity = await resolveGatewayIdentity(requestWithToken, true);
            if (!identity) return reply({ error: "Account access could not be verified." }, 401);
            return reply({ session });
          } catch (error) {
            return reply({ error: gatewayErrorMessage(error) }, gatewayErrorStatus(error));
          }
        }

        const refreshToken = parsed.data.refreshToken;
        const accessHeader = request.headers.get("authorization") ?? "";
        const accessToken = accessHeader.startsWith("Bearer ") ? accessHeader.slice(7).trim() : "";
        if (refreshToken && accessToken) {
          try {
            const rotated = await rotateRefreshToken(refreshToken);
            await revokeAccessToken(rotated.access_token).catch(() => null);
          } catch {
            if (accessToken) await revokeAccessToken(accessToken).catch(() => null);
          }
        } else if (accessToken) {
          await revokeAccessToken(accessToken).catch(() => null);
        }
        return reply({ ok: true });
      },
    },
  },
});