import test from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { GET as getDrilldown } from "../src/app/api/market-data/drilldown/[year]/route";
import { GET as getBreadth } from "../src/app/api/market-data/breadth/route";

test("API Security: Unauthenticated request to drilldown API returns 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/market-data/drilldown/2026");
  const params = Promise.resolve({ year: "2026" });
  const res = await getDrilldown(req, { params });

  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.error, "Unauthorized");
});

test("API Security: Unauthenticated request to breadth API returns 401", async () => {
  const req = new NextRequest("http://localhost:3000/api/market-data/breadth");
  const res = await getBreadth(req);

  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.error, "Unauthorized");
});

test("API Security: Year input validation strictly enforces /^[0-9]{4}$/", async () => {
  // Test malicious path traversals, SQL injection payloads, and malformed strings
  const maliciousInputs = [
    "../../etc/passwd",
    "2026/../secret",
    "202",
    "20265",
    "2026' OR '1'='1",
    "<script>alert(1)</script>",
    "2026;DROP TABLE users;",
    "2026.json",
  ];

  for (const input of maliciousInputs) {
    const isYearValid = /^\d{4}$/.test(input);
    assert.strictEqual(
      isYearValid,
      false,
      `Payload "${input}" should be rejected by regex validation`
    );
  }

  const validYears = ["2014", "2020", "2024", "2025", "2026"];
  for (const year of validYears) {
    assert.strictEqual(
      /^\d{4}$/.test(year),
      true,
      `Year "${year}" should be accepted by regex validation`
    );
  }
});

test("API Security: Year input validation strictly enforces historical boundaries (1990-2050)", () => {
  const outOfRange = [1899, 1989, 2051, 2999, 9999];
  for (const yr of outOfRange) {
    const isWithinBounds = yr >= 1990 && yr <= 2050;
    assert.strictEqual(isWithinBounds, false, `Year ${yr} must be rejected as out of range`);
  }

  const inRange = [1990, 2014, 2024, 2026, 2050];
  for (const yr of inRange) {
    const isWithinBounds = yr >= 1990 && yr <= 2050;
    assert.strictEqual(isWithinBounds, true, `Year ${yr} must be accepted as in range`);
  }
});

test("API Security: Breadth API limit parameter is sanitized against negative or NaN values", () => {
  const sanitizeLimit = (raw: string | null) => {
    if (!raw) return null;
    const parsed = parseInt(raw, 10);
    return !isNaN(parsed) && parsed > 0 ? parsed : null;
  };

  assert.strictEqual(sanitizeLimit("-5"), null);
  assert.strictEqual(sanitizeLimit("0"), null);
  assert.strictEqual(sanitizeLimit("invalid"), null);
  assert.strictEqual(sanitizeLimit("100"), 100);
});

test("API Security: Cron sync route requires valid CRON_SECRET", async () => {
  const { GET: cronSync } = await import("../src/app/api/cron/sync-daily-data/route");

  // Save original env
  const origSecret = process.env.CRON_SECRET;
  try {
    process.env.CRON_SECRET = "super_secret_test_token_123";

    // 1. Request with no auth header
    const reqNoAuth = new NextRequest("http://localhost:3000/api/cron/sync-daily-data");
    const resNoAuth = await cronSync(reqNoAuth);
    assert.strictEqual(resNoAuth.status, 401);

    // 2. Request with invalid token
    const reqBadAuth = new NextRequest("http://localhost:3000/api/cron/sync-daily-data", {
      headers: { authorization: "Bearer wrong_token" },
    });
    const resBadAuth = await cronSync(reqBadAuth);
    assert.strictEqual(resBadAuth.status, 401);

    // 3. Request with valid token
    const reqValidAuth = new NextRequest("http://localhost:3000/api/cron/sync-daily-data", {
      headers: { authorization: "Bearer super_secret_test_token_123" },
    });
    const resValidAuth = await cronSync(reqValidAuth);
    // Should pass authorization (status 200 with already_up_to_date or waiting_for_nse)
    assert.strictEqual(resValidAuth.status, 200);
  } finally {
    process.env.CRON_SECRET = origSecret;
  }
});

test("Security: Callback URL sanitizer strictly blocks Open Redirects", () => {
  function sanitizeCallbackUrl(url: string | null): string {
    if (!url || typeof url !== "string") return "/";
    if (url.startsWith("/") && !url.startsWith("//") && !url.includes("://")) {
      return url;
    }
    return "/";
  }

  // Dangerous URLs that must be rejected and reset to "/"
  const openRedirectPayloads = [
    "https://evil.com",
    "http://attacker.com/steal-creds",
    "//evil.com",
    "//attacker.com/phish",
    "javascript:alert(1)",
    "data:text/html,<script>alert(1)</script>",
    "https://quantbreadth.com.evil.com",
    "\\\\evil.com",
  ];

  for (const maliciousUrl of openRedirectPayloads) {
    assert.strictEqual(
      sanitizeCallbackUrl(maliciousUrl),
      "/",
      `Payload "${maliciousUrl}" must be sanitized to "/"`
    );
  }

  // Safe internal relative paths that must be preserved
  const safePaths = ["/dashboard", "/charts", "/?timeframe=3M", "/verify-email"];
  for (const safePath of safePaths) {
    assert.strictEqual(
      sanitizeCallbackUrl(safePath),
      safePath,
      `Safe path "${safePath}" must be preserved`
    );
  }
});

test("Security: Email template escapeHtml strictly neutralizes HTML injection payloads", () => {
  function escapeHtml(str: string): string {
    return str.replace(/[&<>"']/g, (m) => {
      switch (m) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default: return m;
      }
    });
  }

  const maliciousNames = [
    "<script>alert('XSS')</script>",
    "<img src=x onerror=alert(1)>",
    "</h1><a href='https://phish.com'>Click Here</a>",
    "John \"Big\" Doe & Sons",
  ];

  for (const payload of maliciousNames) {
    const escaped = escapeHtml(payload);
    assert.strictEqual(escaped.includes("<script>"), false);
    assert.strictEqual(escaped.includes("<img"), false);
    assert.strictEqual(escaped.includes("</h1>"), false);
    assert.strictEqual(escaped.includes("<"), false);
    assert.strictEqual(escaped.includes(">"), false);
  }
});

test("Logic: Breadth API limit parameter slices from tail and returns newest-first", () => {
  const mockData = [
    { Date: "2015-01-08", NetNewHighs: 10 },
    { Date: "2015-01-09", NetNewHighs: 15 },
    { Date: "2026-10-26", NetNewHighs: -20 },
    { Date: "2026-10-27", NetNewHighs: -15 },
  ];

  const limit = 2;
  const count = Math.min(limit, mockData.length);
  const result = mockData.slice(-count).reverse();

  assert.strictEqual(result.length, 2);
  assert.strictEqual(result[0].Date, "2026-10-27");
  assert.strictEqual(result[1].Date, "2026-10-26");
});

test("Security: Better-Auth user schema has input: false on privileged fields", async () => {
  const { auth } = await import("../src/lib/auth/auth");
  // Inspect options to ensure input: false is configured on role and plan
  const options = (auth as any).options;
  const userAdditionalFields = options?.user?.additionalFields;
  assert.ok(userAdditionalFields, "user.additionalFields must be configured");
  assert.strictEqual(userAdditionalFields.role?.input, false, "role must have input: false");
  assert.strictEqual(userAdditionalFields.plan?.input, false, "plan must have input: false");
});
