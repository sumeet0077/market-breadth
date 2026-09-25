import { MarketData } from "@/components/Heatmap";
import { DashboardClient } from "@/components/DashboardClient";
import fs from "fs";
import path from "path";

export const metadata = {
  title: "QuantBreadth™ Charts Studio | Institutional Market Breadth",
  description: "Visualizing historical market breadth trends over time.",
};

// Server Component (Pre-rendered statically at build time, protected at Edge by proxy.ts)
export default function ChartsPage() {
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

  return (
    <main className="min-h-screen p-3 md:p-6 space-y-6 max-w-[1880px] mx-auto">
      <DashboardClient initialData={data} initialTab="charts" />
    </main>
  );
}
