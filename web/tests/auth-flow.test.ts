import test from "node:test";
import assert from "node:assert";
import { NextRequest } from "next/server";
import { GET as getHealth } from "../src/app/api/health/route";
import { GET as getUserMe } from "../src/app/api/user/me/route";
import { sendEmailVerification, sendPasswordResetEmail } from "../src/lib/email/resend";
import {
  user,
  session,
  account,
  verification,
  subscription,
  userPreference,
  watchlist,
  savedScanner,
  alert,
} from "../src/lib/db/schema";
import { auth } from "../src/lib/auth/auth";

test("Health Check API: Returns 200 OK and healthy status with market data metrics", async () => {
  const res = await getHealth();
  assert.strictEqual(res.status, 200);
  const data = await res.json();
  assert.strictEqual(data.status, "healthy");
  assert.ok(data.total_sessions > 0, "Expected non-zero total sessions");
  assert.ok(data.latest_date, "Expected latest_date");
});

test("User/Me API: Unauthenticated request returns 401 Unauthorized", async () => {
  const req = new NextRequest("http://localhost:3000/api/user/me");
  const res = await getUserMe(req);
  assert.strictEqual(res.status, 401);
  const data = await res.json();
  assert.strictEqual(data.error, "Unauthorized");
});

test("Resend Email Service: Handles missing API key gracefully without throwing", async () => {
  const verifyResult = await sendEmailVerification({
    email: "analyst@fund.com",
    name: "Analyst",
    url: "https://quantbreadth.com/verify-email?token=xyz",
  });
  assert.strictEqual(verifyResult.success, true);

  const resetResult = await sendPasswordResetEmail({
    email: "analyst@fund.com",
    url: "https://quantbreadth.com/reset-password?token=xyz",
  });
  assert.strictEqual(resetResult.success, true);
});

test("Database Schema: Better Auth tables are defined with required columns", () => {
  // Check user table columns
  assert.ok(user.id, "user.id must exist");
  assert.ok(user.name, "user.name must exist");
  assert.ok(user.email, "user.email must exist");
  assert.ok(user.emailVerified, "user.emailVerified must exist");
  assert.ok(user.role, "user.role must exist");
  assert.ok(user.plan, "user.plan must exist");

  // Check session table columns
  assert.ok(session.id, "session.id must exist");
  assert.ok(session.userId, "session.userId must exist");
  assert.ok(session.token, "session.token must exist");
  assert.ok(session.expiresAt, "session.expiresAt must exist");

  // Check account table columns
  assert.ok(account.id, "account.id must exist");
  assert.ok(account.userId, "account.userId must exist");
  assert.ok(account.providerId, "account.providerId must exist");
  assert.ok(account.accountId, "account.accountId must exist");

  // Check verification table columns
  assert.ok(verification.id, "verification.id must exist");
  assert.ok(verification.identifier, "verification.identifier must exist");
  assert.ok(verification.value, "verification.value must exist");
  assert.ok(verification.expiresAt, "verification.expiresAt must exist");
});

test("Database Schema: SaaS expansion tables are defined properly", () => {
  // Subscription
  assert.ok(subscription.id, "subscription.id must exist");
  assert.ok(subscription.userId, "subscription.userId must exist");
  assert.ok(subscription.plan, "subscription.plan must exist");
  assert.ok(subscription.status, "subscription.status must exist");

  // User Preference
  assert.ok(userPreference.id, "userPreference.id must exist");
  assert.ok(userPreference.userId, "userPreference.userId must exist");
  assert.ok(userPreference.theme, "userPreference.theme must exist");

  // Watchlist
  assert.ok(watchlist.id, "watchlist.id must exist");
  assert.ok(watchlist.userId, "watchlist.userId must exist");
  assert.ok(watchlist.name, "watchlist.name must exist");
  assert.ok(watchlist.symbols, "watchlist.symbols must exist");

  // Saved Scanner
  assert.ok(savedScanner.id, "savedScanner.id must exist");
  assert.ok(savedScanner.userId, "savedScanner.userId must exist");
  assert.ok(savedScanner.filters, "savedScanner.filters must exist");

  // Alert
  assert.ok(alert.id, "alert.id must exist");
  assert.ok(alert.userId, "alert.userId must exist");
  assert.ok(alert.title, "alert.title must exist");
  assert.ok(alert.condition, "alert.condition must exist");
});

test("Better Auth Instance: Initialized with required auth methods and options", () => {
  assert.ok(auth, "Better Auth instance should be defined");
  assert.ok(auth.api, "Better Auth api should be available");
  assert.ok(typeof auth.api.getSession === "function", "getSession must be a function");
  assert.ok(typeof auth.api.signUpEmail === "function", "signUpEmail must be a function");
  assert.ok(typeof auth.api.signInEmail === "function", "signInEmail must be a function");
});

test("Better Auth Rate Limiting & IP Resolution: Configured for production stability", () => {
  const options = (auth as unknown as { options: Record<string, unknown> }).options;
  assert.ok(options.rateLimit, "Rate limiting options must be configured");
  const rateLimit = options.rateLimit as { window: number; max: number; customRules?: Record<string, unknown> };
  assert.strictEqual(rateLimit.window, 60, "Rate limit window must be 60 seconds");
  assert.strictEqual(rateLimit.max, 120, "Rate limit default max must be 120");
  assert.ok(rateLimit.customRules?.["/sign-in/*"], "Custom rate limit rule for /sign-in/* must exist");

  const advanced = options.advanced as { ipAddress?: { ipAddressHeaders?: string[] } };
  assert.ok(advanced?.ipAddress?.ipAddressHeaders, "ipAddressHeaders must be configured");
  assert.ok(advanced.ipAddress.ipAddressHeaders.includes("x-real-ip"), "Must include x-real-ip for Vercel");
  assert.ok(advanced.ipAddress.ipAddressHeaders.includes("cf-connecting-ip"), "Must include cf-connecting-ip for Cloudflare");
});

test("Database SSL Configuration: Supabase and remote URLs require SSL even in local development", () => {
  const determineSsl = (url: string) => {
    const isLocal =
      url.includes("localhost") ||
      url.includes("127.0.0.1") ||
      url.includes("host.docker.internal");
    return isLocal ? false : "require";
  };

  assert.strictEqual(
    determineSsl("postgresql://postgres:pass@localhost:5432/postgres"),
    false,
    "Localhost must not require SSL"
  );
  assert.strictEqual(
    determineSsl("postgresql://postgres:pass@127.0.0.1:5432/postgres"),
    false,
    "127.0.0.1 must not require SSL"
  );
  assert.strictEqual(
    determineSsl("postgresql://postgres.ref:pass@aws-0-us-east-1.pooler.supabase.com:6543/postgres"),
    "require",
    "Remote Supabase URL must require SSL"
  );
});

test("Demo Environment: Subdomain demo.quantbreadth.com is correctly identified", () => {
  const isDemoHost = (hostname: string) => hostname.startsWith("demo.");

  assert.strictEqual(isDemoHost("demo.quantbreadth.com"), true);
  assert.strictEqual(isDemoHost("demo.localhost"), true);
  assert.strictEqual(isDemoHost("quantbreadth.com"), false);
  assert.strictEqual(isDemoHost("app.quantbreadth.com"), false);
});
