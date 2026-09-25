import { MarketData } from "@/components/Heatmap";
import { DashboardClient } from "@/components/DashboardClient";
import fs from "fs";
import path from "path";

// Server Component (Pre-rendered statically at build time, protected at Edge by proxy.ts)
export default function Home() {
  let data: MarketData[] = [];
  try {
    const publicPath = path.join(process.cwd(), "public", "market_breadth.json");
    if (fs.existsSync(publicPath)) {
      const fileContents = fs.readFileSync(publicPath, "utf8");
      data = JSON.parse(fileContents);
    }
  } catch (error) {
    console.error("Failed to load metrics:", error);
    data = [];
  }

  const sortedData = data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

  return (
    <main className="min-h-screen p-3 md:p-6 space-y-6 max-w-[1880px] mx-auto">
      <DashboardClient initialData={sortedData} />
    </main>
  );
}
