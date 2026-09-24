import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { hasEntitlement, FeatureEntitlement } from "@/lib/auth/entitlements";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const allFeatures: FeatureEntitlement[] = [
      "view_breadth_heatmap",
      "view_sectors_themes",
      "view_charts_studio",
      "view_drilldowns",
      "export_data",
      "historical_matcher",
      "strategy_matrix",
      "command_palette",
      "intraday_breadth",
      "custom_watchlists",
      "advanced_scanners",
      "realtime_alerts",
    ];

    const entitlements = allFeatures.reduce((acc, feat) => {
      acc[feat] = hasEntitlement(session.user, feat);
      return acc;
    }, {} as Record<FeatureEntitlement, boolean>);

    return NextResponse.json({
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        plan: session.user.plan,
        emailVerified: session.user.emailVerified,
        createdAt: session.user.createdAt,
      },
      entitlements,
    });
  } catch (error: unknown) {
    console.error("[API Error] Failed to retrieve user session:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Failed to fetch user state." },
      { status: 500 }
    );
  }
}
