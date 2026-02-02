"use client"

import React, { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { cn } from '@/lib/utils';
import { ArrowUp, ArrowDown } from 'lucide-react';

export type MarketData = {
    Date: string;
    "No. of stocks up 4.5%+ in the current day": number;
    "No. of stocs down 4.5%+ in the current day": number;
    "No. of stocks up 20%+ in 5 days": number;
    "No. of stocks down 20%+ in 5 days": number;
    "No of stocks above 200 day SMA": number;
    "% Stocks > 200 SMA": number;
    "No of stocks above 50 day SMA": number;
    "No of stocks above 20 day SMA": number;
    "No of stocks which are positive": number;
    "No of stocks which are negative": number;
    "Advance/Decline Ratio": number;
    "Net New Highs": number;
    "Net New 52-Week Highs as % of Total Stocks": number;
    TotalTraded: number;
    [key: string]: any;
};

interface HeatmapProps {
    initialData: MarketData[];
    visibleColumns?: string[];
    showPercentages?: boolean;
}

export const METRIC_CONFIG: Record<string, { type: 'good' | 'bad' | 'diverging'; format: 'int' | 'float' | 'pct' }> = {
    "No. of stocks up 4.5%+ in the current day": { type: 'good', format: 'int' },
    "No. of stocs down 4.5%+ in the current day": { type: 'bad', format: 'int' },
    "No. of stocks up 20%+ in 5 days": { type: 'good', format: 'int' },
    "No. of stocks down 20%+ in 5 days": { type: 'bad', format: 'int' },
    "No of stocks above 200 day SMA": { type: 'good', format: 'int' },
    "% Stocks > 200 SMA": { type: 'good', format: 'pct' },
    "No of stocks above 50 day SMA": { type: 'good', format: 'int' },
    "No of stocks above 20 day SMA": { type: 'good', format: 'int' },
    "No of stocks which are positive": { type: 'good', format: 'int' },
    "No of stocks which are negative": { type: 'bad', format: 'int' },
    "Advance/Decline Ratio": { type: 'diverging', format: 'float' },
    "Net New Highs": { type: 'diverging', format: 'int' },
    "Net New 52-Week Highs as % of Total Stocks": { type: 'diverging', format: 'pct' },
};

export function Heatmap({ initialData, visibleColumns, showPercentages = false }: HeatmapProps) {
    const columnsToShow = visibleColumns || Object.keys(METRIC_CONFIG);
    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'Date', direction: 'desc' });

    // 1. Calculate Min/Max per column for scaling (based on current view)
    const scales = useMemo(() => {
        const s: Record<string, any> = {};
        Object.keys(METRIC_CONFIG).forEach((key) => {
            // Filter out nulls/undefined for scale calculation
            const values = initialData
                .map((d) => d[key] as number)
                .filter((v) => v !== null && v !== undefined && !isNaN(v));

            const min = values.length > 0 ? Math.min(...values) : 0;
            const max = values.length > 0 ? Math.max(...values) : 100;
            const type = METRIC_CONFIG[key].type;

            if (type === 'good') {
                s[key] = scaleLinear<string>().domain([min, max]).range(["#052e16", "#22c55e"]);
            } else if (type === 'bad') {
                s[key] = scaleLinear<string>().domain([min, max]).range(["#064e3b", "#ef4444"]);
            } else {
                s[key] = scaleLinear<string>().domain([min, (min + max) / 2, max]).range(["#ef4444", "#1e293b", "#22c55e"]);
            }
        });
        return s;
    }, [initialData]);

    // 2. Sort Data
    const sortedData = useMemo(() => {
        const sorted = [...initialData];
        sorted.sort((a, b) => {
            if (sortConfig.key === 'Date') {
                const dA = new Date(a.Date).getTime();
                const dB = new Date(b.Date).getTime();
                return sortConfig.direction === 'asc' ? dA - dB : dB - dA;
            }
            // Numeric Sort
            const valA = (a[sortConfig.key] as number) ?? -Infinity;
            const valB = (b[sortConfig.key] as number) ?? -Infinity;
            return sortConfig.direction === 'asc' ? valA - valB : valB - valA;
        });
        return sorted;
    }, [initialData, sortConfig]);

    const handleSort = (key: string) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'desc' ? 'asc' : 'desc'
        }));
    };

    return (
        <div className="w-full max-h-[80vh] overflow-y-auto overflow-x-auto border border-slate-800 rounded-lg shadow-2xl bg-slate-950">
            <table className="w-full text-sm text-left border-collapse relative">
                <thead className="text-xs uppercase bg-slate-900 text-slate-400 sticky top-0 z-30 shadow-md cursor-pointer select-none ring-1 ring-slate-800">
                    <tr>
                        <th
                            className="px-4 py-4 font-semibold tracking-wider border-b border-slate-800 min-w-[120px] hover:text-slate-200 transition-colors group sticky left-0 z-40 bg-slate-900 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]"
                            onClick={() => handleSort('Date')}
                        >
                            <div className="flex items-center gap-1">
                                Date
                                {sortConfig.key === 'Date' && (
                                    sortConfig.direction === 'desc' ? <ArrowDown className="w-3 h-3 text-blue-400" /> : <ArrowUp className="w-3 h-3 text-blue-400" />
                                )}
                            </div>
                        </th>
                        {columnsToShow.map((key) => (
                            <th
                                key={key}
                                className="px-2 py-4 font-semibold text-center border-b border-l border-slate-800 min-w-[100px] max-w-[140px] break-words hover:text-slate-200 transition-colors"
                                onClick={() => handleSort(key)}
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <span>{key}</span>
                                    {sortConfig.key === key && (
                                        sortConfig.direction === 'desc' ? <ArrowDown className="w-3 h-3 text-blue-400" /> : <ArrowUp className="w-3 h-3 text-blue-400" />
                                    )}
                                </div>
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                    {sortedData.map((row) => (
                        <tr key={row.Date} className="hover:bg-slate-900/50 transition-colors">
                            <td className="px-4 py-3 font-medium text-slate-300 whitespace-nowrap bg-slate-950 sticky left-0 z-20 border-r border-slate-800 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.5)]">
                                {new Date(row.Date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                            </td>
                            {columnsToShow.map((key) => {
                                const val = row[key] as number | null | undefined;
                                const conf = METRIC_CONFIG[key];

                                if (val === null || val === undefined || isNaN(val)) {
                                    return (
                                        <td key={`${row.Date}-${key}`} className="px-2 py-3 text-center text-slate-500 border-l border-slate-800/50 relative font-mono text-xs tabular-nums bg-slate-950/20">
                                            -
                                        </td>
                                    )
                                }
                                const bg = scales[key] ? scales[key](val) : "transparent";

                                let displayVal = val.toString();

                                // Logic: If converted to %, do (val / TotalTraded * 100).
                                // Applies if showPercentages is ON + format is 'int'.
                                // Exception: "Net New Highs"? User didn't explicitly exclude it, only Ratio and NetNew52W%.
                                // But Net New Highs (absolute) might be weird as %. Let's assume yes.

                                if (showPercentages && conf.format === 'int' && row.TotalTraded) {
                                    const pct = (val / row.TotalTraded) * 100;
                                    displayVal = `${pct.toFixed(1)}%`;
                                } else {
                                    if (conf.format === 'float') displayVal = val.toFixed(2);
                                    if (conf.format === 'pct') displayVal = `${val.toFixed(1)}%`;
                                    if (conf.format === 'int') displayVal = Math.round(val).toLocaleString();
                                }

                                return (
                                    <td
                                        key={`${row.Date}-${key}`}
                                        className="px-2 py-3 text-center text-slate-100 border-l border-slate-800/50 relative font-mono text-xs tabular-nums"
                                        style={{ backgroundColor: bg }}
                                    >
                                        <span className="relative z-10 drop-shadow-md">
                                            {displayVal}
                                        </span>
                                    </td>
                                );
                            })}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
