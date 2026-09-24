import test from "node:test";
import assert from "node:assert";
import { hasEntitlement, hasRole, FeatureEntitlement, UserContext } from "../src/lib/auth/entitlements";

test("Entitlements: Unauthenticated user has zero access", () => {
  const features: FeatureEntitlement[] = [
    "view_breadth_heatmap",
    "view_sectors_themes",
    "view_charts_studio",
    "view_drilldowns",
    "export_data",
    "historical_matcher",
    "intraday_breadth",
    "custom_watchlists",
  ];

  for (const feat of features) {
    assert.strictEqual(hasEntitlement(null, feat), false, `Null user should not have ${feat}`);
    assert.strictEqual(hasEntitlement(undefined, feat), false, `Undefined user should not have ${feat}`);
  }
});

test("Entitlements: Admin has full access to all features", () => {
  const adminUser: UserContext = {
    id: "admin-1",
    email: "admin@quantbreadth.com",
    role: "admin",
    plan: "FREE",
  };

  assert.strictEqual(hasEntitlement(adminUser, "view_breadth_heatmap"), true);
  assert.strictEqual(hasEntitlement(adminUser, "export_data"), true);
  assert.strictEqual(hasEntitlement(adminUser, "historical_matcher"), true);
  assert.strictEqual(hasEntitlement(adminUser, "intraday_breadth"), true);
  assert.strictEqual(hasEntitlement(adminUser, "advanced_scanners"), true);
  assert.strictEqual(hasEntitlement(adminUser, "realtime_alerts"), true);
  assert.strictEqual(hasRole(adminUser, "admin"), true);
  assert.strictEqual(hasRole(adminUser, "user"), false);
});

test("Entitlements: Demo user has full terminal access for client demos", () => {
  const demoUser: UserContext = {
    id: "demo-1",
    email: "demo@quantbreadth.com",
    role: "demo",
    plan: "PRO",
  };

  assert.strictEqual(hasEntitlement(demoUser, "view_breadth_heatmap"), true);
  assert.strictEqual(hasEntitlement(demoUser, "view_drilldowns"), true);
  assert.strictEqual(hasEntitlement(demoUser, "historical_matcher"), true);
  assert.strictEqual(hasEntitlement(demoUser, "intraday_breadth"), true);
  assert.strictEqual(hasRole(demoUser, "demo"), true);
});

test("Entitlements: FREE plan user has baseline access but no PRO/INSTITUTIONAL features", () => {
  const freeUser: UserContext = {
    id: "user-1",
    email: "free@quantbreadth.com",
    role: "user",
    plan: "FREE",
  };

  // Allowed baseline features
  assert.strictEqual(hasEntitlement(freeUser, "view_breadth_heatmap"), true);
  assert.strictEqual(hasEntitlement(freeUser, "view_sectors_themes"), true);
  assert.strictEqual(hasEntitlement(freeUser, "view_charts_studio"), true);
  assert.strictEqual(hasEntitlement(freeUser, "view_drilldowns"), true);
  assert.strictEqual(hasEntitlement(freeUser, "command_palette"), true);
  assert.strictEqual(hasEntitlement(freeUser, "strategy_matrix"), true);

  // Gated PRO / Institutional features
  assert.strictEqual(hasEntitlement(freeUser, "export_data"), false);
  assert.strictEqual(hasEntitlement(freeUser, "historical_matcher"), false);
  assert.strictEqual(hasEntitlement(freeUser, "custom_watchlists"), false);
  assert.strictEqual(hasEntitlement(freeUser, "intraday_breadth"), false);
  assert.strictEqual(hasEntitlement(freeUser, "advanced_scanners"), false);
  assert.strictEqual(hasEntitlement(freeUser, "realtime_alerts"), false);
});

test("Entitlements: PRO plan user has PRO features but no INSTITUTIONAL features", () => {
  const proUser: UserContext = {
    id: "user-2",
    email: "pro@quantbreadth.com",
    role: "user",
    plan: "PRO",
  };

  // Allowed PRO features
  assert.strictEqual(hasEntitlement(proUser, "view_breadth_heatmap"), true);
  assert.strictEqual(hasEntitlement(proUser, "export_data"), true);
  assert.strictEqual(hasEntitlement(proUser, "historical_matcher"), true);
  assert.strictEqual(hasEntitlement(proUser, "custom_watchlists"), true);

  // Gated Institutional features
  assert.strictEqual(hasEntitlement(proUser, "intraday_breadth"), false);
  assert.strictEqual(hasEntitlement(proUser, "advanced_scanners"), false);
  assert.strictEqual(hasEntitlement(proUser, "realtime_alerts"), false);
});

test("Entitlements: INSTITUTIONAL plan user has access to all premium features", () => {
  const instUser: UserContext = {
    id: "user-3",
    email: "inst@quantbreadth.com",
    role: "user",
    plan: "INSTITUTIONAL",
  };

  assert.strictEqual(hasEntitlement(instUser, "view_breadth_heatmap"), true);
  assert.strictEqual(hasEntitlement(instUser, "export_data"), true);
  assert.strictEqual(hasEntitlement(instUser, "historical_matcher"), true);
  assert.strictEqual(hasEntitlement(instUser, "custom_watchlists"), true);
  assert.strictEqual(hasEntitlement(instUser, "intraday_breadth"), true);
  assert.strictEqual(hasEntitlement(instUser, "advanced_scanners"), true);
  assert.strictEqual(hasEntitlement(instUser, "realtime_alerts"), true);
});
