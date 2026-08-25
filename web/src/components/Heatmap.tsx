"use client"

import React, { useMemo, useState } from 'react';
import { scaleLinear } from 'd3-scale';
import { ArrowUp, ArrowDown } from 'lucide-react';
import { DrilldownCategory } from './DrilldownModal';

export type MarketData = {
    Date: string;
    "No. of stocks up 4.5%+ in the current day": number;
    "No. of stocks down 4.5%+ in the current day": number;
    "No. of stocks up 20%+ in 5 days": number;
    "No. of stocks down 20%+ in 5 days": number;
    "No of stocks above 200 day SMA": number;
    "No of stocks above 50 day SMA": number;
    "No of stocks above 20 day SMA": number;
    "No of stocks above all 3 SMAs": number;
    "No of stocks which are positive": number;
    "No of stocks which are negative": number;
    "Advance/Decline Ratio": number;
    "Net New Highs": number;
    TotalTraded: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
};

export const DRILLDOWN_METRICS: Record<string, DrilldownCategory> = {
    "No. of stocks up 4.5%+ in the current day": "up45",
    "No. of stocks down 4.5%+ in the current day": "down45",
    "No. of stocks up 20%+ in 5 days": "up20_5d",
    "No. of stocks down 20%+ in 5 days": "down20_5d",
    "Net New Highs": "net_new_highs",
};

interface HeatmapProps {
    initialData: MarketData[];
    selectedMetrics: string[];
    showPercentages?: boolean;
    onCellClick?: (date: string, category: DrilldownCategory) => void;
    onDateClick?: (date: string) => void;
    activeDate?: string | null;
}

export const DISPLAY_HEADERS: Record<string, { short: string; sub?: string }> = {
    "No. of stocks up 4.5%+ in the current day": { short: "Up 4.5%", sub: "1D" },
    "No. of stocks down 4.5%+ in the current day": { short: "Down 4.5%", sub: "1D" },
    "No. of stocks up 20%+ in 5 days": { short: "Up 20%", sub: "5D" },
    "No. of stocks down 20%+ in 5 days": { short: "Down 20%", sub: "5D" },
    "No of stocks above 200 day SMA": { short: "> 200 SMA" },
    "No of stocks above 50 day SMA": { short: "> 50 SMA" },
    "No of stocks above 20 day SMA": { short: "> 20 SMA" },
    "No of stocks above all 3 SMAs": { short: "> All 3 SMA" },
    "No of stocks which are positive": { short: "Advancing" },
    "No of stocks which are negative": { short: "Declining" },
    "Advance/Decline Ratio": { short: "A/D Ratio" },
    "Net New Highs": { short: "Net 52W Highs" },
};

export const METRIC_CONFIG: Record<string, { type: 'good' | 'bad' | 'diverging'; format: 'int' | 'float' | 'pct' }> = {
    "No. of stocks up 4.5%+ in the current day": { type: 'good', format: 'int' },
    "No. of stocks down 4.5%+ in the current day": { type: 'bad', format: 'int' },
    "No. of stocks up 20%+ in 5 days": { type: 'good', format: 'int' },
    "No. of stocks down 20%+ in 5 days": { type: 'bad', format: 'int' },
    "No of stocks above 200 day SMA": { type: 'good', format: 'int' },
    "No of stocks above 50 day SMA": { type: 'good', format: 'int' },
    "No of stocks above 20 day SMA": { type: 'good', format: 'int' },
    "No of stocks above all 3 SMAs": { type: 'good', format: 'int' },
    "No of stocks which are positive": { type: 'good', format: 'int' },
    "No of stocks which are negative": { type: 'bad', format: 'int' },
    "Advance/Decline Ratio": { type: 'diverging', format: 'float' },
    "Net New Highs": { type: 'diverging', format: 'int' },
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatRowDate(dateStr: string): string {
    if (!dateStr) return '';
    const parts = dateStr.split('-');
    if (parts.length === 3) {
        const year = parts[0].slice(2);
        const monthIdx = parseInt(parts[1], 10) - 1;
        const day = parts[2];
        const month = MONTH_NAMES[monthIdx] || parts[1];
        return `${day} ${month} ${year}`;
    }
    return dateStr;
}

export function Heatmap({ 
    initialData, 
    selectedMetrics, 
    showPercentages = false, 
    onCellClick,
    onDateClick,
    activeDate = null
}: HeatmapProps) {
    const columnsToShow = selectedMetrics || Object.keys(METRIC_CONFIG);
    // Sort State
    const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'Date', direction: 'desc' });

    // 1. Calculate Min/Max per column for scaling (based on current view)
    const scales = useMemo(() => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const s: Record<string, any> = {};
        Object.keys(METRIC_CONFIG).forEach((key) => {
            // Filter out nulls/undefined for scale calculation
            const values = initialData
                .map((d) => d[key] as number)
                .filter((v) => v !== null && v !== undefined && !isNaN(v));

            const min = values.length > 0 ? Math.min(...values) : 0;
            const max = values.length > 0 ? Math.max(...values) : 100;
            const config = METRIC_CONFIG[key];

            if (!config) return;

            // Local Dynamic Scaling - every cell always has a visible color tint
            if (key === "Advance/Decline Ratio") {
                // Diverging around 1.0: below 1 = always red, above 1 = always green
                const minVal = Math.min(min, 0.99);
                const maxVal = Math.max(max, 1.01);
                s[key] = scaleLinear<string>()
                    .domain([minVal, 0.999, 1.001, maxVal])
                    .range([
                        'rgba(239, 68, 68, 0.85)',
                        'rgba(239, 68, 68, 0.15)',
                        'rgba(34, 197, 94, 0.15)',
                        'rgba(34, 197, 94, 0.85)'
                    ]);
            } else if (key === "Net New Highs") {
                // Diverging around 0: negative = always red, positive = always green
                // Use actual min/max (asymmetric) so each side scales to its own data range
                const minVal = Math.min(min, -0.01);
                const maxVal = Math.max(max, 0.01);
                s[key] = scaleLinear<string>()
                    .domain([minVal, -0.001, 0.001, maxVal])
                    .range([
                        'rgba(239, 68, 68, 0.85)',
                        'rgba(239, 68, 68, 0.15)',
                        'rgba(34, 197, 94, 0.15)',
                        'rgba(34, 197, 94, 0.85)'
                    ]);
            } else if (config.type === 'good') {
                // Bullish metrics (Up 4.5%, Up 20%, SMAs, Advancing)
                s[key] = scaleLinear<string>()
                    .domain([min, (min + max) / 2, max])
                    .range(['rgba(34, 197, 94, 0.12)', 'rgba(34, 197, 94, 0.45)', 'rgba(34, 197, 94, 0.85)']);
            } else if (config.type === 'bad') {
                // Bearish metrics (Down 4.5%, Down 20%, Declining)
                s[key] = scaleLinear<string>()
                    .domain([min, (min + max) / 2, max])
                    .range(['rgba(239, 68, 68, 0.12)', 'rgba(239, 68, 68, 0.45)', 'rgba(239, 68, 68, 0.85)']);
            }
        });
        return s;
    }, [initialData]);

    // 2. Sort Data
    const sortedData = useMemo(() => {
        const sorted = [...initialData].sort((a, b) => {
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
        <div className="w-full max-h-[82vh] overflow-y-auto overflow-x-auto border border-slate-800/80 rounded-xl shadow-2xl bg-slate-950 [contain:paint]">
            <table className="w-full text-xs text-left border-collapse relative table-fixed">
                <thead className="text-[11px] uppercase bg-slate-900 text-slate-400 sticky top-0 z-30 shadow-md select-none border-b border-slate-800">
                    <tr>
                        <th
                            className="px-3 py-3 font-bold tracking-wider border-b border-slate-800 w-24 min-w-[90px] text-center hover:text-slate-200 group sticky left-0 z-40 bg-slate-900 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.6)] cursor-pointer"
                            onClick={() => handleSort('Date')}
                            title="Sort by Date"
                        >
                            <div className="flex items-center justify-center gap-1">
                                <span>Date</span>
                                {sortConfig.key === 'Date' && (
                                    sortConfig.direction === 'desc' ? <ArrowDown className="w-3 h-3 text-blue-400" /> : <ArrowUp className="w-3 h-3 text-blue-400" />
                                )}
                            </div>
                        </th>
                        {columnsToShow.map((key) => {
                            const headerInfo = DISPLAY_HEADERS[key] || { short: key };
                            return (
                                <th
                                    key={key}
                                    className="px-2 py-3 font-semibold text-center border-b border-l border-slate-800/60 hover:text-slate-200 cursor-pointer select-none"
                                    onClick={() => handleSort(key)}
                                    title={key}
                                >
                                    <div className="flex flex-col items-center justify-center gap-0.5">
                                        <span className="whitespace-nowrap font-semibold text-slate-200 tracking-tight">
                                            {headerInfo.short}
                                        </span>
                                        {headerInfo.sub && (
                                            <span className="text-[9px] text-slate-500 font-mono font-medium">
                                                {headerInfo.sub}
                                            </span>
                                        )}
                                        {sortConfig.key === key && (
                                            sortConfig.direction === 'desc' ? <ArrowDown className="w-2.5 h-2.5 text-blue-400 mt-0.5" /> : <ArrowUp className="w-2.5 h-2.5 text-blue-400 mt-0.5" />
                                        )}
                                    </div>
                                </th>
                            );
                        })}
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/40 font-mono">
                    {sortedData.map((row) => {
                        const isInspected = activeDate === row.Date;

                        return (
                            <tr 
                                key={row.Date} 
                                className={isInspected ? 'bg-blue-950/50 ring-1 ring-inset ring-blue-500/50' : 'hover:bg-slate-900/40'}
                                style={{ contentVisibility: 'auto', containIntrinsicSize: '34px' }}
                            >
                                <td 
                                    onClick={() => onDateClick?.(row.Date)}
                                    className={`px-2.5 py-2 font-medium whitespace-nowrap sticky left-0 z-20 border-r text-center text-[11px] md:text-xs cursor-pointer ${
                                        isInspected
                                            ? 'bg-blue-900 text-white font-bold border-r-2 border-r-blue-400 shadow-[2px_0_12px_rgba(59,130,246,0.6)]'
                                            : 'bg-slate-950 text-slate-300 hover:text-blue-400 hover:bg-slate-900 border-slate-800 shadow-[2px_0_6px_-2px_rgba(0,0,0,0.6)]'
                                    }`}
                                    title={`Click to inspect Macro & Swing view as of ${row.Date}`}
                                >
                                    <div className="flex items-center justify-center gap-1.5">
                                        <span>{formatRowDate(row.Date)}</span>
                                        {/* Signal Indicator Badges */}
                                        {Boolean(
                                            row.Bullseye_Buy_Signal ||
                                            row.Bull_NNH_Buy ||
                                            row.Bull_200SMA_Buy ||
                                            row.Bull_AllSMA_Buy ||
                                            row["Advance/Decline Ratio"] >= 3.0
                                        ) && (
                                            <span className="text-[10px] text-amber-300" title="⚡ Major Breadth Thrust Session">
                                                ⚡
                                            </span>
                                        )}
                                        {Boolean(
                                            (row["Advance/Decline Ratio"] <= 0.18) ||
                                            (row["No. of stocks down 4.5%+ in the current day"] && row.TotalTraded && (row["No. of stocks down 4.5%+ in the current day"] / row.TotalTraded) >= 0.20)
                                        ) && (
                                            <span className="text-[10px] text-rose-400" title="🚨 Panic Capitulation Session">
                                                🚨
                                            </span>
                                        )}
                                        {isInspected && <span className="w-1.5 h-1.5 rounded-full bg-cyan-300 shrink-0" />}
                                    </div>
                                </td>
                                {columnsToShow.map((key) => {
                                    const val = row[key] as number | null | undefined;
                                    const conf = METRIC_CONFIG[key];

                                    if (val === null || val === undefined || isNaN(val)) {
                                        return (
                                            <td key={`${row.Date}-${key}`} className="px-2 py-2 text-center text-slate-600 border-l border-slate-800/40 font-mono text-[11px] md:text-xs tabular-nums bg-slate-950/40">
                                                -
                                            </td>
                                        );
                                    }
                                    const bg = scales[key] ? scales[key](val) : "transparent";

                                    let displayVal = val.toString();

                                    if (showPercentages && conf.format === 'int' && row.TotalTraded) {
                                        const pct = (val / row.TotalTraded) * 100;
                                        displayVal = `${pct.toFixed(1)}%`;
                                    } else {
                                        if (conf.format === 'float') displayVal = val.toFixed(2);
                                        if (conf.format === 'pct') displayVal = `${val.toFixed(1)}%`;
                                        if (conf.format === 'int') displayVal = Math.round(val).toLocaleString();
                                    }

                                    const drilldownCategory = DRILLDOWN_METRICS[key];
                                    const isClickable = Boolean(drilldownCategory && onCellClick);

                                    return (
                                        <td
                                            key={`${row.Date}-${key}`}
                                            onClick={() => {
                                                if (isClickable) onCellClick?.(row.Date, drilldownCategory!);
                                            }}
                                            className={`px-2 py-2 text-center text-slate-100 border-l border-slate-800/40 font-mono text-[11px] md:text-xs tabular-nums relative ${
                                                isClickable 
                                                    ? 'cursor-pointer hover:brightness-125 hover:ring-1 hover:ring-blue-400/80 hover:z-20' 
                                                    : ''
                                            }`}
                                            style={{ backgroundColor: bg }}
                                            title={isClickable ? `Click to inspect individual stocks for ${key} (${row.Date})` : `${key}: ${displayVal} (${row.Date})`}
                                        >
                                            <span className="relative z-10 font-medium">
                                                {displayVal}
                                            </span>
                                        </td>
                                    );
                                })}
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}
