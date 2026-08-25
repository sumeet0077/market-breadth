import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const publicPath = path.join(process.cwd(), "public", "market_breadth.json");
    if (!fs.existsSync(publicPath)) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: "market_breadth.json not found in public directory",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const fileContents = fs.readFileSync(publicPath, "utf8");
    const data = JSON.parse(fileContents);

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        {
          status: "unhealthy",
          error: "market_breadth.json is empty or invalid",
          timestamp: new Date().toISOString(),
        },
        { status: 500 }
      );
    }

    const d1 = data[0]?.Date;
    const d2 = data[data.length - 1]?.Date;
    const latestSession = d1 > d2 ? d1 : d2;
    const earliestSession = d1 < d2 ? d1 : d2;

    return NextResponse.json({
      status: "healthy",
      version: "2.0.0",
      total_sessions: data.length,
      latest_date: latestSession,
      earliest_date: earliestSession,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    return NextResponse.json(
      {
        status: "unhealthy",
        error: error.message || "Unknown health check error",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
