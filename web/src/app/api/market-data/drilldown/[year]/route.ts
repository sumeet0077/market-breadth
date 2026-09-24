import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ year: string }> }
) {
  try {
    // 1. Session verification
    const session = await auth.api.getSession({ headers: request.headers });

    if (!session || !session.user) {
      return NextResponse.json(
        {
          error: "Unauthorized",
          message: "Authentication required to access market drilldown data.",
        },
        { status: 401 }
      );
    }

    // 2. Authorization / Entitlement verification
    if (!hasEntitlement(session.user, "view_drilldowns")) {
      return NextResponse.json(
        {
          error: "Forbidden",
          message: "Active subscription plan does not entitle access to historical drilldowns.",
        },
        { status: 403 }
      );
    }

    // 3. Input validation: strict 4-digit year format within realistic historical boundaries
    const { year } = await context.params;
    if (!/^\d{4}$/.test(year)) {
      return NextResponse.json(
        { error: "Bad Request", message: "Invalid year parameter format." },
        { status: 400 }
      );
    }
    const numYear = parseInt(year, 10);
    if (numYear < 1990 || numYear > 2050) {
      return NextResponse.json(
        { error: "Bad Request", message: "Year parameter out of supported historical range (1990-2050)." },
        { status: 400 }
      );
    }

    // 4. Secure file retrieval from public/drilldowns or data/drilldowns
    let filePath = path.join(process.cwd(), "public", "drilldowns", `${year}.json`);
    if (!fs.existsSync(filePath)) {
      filePath = path.join(process.cwd(), "..", "data", "drilldowns", `${year}.json`);
    }

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: "Not Found", message: `Drilldown data for year ${year} not found.` },
        { status: 404 }
      );
    }

    const fileContent = fs.readFileSync(filePath, "utf-8");
    const parsedData = JSON.parse(fileContent);

    return NextResponse.json(parsedData, {
      headers: {
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (error: unknown) {
    console.error("[API Error] Failed to serve drilldown data:", error);
    return NextResponse.json(
      { error: "Internal Server Error", message: "Unable to retrieve drilldown data." },
      { status: 500 }
    );
  }
}
