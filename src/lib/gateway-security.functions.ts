import { createMiddleware } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

export const gatewayRequestSecurity = createMiddleware({ type: "function" })
  .client(async ({ next }) => {
    const nonce = globalThis.crypto.randomUUID();
    return next({ headers: { "X-Request-Nonce": nonce } });
  })
  .server(async ({ next }) => {
    const request = getRequest();
    if (!request || request.method !== "POST") return next();
    const { consumeRequestNonce, isSameOriginRequest } = await import("@/lib/auth-session.server");
    const origin = request.headers.get("origin");
    const hasCookie = !!request.headers.get("cookie");
    const fetchSite = request.headers.get("sec-fetch-site");
    if ((origin && !isSameOriginRequest(request)) || (!origin && (hasCookie || fetchSite === "cross-site"))) {
      throw new Response("Forbidden origin", { status: 403 });
    }
    if (!await consumeRequestNonce(request, new URL(request.url).pathname)) {
      throw new Response("Request expired or already used. Please retry.", { status: 409 });
    }
    return next();
  });