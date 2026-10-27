import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth/auth";
import { MarketData } from "@/components/Heatmap";
import { DashboardClient } from "@/components/DashboardClient";
import fs from "fs";
import path from "path";

export const metadata = {
  title: "QuantBreadth™ Charts Studio | Institutional Market Breadth",
  description: "Visualizing historical market breadth trends over time.",
};

// Server Component with cryptographic server-side session validation
export default async function ChartsPage() {
  const reqHeaders = await headers();
  const isDemo =
    reqHeaders.get("x-is-demo") === "true" ||
    process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  if (!isDemo) {
    const session = await auth.api.getSession({ headers: reqHeaders });
    if (!session || !session.user) {
      redirect("/login?callbackUrl=/charts");
    }
  }

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
  const initialSlice = sortedData.slice(0, 300);

  return (
    <main className="min-h-screen p-3 md:p-6 space-y-6 max-w-[1880px] mx-auto">
      <DashboardClient initialData={initialSlice} initialTab="charts" />
    </main>
  );
}
