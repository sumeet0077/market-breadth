"use client"

import React, { useState, useMemo } from 'react';
import { MarketData } from '@/components/Heatmap';
import { Heatmap } from './Heatmap';
import { ArrowUp, ArrowDown, Calendar, Search } from 'lucide-react';

interface DashboardClientProps {
    initialData: any[]; // Using any[] to map to generic MarketData structure 
}

export function DashboardClient({ initialData }: DashboardClientProps) {
    // 1. State: Date Range
    // find min/max dates
    const sortedByDate = useMemo(() =>
        [...initialData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()),
        [initialData]);

    const maxDate = sortedByDate[0]?.Date || new Date().toISOString().split('T')[0];
    const minDate = sortedByDate[sortedByDate.length - 1]?.Date || "2022-01-01";

    // Default: Last 30 days or Max range if small
    const defaultStart = new Date(new Date(maxDate).getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(maxDate);

    // Reset Handler
    const handleReset = () => {
        setStartDate(minDate);
        setEndDate(maxDate);
    }

    // 2. Filter Data
    const filteredData = useMemo(() => {
        const s = new Date(startDate).getTime();
        const e = new Date(endDate).getTime();

        // Handle potential swap or invalid partial entry fluidly
        const effectiveStart = Math.min(s, e);
        const effectiveEnd = Math.max(s, e);

        return initialData.filter(d => {
            const t = new Date(d.Date).getTime();
            return t >= effectiveStart && t <= effectiveEnd;
        });
    }, [initialData, startDate, endDate]);

    // 3. Derived KPI Logic
    const sortedFiltered = useMemo(() =>
        [...filteredData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
        , [filteredData]);

    const latestView = sortedFiltered[0];
    const prevView = sortedFiltered[1] || latestView;

    // KPI Calculations
    const kpiAbove200Pct = latestView ? (latestView["No of stocks above 200 day simple moving average"] / latestView["TotalTraded"] * 100) : 0;
    const kpiAbove200PctPrev = prevView ? (prevView["No of stocks above 200 day simple moving average"] / prevView["TotalTraded"] * 100) : 0;

    return (
        <div className="space-y-8">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm sticky top-4 z-20 shadow-xl">
                <div className="flex items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400 uppercase font-semibold">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            min={minDate}
                            max={maxDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            onClick={(e) => e.currentTarget.showPicker()}
                            className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none w-40 cursor-pointer"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-xs text-slate-400 uppercase font-semibold">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            min={minDate}
                            max={maxDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            onClick={(e) => e.currentTarget.showPicker()}
                            className="bg-slate-950 border border-slate-800 rounded px-3 py-2 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none w-40 cursor-pointer"
                        />
                    </div>
                    <button
                        onClick={handleReset}
                        className="mt-5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded transition-colors flex items-center gap-2"
                    >
                        <Calendar className="w-4 h-4" /> Reset View
                    </button>
                </div>
                <div className="text-xs text-slate-500 font-mono">
                    Showing {filteredData.length} records
                </div>
            </div>

            {/* KPI Stats Grid - UPDATED with Requested Metrics */}
            {latestView && (
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. Stocks > 200 SMA % */}
                    <KpiCard
                        label="Stocks > 200 SMA"
                        value={`${kpiAbove200Pct.toFixed(1)}%`}
                        subValue={`(${latestView["No of stocks above 200 day simple moving average"]} / ${latestView["TotalTraded"]})`}
                        delta={(kpiAbove200Pct - kpiAbove200PctPrev).toFixed(1) + "%"}
                        isGood={true}
                    />

                    {/* 2. Advance / Decline Ratio */}
                    <KpiCard
                        label="Advance/Decline Ratio"
                        value={latestView["Advance/Decline Ratio"].toFixed(2)}
                        delta={(latestView["Advance/Decline Ratio"] - prevView["Advance/Decline Ratio"]).toFixed(2)}
                        isGood={latestView["Advance/Decline Ratio"] > 1}
                    />

                    {/* 3. Net New 52W Highs % */}
                    <KpiCard
                        label="Net New Highs (as %)"
                        value={`${latestView["Net New 52-Week Highs as % of Total Stocks"].toFixed(2)}%`}
                        delta={(latestView["Net New 52-Week Highs as % of Total Stocks"] - prevView["Net New 52-Week Highs as % of Total Stocks"]).toFixed(2) + "%"}
                        isGood={latestView["Net New 52-Week Highs as % of Total Stocks"] > 0}
                    />
                </section>
            )}

            {/* Main Heatmap */}
            <section className="space-y-4">
                <Heatmap initialData={filteredData} />
            </section>
        </div>
    );
}

function KpiCard({ label, value, subValue, delta, isGood }: { label: string, value: string, subValue?: string, delta: string, isGood: boolean }) {
    const deltaNum = parseFloat(delta);
    const deltaColor = deltaNum > 0 ? "text-green-400" : deltaNum < 0 ? "text-red-400" : "text-slate-500";
    const icon = deltaNum > 0 ? "↑" : deltaNum < 0 ? "↓" : "−";

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-lg hover:border-slate-700 transition-all">
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">{label}</h3>
            <div className="mt-2 flex items-baseline gap-3">
                <span className="text-4xl font-bold text-slate-50">{value}</span>
                <span className={`text-sm font-medium ${deltaColor} flex items-center bg-slate-950 px-2 py-1 rounded-full`}>
                    {icon} {Math.abs(deltaNum) || deltaNum}
                </span>
            </div>
            {subValue && (
                <div className="mt-1 text-xs text-slate-500 font-mono">
                    {subValue}
                </div>
            )}
        </div>
    )
}
