import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * Validates authorization against CRON_SECRET.
 * Supports:
 * - Authorization: Bearer <CRON_SECRET>
 * - x-cron-secret: <CRON_SECRET>
 * - Query parameter: ?secret=<CRON_SECRET>
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;

  // If CRON_SECRET is not configured in environment, allow in local development only
  if (!cronSecret) {
    return process.env.NODE_ENV === "development";
  }

  // 1. Check Bearer token
  const authHeader = request.headers.get("authorization");
  if (authHeader) {
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (token === cronSecret) {
      return true;
    }
  }

  // 2. Check custom header
  const customHeader = request.headers.get("x-cron-secret");
  if (customHeader && customHeader.trim() === cronSecret) {
    return true;
  }

  // 3. Check query param ?secret=...
  const url = new URL(request.url);
  if (url.searchParams.get("secret") === cronSecret) {
    return true;
  }

  return false;
}

/**
 * Checks if today's market breadth data is already ingested and published in public/market_breadth.json.
 */
function isTodayAlreadyUpdated(targetDateStr: string): boolean {
  const publicPath = path.join(process.cwd(), "public", "market_breadth.json");
  if (!fs.existsSync(publicPath)) {
    return false;
  }
  try {
    const fileContents = fs.readFileSync(publicPath, "utf8");
    const data = JSON.parse(fileContents);
    if (Array.isArray(data) && data.length > 0) {
      const lastSession = data[data.length - 1];
      const firstSession = data[0];
      const latestDate =
        (lastSession?.Date || "") > (firstSession?.Date || "")
          ? lastSession?.Date
          : firstSession?.Date;
      return latestDate === targetDateStr;
    }
  } catch {
    return false;
  }
  return false;
}

/**
 * Checks whether NSE has published today's bhavcopy on its public archives.
 * e.g. https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_DDMMYYYY.csv
 */
async function checkNSEBhavcopyAvailable(day: string, month: string, year: string): Promise<boolean> {
  const nseUrl = `https://nsearchives.nseindia.com/products/content/sec_bhavdata_full_${day}${month}${year}.csv`;
  try {
    const res = await fetch(nseUrl, {
      method: "HEAD",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        Accept: "*/*",
      },
      signal: AbortSignal.timeout(6000),
    });
    return res.status === 200;
  } catch {
    // If HEAD fails due to CDN/firewall, try a lightweight GET with Range header
    try {
      const getRes = await fetch(nseUrl, {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
          Range: "bytes=0-100",
        },
        signal: AbortSignal.timeout(6000),
      });
      return getRes.status === 200 || getRes.status === 206;
    } catch {
      return false;
    }
  }
}

async function handleCronSync(request: NextRequest) {
  // 1. Authorize caller
  if (!isAuthorized(request)) {
    return NextResponse.json(
      {
        error: "Unauthorized",
        message: "Invalid or missing CRON_SECRET authorization token.",
      },
      { status: 401 }
    );
  }

  const url = new URL(request.url);
  const force = url.searchParams.get("force") === "true";

  // 2. Compute current date in Asia/Kolkata (IST)
  const istFormatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    weekday: "short",
  });

  const parts = istFormatter.formatToParts(new Date());
  const day = parts.find((p) => p.type === "day")?.value || "";
  const month = parts.find((p) => p.type === "month")?.value || "";
  const year = parts.find((p) => p.type === "year")?.value || "";
  const weekday = parts.find((p) => p.type === "weekday")?.value || "";

  const todayIST = `${year}-${month}-${day}`; // YYYY-MM-DD
  const isWeekend = weekday === "Sat" || weekday === "Sun";

  if (isWeekend && !force) {
    return NextResponse.json(
      {
        status: "skipped",
        reason: `Weekend (${weekday}) — NSE is closed.`,
        date: todayIST,
      },
      { status: 200 }
    );
  }

  // 3. Check if today's data is already updated
  if (!force && isTodayAlreadyUpdated(todayIST)) {
    return NextResponse.json(
      {
        status: "already_up_to_date",
        message: `Market breadth is already up-to-date for ${todayIST}.`,
        date: todayIST,
      },
      { status: 200 }
    );
  }

  // 4. Check if NSE Bhavcopy is available on NSE archives
  if (!force) {
    const isBhavcopyLive = await checkNSEBhavcopyAvailable(day, month, year);
    if (!isBhavcopyLive) {
      return NextResponse.json(
        {
          status: "waiting_for_nse",
          message: `Bhavcopy for ${todayIST} has not been published on NSE archives yet. Will retry on next schedule.`,
          date: todayIST,
        },
        { status: 200 }
      );
    }
  }

  // 5. Trigger GitHub Actions repository_dispatch
  const ghToken = process.env.GITHUB_DISPATCH_TOKEN || process.env.GITHUB_TOKEN;
  const repoOwner = process.env.GITHUB_REPO_OWNER || "sumeet0077";
  const repoName = process.env.GITHUB_REPO_NAME || "market-breadth";

  if (!ghToken) {
    return NextResponse.json(
      {
        error: "Configuration Error",
        message:
          "GITHUB_DISPATCH_TOKEN is not configured in Vercel environment variables. Please add GITHUB_DISPATCH_TOKEN with repo/actions write scope.",
        date: todayIST,
      },
      { status: 500 }
    );
  }

  try {
    const dispatchUrl = `https://api.github.com/repos/${repoOwner}/${repoName}/dispatches`;
    const dispatchRes = await fetch(dispatchUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ghToken}`,
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "MarketBreadth-SyncCron/1.0",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: "daily_data_update",
        client_payload: {
          triggered_by: "api_cron_sync",
          target_date: todayIST,
          forced: force,
          timestamp: new Date().toISOString(),
        },
      }),
    });

    if (dispatchRes.status === 204) {
      return NextResponse.json(
        {
          status: "dispatched",
          message: `Successfully dispatched GitHub Actions update workflow for ${todayIST}.`,
          date: todayIST,
          dispatched_at: new Date().toISOString(),
        },
        { status: 200 }
      );
    } else {
      const errText = await dispatchRes.text();
      return NextResponse.json(
        {
          error: "GitHub Dispatch Failed",
          status_code: dispatchRes.status,
          details: errText,
          date: todayIST,
        },
        { status: 502 }
      );
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: "Dispatch Network Error",
        message: errMsg,
        date: todayIST,
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  return handleCronSync(request);
}

export async function POST(request: NextRequest) {
  return handleCronSync(request);
}
