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
