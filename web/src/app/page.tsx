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
    <main className="min-h-screen p-3 md:p-6 space-y-6 max-w-[1880px] mx-auto">
      <DashboardClient initialData={sortedData} />
    </main>
  );
}
