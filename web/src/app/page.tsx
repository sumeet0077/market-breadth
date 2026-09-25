import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { MarketData } from "@/components/Heatmap";
import { DashboardClient } from "@/components/DashboardClient";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// In-memory cache per serverless container: eliminates repeated disk I/O and JSON.parse on every refresh
let cachedData: MarketData[] | null = null;
let lastCacheTime = 0;
const CACHE_TTL_MS = 60 * 1000; // 60s cache

function getSortedMarketData(): MarketData[] {
  const now = Date.now();
  if (cachedData && now - lastCacheTime < CACHE_TTL_MS) {
    return cachedData;
  }

  try {
    const publicPath = path.join(process.cwd(), "public", "market_breadth.json");
    if (fs.existsSync(publicPath)) {
      const fileContents = fs.readFileSync(publicPath, "utf8");
      const data: MarketData[] = JSON.parse(fileContents);
      cachedData = data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());
      lastCacheTime = now;
      return cachedData;
    }
  } catch (error) {
    console.error("Failed to load metrics:", error);
  }

  return cachedData || [];
}

// Server Component (Renders once on build/request with authentication enforcement)
export default async function Home() {
  const reqHeaders = await headers();
  const session = await auth.api.getSession({ headers: reqHeaders });

  if (!session || !session.user) {
    redirect("/login?error=session_expired");
  }

  const sortedData = getSortedMarketData();

  return (
    <main className="min-h-screen p-3 md:p-6 space-y-6 max-w-[1880px] mx-auto">
      <DashboardClient initialData={sortedData} user={session.user} />
    </main>
  );
}
