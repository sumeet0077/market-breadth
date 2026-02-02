"use client"

import React, { useState, useMemo } from 'react';
import { MarketData, METRIC_CONFIG } from '@/components/Heatmap';
import { Heatmap } from './Heatmap';
import { ArrowUp, ArrowDown, Calendar, Search, Settings, Check, LineChart } from 'lucide-react';
import Link from 'next/link';

interface DashboardClientProps {
    initialData: any[];
}

export function DashboardClient({ initialData }: DashboardClientProps) {
    // 1. State: Date Range
    const sortedByDate = useMemo(() =>
        [...initialData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()),
        [initialData]);

    const maxDate = sortedByDate[0]?.Date || new Date().toISOString().split('T')[0];
    const minDate = sortedByDate[sortedByDate.length - 1]?.Date || "2022-01-01";
    const defaultStart = new Date(new Date(maxDate).getTime() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(maxDate);

    // Column Visibility State
    const allMetrics = Object.keys(METRIC_CONFIG);
    const [selectedMetrics, setSelectedMetrics] = useState<string[]>(allMetrics);
    const [showPercentages, setShowPercentages] = useState(false);
    const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

    // Reset Handler
    const handleReset = () => {
        setStartDate(minDate);
        setEndDate(maxDate);
        setSelectedMetrics(allMetrics);
    }

    const toggleMetric = (metric: string) => {
        setSelectedMetrics(prev =>
            prev.includes(metric) ? prev.filter(m => m !== metric) : [...prev, metric]
        );
    };

    // 2. Filter Data
    const filteredData = useMemo(() => {
        const s = new Date(startDate).getTime();
        const e = new Date(endDate).getTime();
        const effectiveStart = Math.min(s, e);
        const effectiveEnd = Math.max(s, e);

        return initialData.filter(d => {
            const t = new Date(d.Date).getTime();
            return t >= effectiveStart && t <= effectiveEnd;
        });
    }, [initialData, startDate, endDate]);

    // 3. Derived KPI Logic (Schema Updated)
    const sortedFiltered = useMemo(() =>
        [...filteredData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime())
        , [filteredData]);

    const latestView = sortedFiltered[0];
    const prevView = sortedFiltered[1] || latestView;

    // KPI Calculations
    // "No of stocks above 200 day simple moving average" -> "No of stocks above 200 day SMA"
    const kpiAbove200Pct = latestView && latestView.TotalTraded ? (latestView["No of stocks above 200 day SMA"] / latestView.TotalTraded) * 100 : 0;
    const kpiAbove200PctPrev = prevView && prevView.TotalTraded ? (prevView["No of stocks above 200 day SMA"] / prevView.TotalTraded) * 100 : 0;


    return (
        <div className="space-y-8">
            {/* Controls */}
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm sticky top-4 z-50 shadow-xl">
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

                    {/* Reset Button */}
                    <button
                        onClick={handleReset}
                        className="mt-5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded transition-colors flex items-center gap-2"
                    >
                        <Calendar className="w-4 h-4" /> Reset
                    </button>

                    {/* Column Toggle Dropdown */}
                    <div className="relative mt-5 flex gap-3">
                        {/* Charts View Link */}
                        <Link
                            href="/charts"
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded transition-colors flex items-center gap-2 shadow-lg shadow-indigo-500/20"
                        >
                            <LineChart className="w-4 h-4" /> Charts
                        </Link>

                        {/* Percentage Toggle */}
                        <button
                            onClick={() => setShowPercentages(!showPercentages)}
                            className={`px-4 py-2 border border-slate-700 text-sm font-medium rounded transition-colors flex items-center gap-2 ${showPercentages ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                        >
                            % View
                        </button>

                        <button
                            onClick={() => setIsColumnMenuOpen(!isColumnMenuOpen)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-sm font-medium rounded transition-colors flex items-center gap-2"
                        >
                            <Settings className="w-4 h-4" /> Columns ({selectedMetrics.length})
                        </button>

                        {isColumnMenuOpen && (
                            <div className="absolute top-12 left-0 w-64 bg-slate-900 border border-slate-700 rounded-lg shadow-2xl p-2 z-50 max-h-[60vh] overflow-y-auto">
                                <div className="flex justify-between items-center px-2 pb-2 mb-2 border-b border-slate-800">
                                    <span className="text-xs font-semibold text-slate-400">Select Metrics</span>
                                    <button onClick={() => setSelectedMetrics(allMetrics)} className="text-xs text-blue-400 hover:text-blue-300">Select All</button>
                                </div>
                                {allMetrics.map(metric => (
                                    <button
                                        key={metric}
                                        onClick={() => toggleMetric(metric)}
                                        className="w-full flex items-start gap-3 px-2 py-2 hover:bg-slate-800 rounded text-left text-xs text-slate-200"
                                    >
                                        <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${selectedMetrics.includes(metric) ? 'bg-blue-600 border-blue-600' : 'border-slate-600'}`}>
                                            {selectedMetrics.includes(metric) && <Check className="w-3 h-3 text-white" />}
                                        </div>
                                        <span className="leading-tight">{metric}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {isColumnMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setIsColumnMenuOpen(false)} />}
                </div>
                <div className="text-xs text-slate-500 font-mono">
                    Showing {filteredData.length} records
                </div>
            </div>

            {/* KPI Stats Grid - UPDATED with Requested Metrics using new Schema */}
            {latestView && (
                <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* 1. Stocks > 200 SMA % */}
                    <KpiCard
                        label="Stocks > 200 SMA"
                        value={`${kpiAbove200Pct.toFixed(1)}%`}
                        subValue={`(${latestView["No of stocks above 200 day SMA"]} / ${latestView["TotalTraded"] || '?'})`}
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
                        value={latestView && latestView.TotalTraded ? `${((latestView["Net New Highs"] / latestView.TotalTraded) * 100).toFixed(2)}%` : "0%"}
                        delta={((latestView && latestView.TotalTraded ? (latestView["Net New Highs"] / latestView.TotalTraded) * 100 : 0) -
                            (prevView && prevView.TotalTraded ? (prevView["Net New Highs"] / prevView.TotalTraded) * 100 : 0)).toFixed(2) + "%"}
                        isGood={latestView["Net New Highs"] > 0}
                    />
                </section>
            )}

            {/* Main Heatmap */}
            <section className="space-y-4">
                <Heatmap initialData={filteredData} visibleColumns={selectedMetrics} showPercentages={showPercentages} />
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
