export type UserPlan = "FREE" | "PRO" | "INSTITUTIONAL";
export type UserRole = "user" | "admin" | "demo";

export type FeatureEntitlement =
  | "view_breadth_heatmap"
  | "view_sectors_themes"
  | "view_charts_studio"
  | "view_drilldowns"
  | "export_data"
  | "historical_matcher"
  | "strategy_matrix"
  | "command_palette"
  | "intraday_breadth"
  | "custom_watchlists"
  | "advanced_scanners"
  | "realtime_alerts";

export interface UserContext {
  id: string;
  email: string;
  name?: string | null;
  role?: string | null;
  plan?: string | null;
}

/**
 * Clean entitlement abstraction for feature gating across the terminal.
 * Avoids scattering hardcoded subscription checks across the codebase.
 */
export function hasEntitlement(
  user: UserContext | null | undefined,
  feature: FeatureEntitlement
): boolean {
  if (!user) return false;

  // Administrators and demo accounts have full access to demonstrate all features
  if (user.role === "admin" || user.role === "demo") {
    return true;
  }

  const plan = ((user.plan || "FREE").toUpperCase() as UserPlan) || "FREE";

  switch (feature) {
    // Baseline features available to all authenticated users
    case "view_breadth_heatmap":
    case "view_sectors_themes":
    case "view_charts_studio":
    case "view_drilldowns":
    case "command_palette":
    case "strategy_matrix":
      return true;

    // Professional Tier features
    case "export_data":
    case "historical_matcher":
    case "custom_watchlists":
      return plan === "PRO" || plan === "INSTITUTIONAL";

    // Institutional / Future Premium features
    case "intraday_breadth":
    case "advanced_scanners":
    case "realtime_alerts":
      return plan === "INSTITUTIONAL";

    default:
      return false;
  }
}

/**
 * Check if the user has a specific role (e.g. admin).
 */
export function hasRole(
  user: UserContext | null | undefined,
  role: UserRole
): boolean {
  if (!user) return false;
  return user.role === role;
}
