import test from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { proxy } from "../src/proxy";

function createMockRequest(path: string, cookies: Record<string, string> = {}, host = "localhost:3000") {
  const url = `http://${host}${path}`;
  const req = new NextRequest(url);
  for (const [key, value] of Object.entries(cookies)) {
    req.cookies.set(key, value);
  }
  return req;
}

test("Proxy: Unauthenticated user accessing / is redirected to /login", () => {
  const req = createMockRequest("/");
  const res = proxy(req);

  assert.strictEqual(res.status, 307);
  const location = res.headers.get("location");
  assert.ok(location?.includes("/login"), `Expected redirect to /login, got: ${location}`);
  assert.ok(location?.includes("callbackUrl=%2F"), `Expected callbackUrl to be encoded /, got: ${location}`);
});

test("Proxy: Unauthenticated user accessing /charts is redirected to /login", () => {
  const req = createMockRequest("/charts");
  const res = proxy(req);

  assert.strictEqual(res.status, 307);
  const location = res.headers.get("location");
  assert.ok(location?.includes("/login"), `Expected redirect to /login, got: ${location}`);
  assert.ok(location?.includes("callbackUrl=%2Fcharts"), `Expected callbackUrl=/charts, got: ${location}`);
});

test("Proxy: Unauthenticated access to protected API returns 401 Unauthorized", async () => {
  const req = createMockRequest("/api/market-data/breadth");
  const res = proxy(req);

  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.error, "Unauthorized");
});

test("Proxy: Unauthenticated access to static drilldown data returns 401 Unauthorized", async () => {
  const req = createMockRequest("/drilldowns/2026.json");
  const res = proxy(req);

  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.error, "Unauthorized");
});

test("Proxy: Unauthenticated access to static market_breadth.json returns 401 Unauthorized", async () => {
  const req = createMockRequest("/market_breadth.json");
  const res = proxy(req);

  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.error, "Unauthorized");
});

test("Proxy: Public auth routes pass through unblocked", () => {
  const publicRoutes = [
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/api/health",
    "/api/auth/sign-in/email",
    "/api/auth/get-session",
  ];

  for (const path of publicRoutes) {
    const req = createMockRequest(path);
    const res = proxy(req);
    assert.strictEqual(res.status, 200, `Expected 200 next() for public route ${path}, got ${res.status}`);
  }
});

test("Proxy: Authenticated user with session cookie accesses dashboard successfully", () => {
  const req = createMockRequest("/", {
    "better-auth.session_token": "valid-session-token-abc-123",
  });
  const res = proxy(req);

  assert.strictEqual(res.status, 200);
});

test("Proxy: Authenticated user with HTTPS secure cookie accesses dashboard successfully", () => {
  const req = createMockRequest("/", {
    "__Secure-better-auth.session_token": "valid-secure-token-xyz-789",
  });
  const res = proxy(req);

  assert.strictEqual(res.status, 200);
});

test("Proxy: User with session cookie visiting /login passes through without infinite loop", () => {
  const req = createMockRequest("/login", {
    "better-auth.session_token": "potentially-expired-token",
  });
  const res = proxy(req);

  // Must NOT blindly redirect to / which causes infinite loops on expired sessions
  assert.strictEqual(res.status, 200);
});

test("Proxy: Authenticated user direct access to static drilldown data returns 403 Forbidden", async () => {
  const req = createMockRequest("/drilldowns/2026.json", {
    "better-auth.session_token": "valid-session-token",
  });
  const res = proxy(req);

  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.error, "Forbidden");
});

test("Proxy: Authenticated user direct access to static market_breadth.json returns 403 Forbidden", async () => {
  const req = createMockRequest("/market_breadth.json", {
    "better-auth.session_token": "valid-session-token",
  });
  const res = proxy(req);

  assert.strictEqual(res.status, 403);
  const body = await res.json();
  assert.strictEqual(body.error, "Forbidden");
});

test("Proxy: Trailing slashes on protected dataset paths are normalized and blocked", async () => {
  const req = createMockRequest("/market_breadth.json/");
  const res = proxy(req);

  assert.strictEqual(res.status, 401);
  const body = await res.json();
  assert.strictEqual(body.error, "Unauthorized");
});

test("Proxy: Demo domain sets x-is-demo header", () => {
  const req = createMockRequest(
    "/",
    { "better-auth.session_token": "valid-session-token" },
    "demo.quantbreadth.com"
  );
  const res = proxy(req);

  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get("x-is-demo"), "true");
});
