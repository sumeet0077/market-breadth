import { MarketData } from "@/components/Heatmap";
import { DashboardClient } from "@/components/DashboardClient";
import fs from 'fs';
import path from 'path';

// Server Component (Renders once on build/request)
export default async function Home() {
  // Load Data
  let data: MarketData[] = [];
  try {
    // In production (Vercel), process.cwd() is the root.
    // Local: 'web/' is root if running npm run dev from there?
    // Let's assume standard behavior. 'public' folder data is accessible via URL if client-side, 
    // but for Server Component usage, we read file system.
    // Wait, Vercel file system can be tricky.
    // Best practice: Import it if it's inside src, or read from public.
    // Since we copied it to public/, let's try reading from there.

    // Robust path finding
    const publicPath = path.join(process.cwd(), 'public', 'market_breadth.json');
    const fileContents = fs.readFileSync(publicPath, 'utf8');
    data = JSON.parse(fileContents);
  } catch (error) {
    console.error("Failed to load metrics:", error);
    // Fallback or empty
    data = [];
  }

  // Sort descending by Date for initial view
  const sortedData = data.sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime());

  return (
    <main className="min-h-screen p-4 md:p-8 space-y-8 max-w-[1800px] mx-auto">
      {/* Header */}
      <header className="space-y-2">
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-green-400 to-blue-500 bg-clip-text text-transparent">
          Market Breadth Dashboard
        </h1>
        <p className="text-slate-400 max-w-2xl text-lg">
          Tracking internal market strength across NSE stocks.
        </p>
      </header>

      <DashboardClient initialData={sortedData} />
    </main>
  );
}
