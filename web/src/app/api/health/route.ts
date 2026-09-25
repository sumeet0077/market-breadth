import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // 1. Check Database connectivity
    let dbStatus = "connected";
    let dbError: string | null = null;
    try {
      await db.execute(sql`SELECT 1 as healthy`);
    } catch (e: unknown) {
      dbStatus = "disconnected";
      dbError = e instanceof Error ? e.message : String(e);
    }

    // 2. Check Market Breadth datasets
    const publicPath = path.join(process.cwd(), "public", "market_breadth.json");
    let breadthFound = false;
    let totalSessions = 0;
    let latestDate = null;
    let earliestDate = null;

    if (fs.existsSync(publicPath)) {
      try {
        const fileContents = fs.readFileSync(publicPath, "utf8");
        const data = JSON.parse(fileContents);
        if (Array.isArray(data) && data.length > 0) {
          breadthFound = true;
          totalSessions = data.length;
          const d1 = data[0]?.Date;
          const d2 = data[data.length - 1]?.Date;
          latestDate = d1 > d2 ? d1 : d2;
          earliestDate = d1 < d2 ? d1 : d2;
        }
      } catch {
        // parsing error handled by fallback
      }
    }

    return NextResponse.json(
      {
        status: breadthFound ? "healthy" : "unhealthy",
        version: "2.1.0",
        total_sessions: totalSessions,
        latest_date: latestDate,
        earliest_date: earliestDate,
        database: {
          status: dbStatus,
          configured: Boolean(process.env.DATABASE_URL),
          error: dbError,
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : "Unknown health check error";
    return NextResponse.json(
      {
        status: "unhealthy",
        error: errorMsg,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
