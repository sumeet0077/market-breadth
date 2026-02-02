import { MarketData } from "@/components/Heatmap";
import { ChartsView } from "@/components/ChartsView";
import fs from 'fs';
import path from 'path';

export const metadata = {
    title: 'Market Breadth Charts',
    description: 'Visualizing market breadth trends over time.',
}

export default async function ChartsPage() {
    // Load Data (Same logic as main page)
    let data: MarketData[] = [];
    try {
        const publicPath = path.join(process.cwd(), 'public', 'market_breadth.json');
        const fileContents = fs.readFileSync(publicPath, 'utf8');
        data = JSON.parse(fileContents);
    } catch (error) {
        console.error("Failed to load metrics:", error);
        data = [];
    }

    return (
        <main className="min-h-screen p-4 md:p-8 space-y-8 max-w-[1800px] mx-auto">
            <header className="space-y-2">
                <h1 className="text-3xl md:text-5xl font-bold tracking-tight bg-gradient-to-r from-blue-400 to-indigo-500 bg-clip-text text-transparent">
                    Market Breadth Charts
                </h1>
                <p className="text-slate-400 max-w-2xl text-lg">
                    Visualizing trends across key market indicators.
                </p>
            </header>

            <ChartsView initialData={data} />
        </main>
    );
}
