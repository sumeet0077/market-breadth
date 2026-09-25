import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // 1. Session verification
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required to access market breadth dataset.",
        },
        { status: 401 }
      );
    }

    // 2. Authorization / Entitlement verification
    if (!hasEntitlement(session.user, "view_breadth_heatmap")) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Active subscription plan does not entitle access to breadth data.",
        },
        { status: 403 }
      );
    }

    // 3. Load market breadth dataset
    let filePath = path.join(process.cwd(), "public", "market_breadth.json");
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), "..", "data", "market_breadth.json");
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Not Found", message: "Market breadth dataset not available." },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(fileContent);

    // Optional query parameter for limiting count or date filter
    const searchParams = request.nextUrl.searchParams;
    const limit = searchParams.get("limit");
    let result = data;
    if (limit) {
      const parsedLimit = parseInt(limit, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        result = data.slice(0, Math.min(parsedLimit, data.length));
      }
    }

    return NextResponse.json(result, {
      headers: {
        "Cache-Control": "private, max-age=300, stale-while-revalidate=86400",
      },
    });
  } catch (error: unknown) {
    console.error("[API Error] Failed to serve market breadth data:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Unable to retrieve breadth data." },
      { status: 500 }
    );
  }
}
