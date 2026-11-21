import { test, expect } from "bun:test";
process.env["GATEWAY_SIGNING_SECRET"] = "test-secret";
const { signGatewayToken, verifyGatewayToken } = await import("../src/lib/crypto.server");
const id = "11111111-1111-1111-1111-111111111111";
test("valid token verifies", () => { expect(verifyGatewayToken(signGatewayToken(id, true))?.f).toBe(id); });
test("tampered token rejected", () => {
  const t = signGatewayToken(id, false);
  const body = Buffer.from(JSON.stringify({ f: "22222222-2222-2222-2222-222222222222", d: 0, e: 9e9, n: "x" })).toString("base64url");
  expect(verifyGatewayToken(`${body}.${t.split(".")[1]}`)).toBeNull();
});
test("expired token rejected", () => { expect(verifyGatewayToken(signGatewayToken(id, false, -1))).toBeNull(); });
