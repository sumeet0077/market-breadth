"use client"

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, ReferenceDot, Brush } from 'recharts';
import { METRIC_CONFIG, MarketData, DRILLDOWN_METRICS } from './Heatmap';
import { DrilldownModal, DrilldownCategory, YearDrilldownMap } from './DrilldownModal';
import { ArrowLeft, Calendar, Maximize2, X, ZoomIn, ZoomOut, RotateCcw, ArrowRight, Layers, Zap } from 'lucide-react';
import Link from 'next/link';

export type SignalFilterType = 'all' | 'macro' | 'swing';

interface ChartsViewProps {
    initialData: MarketData[];
    hideHeader?: boolean;
}

interface ChartPoint {
    Date: string;
    Value: number;
    Original: any;
    Total?: number;
    BuySignal?: boolean;
    SellSignal?: boolean;
    SwingBuySignal?: boolean;
    SwingSellSignal?: boolean;
    SwingScore?: number;
    BuyProb?: number;
    SellProb?: number;
    ADRatio?: number;
}

// Fast peak-and-signal preserving decimation for instant grid rendering
function decimateChartData<T extends { Date: string; Value: number; BuySignal?: boolean; SellSignal?: boolean; SwingBuySignal?: boolean; SwingSellSignal?: boolean }>(
    data: T[], 
    targetPoints: number = 220
): T[] {
    if (data.length <= targetPoints) return data;
    
    const step = Math.ceil(data.length / targetPoints);
    const sampled: T[] = [];
    
    sampled.push(data[0]);
    
    for (let i = 1; i < data.length - 1; i += step) {
        const bucket = data.slice(i, Math.min(i + step, data.length - 1));
        if (bucket.length === 0) continue;
        
        let minPt = bucket[0];
        let maxPt = bucket[0];
        const signals: T[] = [];
        
        for (const pt of bucket) {
            if (pt.Value < minPt.Value) minPt = pt;
            if (pt.Value > maxPt.Value) maxPt = pt;
            if (pt.BuySignal || pt.SellSignal || pt.SwingBuySignal || pt.SwingSellSignal) signals.push(pt);
        }
        
        const candidates = [minPt, maxPt, ...signals].sort((a, b) => 
            new Date(a.Date).getTime() - new Date(b.Date).getTime()
        );
        
        for (const cand of candidates) {
            if (sampled[sampled.length - 1].Date !== cand.Date) {
                sampled.push(cand);
            }
        }
    }
    
    if (sampled[sampled.length - 1].Date !== data[data.length - 1].Date) {
        sampled.push(data[data.length - 1]);
    }
    
    return sampled;
}

// Signal Marker Renderers
function renderSignalMarker(d: ChartPoint, isExpanded: boolean, signalFilter: SignalFilterType) {
    const isSuper = Boolean(d.BuySignal && d.SwingBuySignal);
    const isMacro = Boolean(d.BuySignal && !d.SwingBuySignal);
    const isSwing = Boolean(d.SwingBuySignal && !d.BuySignal);

    if (signalFilter === 'macro' && !d.BuySignal) return null;
    if (signalFilter === 'swing' && !d.SwingBuySignal) return null;

    if (isSuper) {
        const r = isExpanded ? 11 : 9;
        return (
            <ReferenceDot
                key={`super-${d.Date}`}
                x={d.Date}
                y={d.Value}
                r={r}
                shape={(props: any) => {
                    const { cx, cy } = props;
                    if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) return <g />;
                    return (
                        <g>
                            <circle
                                cx={cx}
                                cy={cy}
                                r={r}
                                fill="#10b981"
                                stroke="#06b6d4"
                                strokeWidth={3}
                            />
                            <circle cx={cx} cy={cy} r={3} fill="#ffffff" />
                        </g>
                    );
                }}
            />
        );
    }

    if (isMacro && (signalFilter === 'all' || signalFilter === 'macro')) {
        const r = isExpanded ? 8 : 7;
        return (
            <ReferenceDot
                key={`macro-${d.Date}`}
                x={d.Date}
                y={d.Value}
                r={r}
                shape={(props: any) => {
                    const { cx, cy } = props;
                    if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) return <g />;
                    return (
                        <circle
                            cx={cx}
                            cy={cy}
                            r={r}
                            fill="#10b981"
                            stroke="#000000"
                            strokeWidth={2}
                        />
                    );
                }}
            />
        );
    }

    if (isSwing && (signalFilter === 'all' || signalFilter === 'swing')) {
        const r = isExpanded ? 7 : 6;
        return (
            <ReferenceDot
                key={`swing-${d.Date}`}
                x={d.Date}
                y={d.Value}
                r={r}
                shape={(props: any) => {
                    const { cx, cy } = props;
                    if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) return <g />;
                    return (
                        <path
                            d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
                            fill="#06b6d4"
                            stroke="#0f172a"
                            strokeWidth={1.5}
                        />
                    );
                }}
            />
        );
    }

    return null;
}

function renderSellMarker(d: ChartPoint, isExpanded: boolean, signalFilter: SignalFilterType) {
    if (signalFilter === 'macro' && !d.SellSignal) return null;
    if (signalFilter === 'swing' && !d.SwingSellSignal) return null;

    if (d.SellSignal && (signalFilter === 'all' || signalFilter === 'macro')) {
        return (
            <ReferenceDot
                key={`macro-sell-${d.Date}`}
                x={d.Date}
                y={d.Value}
                r={isExpanded ? 8 : 7}
                fill="#ef4444"
                stroke="#000"
                strokeWidth={2}
            />
        );
    }

    if (d.SwingSellSignal && (signalFilter === 'all' || signalFilter === 'swing')) {
        const r = isExpanded ? 7 : 6;
        return (
            <ReferenceDot
                key={`swing-sell-${d.Date}`}
                x={d.Date}
                y={d.Value}
                r={r}
                shape={(props: any) => {
                    const { cx, cy } = props;
                    if (cx == null || cy == null || isNaN(cx) || isNaN(cy)) return <g />;
                    return (
                        <path
                            d={`M ${cx} ${cy - r} L ${cx + r} ${cy} L ${cx} ${cy + r} L ${cx - r} ${cy} Z`}
                            fill="#f43f5e"
                            stroke="#0f172a"
                            strokeWidth={1.5}
                        />
                    );
                }}
            />
        );
    }

    return null;
}

// Custom Tooltip for Deep Signal Explanations
function CustomTooltip({ active, payload, title, isRatio, signalFilter = 'all' }: { active?: boolean; payload?: any[]; title: string; isRatio?: boolean; signalFilter?: SignalFilterType }) {
    if (!active || !payload || !payload.length) return null;
    const pt = payload[0]?.payload as ChartPoint;
    if (!pt) return null;

    const val = Number(pt.Value);
    const dateFormatted = new Date(pt.Date).toLocaleDateString(undefined, {
        timeZone: 'UTC',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    });

    const showMacro = signalFilter === 'all' || signalFilter === 'macro';
    const showSwing = signalFilter === 'all' || signalFilter === 'swing';

    const isSuper = Boolean(pt.BuySignal && pt.SwingBuySignal);
    const isMacroBuy = Boolean(pt.BuySignal && !pt.SwingBuySignal && showMacro);
    const isSwingBuy = Boolean(pt.SwingBuySignal && !pt.BuySignal && showSwing);

    return (
        <div className="bg-slate-950/95 border border-slate-800 rounded-xl p-3 shadow-2xl backdrop-blur-md text-xs font-mono max-w-xs space-y-2 pointer-events-none z-50">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-1.5 gap-2">
                <span className="text-slate-400 font-semibold">{dateFormatted}</span>
                <span className="text-slate-200 font-bold">
                    {isNaN(val) ? pt.Value : val.toFixed(2)}{isRatio ? '' : '%'}
                </span>
            </div>

            {/* Signal Badges & Explanations */}
            {isSuper && (
                <div className="bg-gradient-to-r from-emerald-950/90 to-cyan-950/90 border border-cyan-500/60 rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between text-cyan-300 font-bold text-[11px]">
                        <span>⚡🟢 SUPER-CONFLUENCE</span>
                        <span className="bg-emerald-900/90 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] border border-emerald-700/80">90.0% Win Rate</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                        Macro Cycle Reset + Tactical Swing Thrust aligned. Exceptional institutional accumulation.
                    </p>
                </div>
            )}

            {isMacroBuy && (
                <div className="bg-emerald-950/90 border border-emerald-600/60 rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between text-emerald-400 font-bold text-[11px]">
                        <span>🟢 MACRO CYCLE RESET</span>
                        <span className="bg-emerald-900/90 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] border border-emerald-700/80">Multi-Month</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                        Secular market bottom reversal. Capitulation with Zweig breadth thrust.
                    </p>
                </div>
            )}

            {isSwingBuy && (
                <div className="bg-cyan-950/90 border border-cyan-500/60 rounded-lg p-2 space-y-1">
                    <div className="flex items-center justify-between text-cyan-300 font-bold text-[11px]">
                        <span>💠 TACTICAL SWING THRUST</span>
                        <span className="bg-cyan-900/90 text-cyan-300 px-1.5 py-0.5 rounded text-[9px] border border-cyan-700/80">84.1% Win Rate</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                        ML Follow-Through Score: {pt.SwingScore !== undefined ? pt.SwingScore.toFixed(1) : '70+'}/100. High-velocity 3–10 day breakout momentum.
                    </p>
                </div>
            )}

            {Boolean(pt.SellSignal && showMacro) && (
                <div className="bg-rose-950/90 border border-rose-600/60 rounded-lg p-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                        <span>🔴 MACRO B_SELL REVERSAL</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                        Euphoric breadth climax exhaustion. Take defensive action.
                    </p>
                </div>
            )}

            {Boolean(pt.SwingSellSignal && !pt.SellSignal && showSwing) && (
                <div className="bg-rose-950/90 border border-rose-600/60 rounded-lg p-2 space-y-1">
                    <div className="flex items-center gap-1.5 text-rose-400 font-bold text-[11px]">
                        <span>⚠️ TACTICAL SWING RISK</span>
                    </div>
                    <p className="text-[10px] text-slate-300 leading-tight">
                        Score dropped &lt; 45 with weak A/D ratio. High breakout failure risk.
                    </p>
                </div>
            )}

            <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                <div>Metric: <span className="text-slate-200">{title}</span></div>
                {pt.SwingScore !== undefined && (
                    <div>Swing Score: <span className="text-cyan-400 font-bold">{pt.SwingScore.toFixed(1)}/100</span></div>
                )}
            </div>
        </div>
    );
}

function subtractMonths(dateStr: string, months: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const targetMonth = m - 1 - months;
    const date = new Date(Date.UTC(y, targetMonth, 1));
    const maxDays = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
    date.setUTCDate(Math.min(d, maxDays));
    return date.toISOString().split('T')[0];
}

function subtractYears(dateStr: string, years: number): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(Date.UTC(y - years, m - 1, 1));
    const maxDays = new Date(Date.UTC(y - years, m, 0)).getUTCDate();
    date.setUTCDate(Math.min(d, maxDays));
    return date.toISOString().split('T')[0];
}

export function ChartsView({ initialData, hideHeader }: ChartsViewProps) {
    // 1. Data Prep & Range Calculation
    const allSorted = useMemo(() =>
        [...initialData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()),
        [initialData]);

    const maxDate = allSorted[0]?.Date || new Date().toISOString().split('T')[0];
    const minDate = allSorted[allSorted.length - 1]?.Date || "2014-06-02";

    // Default to 1 Year for high performance (< 100ms load time)
    const defaultStart = useMemo(() => {
        const calcStart = subtractYears(maxDate, 1);
        return calcStart >= minDate ? calcStart : minDate;
    }, [maxDate, minDate]);

    // 2. State
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(maxDate);
    const [activePreset, setActivePreset] = useState<'6M' | '1Y' | '3Y' | '5Y' | 'ALL' | 'CUSTOM'>('1Y');
    const [signalFilter, setSignalFilter] = useState<SignalFilterType>('all');
    const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

    // Quick timeframe presets
    const handleSetTimeframe = (preset: '6M' | '1Y' | '3Y' | '5Y' | 'ALL') => {
        setActivePreset(preset);
        setEndDate(maxDate);
        if (preset === 'ALL') {
            setStartDate(minDate);
            return;
        }
        let strStart = maxDate;
        if (preset === '6M') strStart = subtractMonths(maxDate, 6);
        if (preset === '1Y') strStart = subtractYears(maxDate, 1);
        if (preset === '3Y') strStart = subtractYears(maxDate, 3);
        if (preset === '5Y') strStart = subtractYears(maxDate, 5);

        setStartDate(strStart >= minDate ? strStart : minDate);
    };

    // Drilldown State
    const [drilldownState, setDrilldownState] = useState<{
        isOpen: boolean;
        date: string;
        category: DrilldownCategory;
    }>({
        isOpen: false,
        date: '',
        category: 'up45'
    });

    const [yearCache, setYearCache] = useState<Record<string, YearDrilldownMap>>({});
    const [isDrilldownLoading, setIsDrilldownLoading] = useState(false);

    const openDrilldown = useCallback(async (date: string, category: DrilldownCategory) => {
        setDrilldownState({ isOpen: true, date, category });
        
        const year = date.split('-')[0];
        if (!yearCache[year]) {
            setIsDrilldownLoading(true);
            try {
                const res = await fetch(`/api/market-data/drilldown/${year}`, { cache: 'no-store' });
                if (!res.ok) {
                    const errJson = await res.json().catch(() => ({}));
                    throw new Error(errJson.message || `Failed to load drilldown data for ${year}`);
                }
                const json: YearDrilldownMap = await res.json();
                setYearCache(prev => ({ ...prev, [year]: json }));
            } catch (err) {
                console.error(`Failed to load drilldown data for ${year}:`, err);
            } finally {
                setIsDrilldownLoading(false);
            }
        }
    }, [yearCache]);

    const handleDrilldownNavigateDate = useCallback((newDate: string) => {
        openDrilldown(newDate, drilldownState.category);
    }, [openDrilldown, drilldownState.category]);

    const closeDrilldown = useCallback(() => {
        setDrilldownState(prev => ({ ...prev, isOpen: false }));
    }, []);

    const allAvailableDates = useMemo(() => initialData.map(d => d.Date), [initialData]);

    const currentYear = drilldownState.date ? drilldownState.date.split('-')[0] : '';
    const currentDayData = (currentYear && yearCache[currentYear]?.[drilldownState.date]) || null;

    // 3. Filter Data
    const filteredData = useMemo(() => {
        const s = new Date(startDate).getTime();
        const e = new Date(endDate).getTime();
        const effectiveStart = Math.min(s, e);
        const effectiveEnd = Math.max(s, e);

        // Filter and then sort ASCENDING for Charts
        return initialData
            .filter(d => {
                const t = new Date(d.Date).getTime();
                return t >= effectiveStart && t <= effectiveEnd;
            })
            .sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
    }, [initialData, startDate, endDate]);

    // 4. Reset Handler
    const handleReset = () => {
        setStartDate(defaultStart);
        setEndDate(maxDate);
        setActivePreset('1Y');
    };

    const metrics = Object.keys(METRIC_CONFIG);

    return (
        <div className="space-y-6">
            {/* Top Brand Identity Bar (only shown when not hideHeader, e.g. standalone /charts) */}
            {!hideHeader && (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 p-3 px-4 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="flex items-center gap-2.5">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-cyan-500/20 font-mono">
                            QB
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                                QuantBreadth<span className="text-cyan-400">™</span>
                            </span>
                            <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-800/80 font-bold">
                                PRO
                            </span>
                        </div>
                    </div>

                    <nav className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/90">
                        <Link
                            href="/"
                            className="px-3 py-1.5 text-slate-400 hover:text-slate-200 hover:bg-slate-900 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Breadth Heatmap</span>
                        </Link>
                        <div className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-bold shadow-md shadow-indigo-600/30 flex items-center gap-1.5">
                            <LineChart className="w-3.5 h-3.5" />
                            <span>Charts Studio</span>
                        </div>
                    </nav>
                </div>
            )}

            {/* Dedicated Chart Studio Toolbar - permanently visible regardless of hideHeader */}
            <div className="bg-slate-900 border border-slate-800 p-3 px-4 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 sticky top-3 z-30 backdrop-blur-md bg-slate-900/95">
                {/* Left: Signal Filter Switcher */}
                <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider hidden sm:inline">
                        Signal Filter:
                    </span>
                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
                        <button
                            onClick={() => setSignalFilter('all')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                signalFilter === 'all'
                                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                        >
                            <span>⚡ All Signals</span>
                        </button>
                        <button
                            onClick={() => setSignalFilter('macro')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                signalFilter === 'macro'
                                    ? 'bg-emerald-950/90 text-emerald-300 border border-emerald-600 shadow-md shadow-emerald-900/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                        >
                            <span>🟢 Macro B_BUY</span>
                        </button>
                        <button
                            onClick={() => setSignalFilter('swing')}
                            className={`px-3 py-1.5 rounded-lg font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                                signalFilter === 'swing'
                                    ? 'bg-cyan-950/90 text-cyan-300 border border-cyan-500 shadow-md shadow-cyan-900/30'
                                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                            }`}
                        >
                            <span>💠 Tactical Swing</span>
                        </button>
                    </div>
                </div>

                {/* Right: Timeframe Presets & Date Pickers */}
                <div className="flex flex-wrap items-center gap-2">
                    {/* Timeframe Presets: 6M, 1Y, 3Y, 5Y, ALL */}
                    <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs font-semibold">
                        {(['6M', '1Y', '3Y', '5Y', 'ALL'] as const).map((preset) => (
                            <button
                                key={preset}
                                onClick={() => handleSetTimeframe(preset)}
                                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer ${
                                    activePreset === preset
                                        ? 'bg-slate-800 text-white font-bold shadow-inner'
                                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                                }`}
                            >
                                {preset}
                            </button>
                        ))}
                    </div>

                    {/* Date Inputs */}
                    <div className="flex items-center gap-1.5 bg-slate-950 px-2.5 py-1 rounded-xl border border-slate-800 text-xs font-mono">
                        <Calendar className="w-3.5 h-3.5 text-slate-500" />
                        <input
                            type="date"
                            value={startDate}
                            min={minDate}
                            max={maxDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                setActivePreset('CUSTOM');
                            }}
                            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer w-24"
                        />
                        <span className="text-slate-600 text-xs">→</span>
                        <input
                            type="date"
                            value={endDate}
                            min={minDate}
                            max={maxDate}
                            onChange={(e) => {
                                setEndDate(e.target.value);
                                setActivePreset('CUSTOM');
                            }}
                            className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer w-24"
                        />
                    </div>

                    {/* Reset Button */}
                    <button
                        onClick={handleReset}
                        className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                        title="Reset Date Range to 1Y"
                    >
                        <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                        <span className="hidden sm:inline">Reset</span>
                    </button>
                </div>
            </div>

            {/* Dedicated Hero Indicator Chart at the top of the grid: ML Swing Follow-Through Score */}
            <SwingHeroChart
                data={filteredData}
                signalFilter={signalFilter}
                onExpand={() => setExpandedMetric("ML Swing Follow-Through Score")}
            />

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {metrics.map(metric => (
                    <ChartCard
                        key={metric}
                        metric={metric}
                        data={filteredData}
                        signalFilter={signalFilter}
                        onExpand={() => setExpandedMetric(metric)}
                        onDrilldown={openDrilldown}
                    />
                ))}
            </div>

            {/* Expanded Modal */}
            {expandedMetric === "ML Swing Follow-Through Score" ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 overscroll-contain">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-[95vw] h-[90vh] flex flex-col shadow-2xl overflow-hidden relative p-6 md:p-8 transform-gpu">
                        <SwingHeroChart
                            data={filteredData}
                            signalFilter={signalFilter}
                            isExpanded={true}
                            onClose={() => setExpandedMetric(null)}
                        />
                    </div>
                    <div className="absolute inset-0 -z-10" onClick={() => setExpandedMetric(null)} />
                </div>
            ) : expandedMetric ? (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 overscroll-contain">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-[95vw] h-[90vh] flex flex-col shadow-2xl overflow-hidden relative p-6 md:p-8 transform-gpu">
                        <ChartCard
                            metric={expandedMetric}
                            data={filteredData}
                            signalFilter={signalFilter}
                            isExpanded={true}
                            onDrilldown={openDrilldown}
                            onClose={() => setExpandedMetric(null)}
                        />
                    </div>
                    <div className="absolute inset-0 -z-10" onClick={() => setExpandedMetric(null)} />
                </div>
            ) : null}

            {/* Drilldown Modal */}
            <DrilldownModal
                isOpen={drilldownState.isOpen}
                onClose={closeDrilldown}
                date={drilldownState.date}
                category={drilldownState.category}
                availableDates={allAvailableDates}
                onNavigateDate={handleDrilldownNavigateDate}
                data={currentDayData}
                isLoading={isDrilldownLoading}
            />
        </div>
    );
}

// ---------------------------------------------------------------------------
// Dedicated Hero Indicator Chart: ML Swing Follow-Through Score (0-100)
// ---------------------------------------------------------------------------

function SwingHeroChartComponent({
    data,
    signalFilter,
    onExpand,
    isExpanded = false,
    onClose
}: {
    data: MarketData[],
    signalFilter: SignalFilterType,
    onExpand?: () => void,
    isExpanded?: boolean,
    onClose?: () => void
}) {
    const rawChartData = useMemo(() => {
        return data.map(d => {
            const score = typeof d.Swing_Score === 'number' ? d.Swing_Score : 50;
            return {
                Date: d.Date,
                Value: score,
                Original: score,
                Total: d.TotalTraded,
                BuySignal: Boolean(d.Bullseye_Buy_Signal),
                SellSignal: Boolean(d.Bullseye_Sell_Signal),
                SwingBuySignal: Boolean(d.Swing_Thrust_Buy),
                SwingSellSignal: Boolean(d.Swing_Risk_Sell),
                SwingScore: score,
                BuyProb: d.Buy_Reversal_Prob || 85.0,
                SellProb: d.Sell_Reversal_Prob || 85.0,
                ADRatio: d["Advance/Decline Ratio"]
            };
        });
    }, [data]);

    const chartData = useMemo(() => {
        if (isExpanded) return rawChartData;
        return decimateChartData(rawChartData, 350);
    }, [rawChartData, isExpanded]);

    const latestPt = data[data.length - 1];
    const latestScore = latestPt?.Swing_Score ?? 50;
    const latestRegime = latestPt?.Swing_Regime || (latestScore >= 70 ? "🟢 High Follow-Through" : latestScore >= 45 ? "🟡 Selective Momentum" : "🔴 High Failure Risk");
    const isThrustActive = Boolean(latestPt?.Swing_Thrust_Buy);

    // Zoom and Pan State for Expanded View
    const [zoomState, setZoomState] = useState<{ left: number, right: number }>({ left: 0, right: 0 });
    const zoomRef = useRef<{ left: number, right: number }>({ left: 0, right: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const isBrushDragging = useRef(false);
    const lastPanX = useRef(0);
    const lastMouseX = useRef(0);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);

    useEffect(() => {
        if (chartData.length > 0) {
            const initialZoom = { left: 0, right: chartData.length - 1 };
            setZoomState(initialZoom);
            zoomRef.current = initialZoom;
        }
    }, [chartData.length]);

    const updateZoomState = (newState: { left: number, right: number }) => {
        zoomRef.current = newState;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            setZoomState(newState);
        });
    };

    const handleZoom = (direction: 'in' | 'out', mouseX?: number) => {
        const prev = zoomRef.current;
        const span = prev.right - prev.left;
        if (direction === 'in' && span <= 10) return;
        if (direction === 'out' && span >= chartData.length - 1) {
            updateZoomState({ left: 0, right: chartData.length - 1 });
            return;
        }

        const zoomFactor = direction === 'in' ? 0.75 : 1.33;
        let newSpan = Math.max(10, Math.floor(span * zoomFactor));
        if (newSpan >= chartData.length) newSpan = chartData.length - 1;

        const diff = span - newSpan;
        let focusRatio = 0.5;

        if (mouseX !== undefined && chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const chartX = mouseX - rect.left - 60;
            const chartWidth = rect.width - 60;
            if (chartX > 0 && chartX < chartWidth) focusRatio = chartX / chartWidth;
            else if (chartX <= 0) focusRatio = 0;
            else focusRatio = 1;
        }

        const leftDiff = Math.floor(diff * focusRatio);
        const rightDiff = diff - leftDiff;

        let newLeft = prev.left + leftDiff;
        let newRight = prev.right - rightDiff;

        if (newLeft < 0) {
            newLeft = 0;
            newRight = Math.min(chartData.length - 1, newLeft + newSpan);
        } else if (newRight > chartData.length - 1) {
            newRight = chartData.length - 1;
            newLeft = Math.max(0, newRight - newSpan);
        }

        updateZoomState({ left: newLeft, right: newRight });
    };

    const handleZoomIn = () => handleZoom('in');
    const handleZoomOut = () => handleZoom('out');

    const handlePan = (direction: 'left' | 'right') => {
        const prev = zoomRef.current;
        const span = prev.right - prev.left;
        const shift = Math.max(1, Math.floor(span * 0.1));
        if (direction === 'left') {
            const newLeft = Math.max(0, prev.left - shift);
            updateZoomState({ left: newLeft, right: Math.min(chartData.length - 1, newLeft + span) });
        } else {
            const newRight = Math.min(chartData.length - 1, prev.right + shift);
            updateZoomState({ left: Math.max(0, newRight - span), right: newRight });
        }
    };

    const handleResetZoom = () => {
        updateZoomState({ left: 0, right: chartData.length - 1 });
    };

    // Native Wheel Event
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || !isExpanded) return;

        let lastWheelTime = 0;
        const handleNativeWheel = (e: WheelEvent) => {
            e.preventDefault();
            const now = Date.now();
            if (now - lastWheelTime < 16) return;
            lastWheelTime = now;

            if (e.deltaY < -2) handleZoom('in', lastMouseX.current);
            else if (e.deltaY > 2) handleZoom('out', lastMouseX.current);
        };

        const handleNativeMouseMove = (e: MouseEvent) => {
            lastMouseX.current = e.clientX;
        };

        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        container.addEventListener('mousemove', handleNativeMouseMove);

        return () => {
            container.removeEventListener('wheel', handleNativeWheel);
            container.removeEventListener('mousemove', handleNativeMouseMove);
        };
    }, [isExpanded, chartData.length]);

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isExpanded || isBrushDragging.current) return;
        if (chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            if (clickY > rect.height - 60) {
                isBrushDragging.current = true;
                return;
            }
        }
        setIsPanning(true);
        lastPanX.current = e.clientX;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isExpanded || !isPanning) return;
        const deltaX = e.clientX - lastPanX.current;
        const prev = zoomRef.current;
        const span = prev.right - prev.left;
        const pixelsPerPoint = Math.max(0.5, 800 / span);

        if (Math.abs(deltaX) > pixelsPerPoint) {
            const shiftCount = Math.abs(deltaX) / (pixelsPerPoint * 0.8);
            const direction = deltaX > 0 ? -1 : 1;
            const shift = Math.max(1, Math.floor(shiftCount)) * direction;

            let newLeft = prev.left + shift;
            let newRight = prev.right + shift;

            if (newLeft < 0) {
                newLeft = 0;
                newRight = span;
            } else if (newRight > chartData.length - 1) {
                newRight = chartData.length - 1;
                newLeft = newRight - span;
            }

            lastPanX.current = e.clientX;
            updateZoomState({ left: newLeft, right: newRight });
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        if (isBrushDragging.current) {
            isBrushDragging.current = false;
            setZoomState({ ...zoomRef.current });
        }
    };

    return (
        <div className={`bg-slate-900 border border-slate-800/90 rounded-2xl shadow-xl flex flex-col transition-colors hover:border-slate-700/80 ${isExpanded ? 'h-full border-none shadow-none bg-transparent p-0' : 'h-[360px] p-5'}`}>
            {/* Header: Title & Regime Zones Legend */}
            <div className={`flex flex-wrap items-center justify-between gap-3 flex-shrink-0 ${isExpanded ? 'mb-4 pb-3 border-b border-slate-800/80 h-10' : 'mb-3'}`}>
                <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-cyan-950/80 border border-cyan-500/60 flex items-center justify-center">
                            <Zap className="w-3.5 h-3.5 text-cyan-400 fill-cyan-400/20" />
                        </div>
                        <h3 className={`font-extrabold text-slate-100 truncate ${isExpanded ? 'text-xl' : 'text-sm md:text-base'}`}>
                            ML Swing Follow-Through Score <span className="text-cyan-400 font-mono text-xs">(0–100)</span>
                        </h3>
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-0.5 rounded-full font-mono font-bold bg-slate-950 border border-slate-800 text-slate-200">
                            Latest: <strong className="text-cyan-400">{latestScore.toFixed(1)}/100</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-950 border border-slate-800 text-slate-300">
                            {latestRegime}
                        </span>
                        {isThrustActive && (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-950/90 text-cyan-300 border border-cyan-500/80 shadow-[0_0_12px_rgba(6,182,212,0.4)] animate-pulse flex items-center gap-1">
                                ⚡ SWING THRUST ACTIVE
                            </span>
                        )}
                    </div>

                    {/* Zoom Controls when Expanded */}
                    {isExpanded && (
                        <div className="flex items-center gap-1 bg-slate-950/90 rounded-lg p-1 border border-slate-800 shadow-inner ml-2">
                            <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
                            <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-slate-800 mx-1" />
                            <button onClick={() => handlePan('left')} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Pan Left"><ArrowLeft className="w-4 h-4" /></button>
                            <button onClick={() => handlePan('right')} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Pan Right"><ArrowRight className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-slate-800 mx-1" />
                            <button onClick={handleResetZoom} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Reset Scale"><RotateCcw className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>

                {/* Right: Actions */}
                <div className="flex items-center gap-2">
                    {/* Visual Legend */}
                    <div className="hidden lg:flex items-center gap-2.5 text-[10px] font-mono text-slate-400 bg-slate-950/60 px-2.5 py-1 rounded-lg border border-slate-800/80">
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500/80" /> 70-100 Follow-Through</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400/80" /> 45-70 Selective</span>
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-rose-500/80" /> 0-45 Trap Risk</span>
                    </div>

                    {isExpanded ? (
                        onClose && (
                            <button
                                onClick={onClose}
                                className="p-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700/80 shadow-sm"
                                title="Close Fullscreen (Esc)"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )
                    ) : (
                        <button
                            onClick={onExpand}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-all border border-slate-800/90"
                            title="Expand to Fullscreen"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Chart Canvas */}
            <div
                ref={chartContainerRef}
                className={`flex-1 w-full min-h-0 ${isExpanded ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setIsPanning(false)}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                        {/* Color-coded Regime Zones */}
                        {/* 1. Green High Follow-Through Zone (70-100) */}
                        <ReferenceArea y1={70} y2={100} fill="#10b981" fillOpacity={0.10} />
                        {/* 2. Amber Selective Momentum Zone (45-70) */}
                        <ReferenceArea y1={45} y2={70} fill="#f59e0b" fillOpacity={0.07} />
                        {/* 3. Red High Failure Risk Zone (0-45) */}
                        <ReferenceArea y1={0} y2={45} fill="#ef4444" fillOpacity={0.10} />

                        {/* Reference Threshold Lines */}
                        <ReferenceLine
                            y={70}
                            stroke="#10b981"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{ value: 'THRUST THRESHOLD (70)', position: 'insideTopRight', fill: '#10b981', fontSize: 10, fontWeight: 'bold' }}
                        />
                        <ReferenceLine
                            y={45}
                            stroke="#ef4444"
                            strokeDasharray="4 4"
                            strokeWidth={1.5}
                            label={{ value: 'FAILURE RISK (45)', position: 'insideBottomRight', fill: '#ef4444', fontSize: 10, fontWeight: 'bold' }}
                        />

                        <XAxis
                            dataKey="Date"
                            stroke="#64748b"
                            fontSize={isExpanded ? 12 : 10}
                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                            minTickGap={30}
                            height={isExpanded ? 40 : 30}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={isExpanded ? 12 : 10}
                            domain={[0, 100]}
                            ticks={[0, 20, 45, 70, 85, 100]}
                            tickFormatter={(val) => `${val}`}
                            width={isExpanded ? 60 : 40}
                        />

                        <Tooltip
                            content={<CustomTooltip title="ML Swing Follow-Through Score" isRatio={true} signalFilter={signalFilter} />}
                        />

                        <Line
                            type="monotone"
                            dataKey="Value"
                            stroke="#06b6d4"
                            strokeWidth={isExpanded ? 3 : 2.5}
                            dot={false}
                            isAnimationActive={false}
                            activeDot={{ r: isExpanded ? 6 : 4, fill: '#06b6d4' }}
                        />

                        {/* Signal Overlays */}
                        {chartData.filter(d => (d.BuySignal || d.SwingBuySignal)).map(d => renderSignalMarker(d, isExpanded, signalFilter))}
                        {chartData.filter(d => (d.SellSignal || d.SwingSellSignal)).map(d => renderSellMarker(d, isExpanded, signalFilter))}

                        {/* Interactive Brush when Expanded */}
                        {isExpanded && (
                            <Brush
                                dataKey="Date"
                                height={40}
                                stroke="#475569"
                                fill="#0f172a"
                                className="opacity-80"
                                tickFormatter={() => ""}
                                startIndex={zoomState.left}
                                endIndex={zoomState.right}
                                onChange={(range: any) => {
                                    if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
                                        let left = range.startIndex;
                                        let right = range.endIndex;
                                        if (right - left < 10) {
                                            if (left + 10 < chartData.length) right = left + 10;
                                            else {
                                                right = chartData.length - 1;
                                                left = Math.max(0, right - 10);
                                            }
                                        }
                                        updateZoomState({ left, right });
                                    }
                                }}
                            />
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

const SwingHeroChart = React.memo(SwingHeroChartComponent);

// ---------------------------------------------------------------------------
// Standard Breadth Metric Chart Card (12 Grid Cards)
// ---------------------------------------------------------------------------

function ChartCardComponent({ 
    metric, 
    data, 
    signalFilter,
    onExpand, 
    isExpanded = false,
    onDrilldown,
    onClose
}: { 
    metric: string, 
    data: MarketData[], 
    signalFilter: SignalFilterType,
    onExpand?: () => void, 
    isExpanded?: boolean,
    onDrilldown?: (date: string, category: DrilldownCategory) => void,
    onClose?: () => void
}) {
    const isRatio = metric === "Advance/Decline Ratio";
    const isNetNewHighs = metric === "Net New Highs";
    const config = METRIC_CONFIG[metric];
    const drillCategory = DRILLDOWN_METRICS[metric];

    // Per-chart signal column mapping
    const macroSignalMap: Record<string, { buy: string, sell: string, prob: string }> = {
        "No of stocks above 50 day SMA": { buy: "Bullseye_Buy_Signal", sell: "Bullseye_Sell_Signal", prob: "Buy_Reversal_Prob" },
        "Net New Highs": { buy: "Bull_NNH_Buy", sell: "Bull_NNH_Sell", prob: "Bull_NNH_Prob" },
        "No of stocks above 200 day SMA": { buy: "Bull_200SMA_Buy", sell: "Bull_200SMA_Sell", prob: "Bull_200SMA_Prob" },
        "No of stocks above all 3 SMAs": { buy: "Bull_AllSMA_Buy", sell: "Bull_AllSMA_Sell", prob: "Bull_AllSMA_Prob" },
    };
    const macroSignals = macroSignalMap[metric];

    // Eligible for Swing_Thrust_Buy overlays per task spec:
    // "ML Swing Score, No of stocks above 20 day SMA, No of stocks above 50 day SMA, No of stocks above all 3 SMAs, and Advance/Decline Ratio"
    const swingEligibleMetrics = useMemo(() => new Set([
        "No of stocks above 20 day SMA",
        "No of stocks above 50 day SMA",
        "No of stocks above all 3 SMAs",
        "Advance/Decline Ratio"
    ]), []);
    const hasSwingSignals = swingEligibleMetrics.has(metric);

    // Process data for this chart
    const rawChartData = useMemo(() => {
        return data.map(d => {
            const rawVal = d[metric];
            let val = rawVal;

            if (!isRatio && d.TotalTraded) {
                if (typeof rawVal === 'number') {
                    val = (rawVal / d.TotalTraded) * 100;
                } else {
                    val = 0;
                }
            } else if (isRatio && typeof rawVal !== 'number') {
                val = 0;
            }

            const buySignal = macroSignals ? Boolean(d[macroSignals.buy]) : false;
            const sellSignal = macroSignals ? Boolean(d[macroSignals.sell]) : false;
            const swingBuySignal = hasSwingSignals ? Boolean(d.Swing_Thrust_Buy) : false;
            const swingSellSignal = hasSwingSignals ? Boolean(d.Swing_Risk_Sell) : false;

            return {
                Date: d.Date,
                Value: val,
                Original: rawVal,
                Total: d.TotalTraded,
                BuySignal: buySignal,
                SellSignal: sellSignal,
                SwingBuySignal: swingBuySignal,
                SwingSellSignal: swingSellSignal,
                SwingScore: d.Swing_Score,
                BuyProb: macroSignals ? d[macroSignals.prob] : 0,
                SellProb: macroSignals ? d[macroSignals.prob] : 0,
                ADRatio: d["Advance/Decline Ratio"]
            };
        });
    }, [data, metric, isRatio, macroSignals, hasSwingSignals]);

    // Apply decimation for small grid cards to make rendering lightning-fast (<50ms)
    const chartData = useMemo(() => {
        if (isExpanded) return rawChartData;
        return decimateChartData(rawChartData, 350);
    }, [rawChartData, isExpanded]);

    const title = isRatio ? metric : `${metric} (%)`;
    const color = config.type === 'bad' ? '#ef4444' : '#22c55e';

    // Gradient Offset Logic
    const threshold = isRatio ? 1 : 0;
    const isDiverging = isNetNewHighs || isRatio;

    const gradientOffset = useMemo(() => {
        if (!isDiverging || chartData.length === 0) return 0;

        const dataMax = Math.max(...chartData.map((i) => i.Value));
        const dataMin = Math.min(...chartData.map((i) => i.Value));

        if (dataMax <= threshold) return 0;
        if (dataMin >= threshold) return 1;

        const diff = dataMax - dataMin;
        if (diff === 0) return 0;

        return (dataMax - threshold) / diff;
    }, [chartData, isDiverging, threshold]);

    const isBadMetric = config.type === 'bad';
    const topAreaColor = isBadMetric ? "#ef4444" : "#22c55e";
    const bottomAreaColor = isBadMetric ? "#22c55e" : "#ef4444";

    // Gradient ID
    const gradientId = `splitColor-${metric.replace(/[^a-zA-Z0-9]/g, '')}`;

    // Banding logic: Show if NOT Ratio AND NOT 4.5% metrics AND NOT 20% metrics AND NOT Net New Highs
    const showBanding = !isRatio && !metric.includes("4.5%") && !metric.includes("20%+") && metric !== "Net New Highs";

    // State for Zoom/Pan
    const [zoomState, setZoomState] = useState<{ left: number, right: number }>({ left: 0, right: 0 });
    const zoomRef = useRef<{ left: number, right: number }>({ left: 0, right: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const isBrushDragging = useRef(false);
    const lastPanX = useRef(0);
    const lastMouseX = useRef(0);
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const rafRef = useRef<number | null>(null);

    // Initialize zoom on data load or expand
    useEffect(() => {
        if (chartData.length > 0) {
            const initialZoom = { left: 0, right: chartData.length - 1 };
            setZoomState(initialZoom);
            zoomRef.current = initialZoom;
        }
    }, [chartData.length]);

    const updateZoomState = (newState: { left: number, right: number }) => {
        zoomRef.current = newState;
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        rafRef.current = requestAnimationFrame(() => {
            setZoomState(newState);
        });
    };

    // Pivot-based Zoom Logic
    const handleZoom = (direction: 'in' | 'out', mouseX?: number) => {
        const prev = zoomRef.current;
        const span = prev.right - prev.left;
        if (direction === 'in' && span <= 10) return;
        if (direction === 'out' && span >= chartData.length - 1) {
            updateZoomState({ left: 0, right: chartData.length - 1 });
            return;
        }

        const zoomFactor = direction === 'in' ? 0.75 : 1.33;
        let newSpan = Math.max(10, Math.floor(span * zoomFactor));
        if (newSpan >= chartData.length) newSpan = chartData.length - 1;

        const diff = span - newSpan;
        let focusRatio = 0.5;

        if (mouseX !== undefined && chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const chartX = mouseX - rect.left - 60;
            const chartWidth = rect.width - 60;

            if (chartX > 0 && chartX < chartWidth) {
                focusRatio = chartX / chartWidth;
            } else if (chartX <= 0) {
                focusRatio = 0;
            } else {
                focusRatio = 1;
            }
        }

        const leftDiff = Math.floor(diff * focusRatio);
        const rightDiff = diff - leftDiff;

        let newLeft = prev.left + leftDiff;
        let newRight = prev.right - rightDiff;

        if (newLeft < 0) {
            newLeft = 0;
            newRight = Math.min(chartData.length - 1, newLeft + newSpan);
        } else if (newRight > chartData.length - 1) {
            newRight = chartData.length - 1;
            newLeft = Math.max(0, newRight - newSpan);
        }

        updateZoomState({ left: newLeft, right: newRight });
    };

    const handleZoomIn = () => handleZoom('in');
    const handleZoomOut = () => handleZoom('out');

    const handlePan = (direction: 'left' | 'right') => {
        const prev = zoomRef.current;
        const span = prev.right - prev.left;
        const shift = Math.max(1, Math.floor(span * 0.1));
        if (direction === 'left') {
            const newLeft = Math.max(0, prev.left - shift);
            updateZoomState({ left: newLeft, right: Math.min(chartData.length - 1, newLeft + span) });
        } else {
            const newRight = Math.min(chartData.length - 1, prev.right + shift);
            updateZoomState({ left: Math.max(0, newRight - span), right: newRight });
        }
    };

    const handleResetZoom = () => {
        updateZoomState({ left: 0, right: chartData.length - 1 });
    };

    // Native Wheel Event
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || !isExpanded) return;

        let lastWheelTime = 0;
        const handleNativeWheel = (e: WheelEvent) => {
            e.preventDefault();
            const now = Date.now();
            if (now - lastWheelTime < 16) return;
            lastWheelTime = now;

            if (e.deltaY < -2) handleZoom('in', lastMouseX.current);
            else if (e.deltaY > 2) handleZoom('out', lastMouseX.current);
        };

        const handleNativeMouseMove = (e: MouseEvent) => {
            lastMouseX.current = e.clientX;
        };

        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        container.addEventListener('mousemove', handleNativeMouseMove);

        return () => {
            container.removeEventListener('wheel', handleNativeWheel);
            container.removeEventListener('mousemove', handleNativeMouseMove);
        };
    }, [isExpanded, chartData.length]);

    // Mouse Drag (Panning) Handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isExpanded || isBrushDragging.current) return;

        if (chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const containerHeight = rect.height;
            if (clickY > containerHeight - 60) {
                isBrushDragging.current = true;
                return;
            }
        }

        const target = e.target as HTMLElement;
        if (target && typeof target.closest === 'function' && target.closest('.recharts-brush')) {
            isBrushDragging.current = true;
            return;
        }

        setIsPanning(true);
        lastPanX.current = e.clientX;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isExpanded || !isPanning) return;

        const deltaX = e.clientX - lastPanX.current;
        const prev = zoomRef.current;
        const span = prev.right - prev.left;
        const pixelsPerPoint = Math.max(0.5, 800 / span);

        if (Math.abs(deltaX) > pixelsPerPoint) {
            const shiftCount = Math.abs(deltaX) / (pixelsPerPoint * 0.8);
            const direction = deltaX > 0 ? -1 : 1;
            const shift = Math.max(1, Math.floor(shiftCount)) * direction;

            let newLeft = prev.left + shift;
            let newRight = prev.right + shift;

            if (newLeft < 0) {
                newLeft = 0;
                newRight = span;
            } else if (newRight > chartData.length - 1) {
                newRight = chartData.length - 1;
                newLeft = newRight - span;
            }

            lastPanX.current = e.clientX;
            updateZoomState({ left: newLeft, right: newRight });
        }
    };

    const handleMouseUp = () => {
        setIsPanning(false);
        if (isBrushDragging.current) {
            isBrushDragging.current = false;
            setZoomState({ ...zoomRef.current });
        }
    };

    return (
        <div className={`bg-slate-900 border border-slate-800/90 rounded-xl shadow-lg flex flex-col transition-colors hover:border-slate-700/80 ${isExpanded ? 'h-full border-none shadow-none bg-transparent p-0' : 'h-[320px] p-4'}`}>
            {/* Header: Title on Left, Actions on Right */}
            <div className={`flex items-center justify-between gap-4 flex-shrink-0 ${isExpanded ? 'mb-4 pb-3 border-b border-slate-800/80 h-10' : 'mb-3 h-7'}`}>
                {/* Title and Zoom Controls */}
                <div className="flex items-center gap-4 min-w-0 flex-1">
                    <h3 className={`font-semibold text-slate-100 truncate ${isExpanded ? 'text-lg md:text-xl' : 'text-xs md:text-sm'}`} title={title}>
                        {title}
                    </h3>

                    {/* Zoom Controls (Visible only when Expanded) */}
                    {isExpanded && (
                        <div className="flex items-center gap-1 bg-slate-950/90 rounded-lg p-1 border border-slate-800 shadow-inner">
                            <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
                            <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-slate-800 mx-1" />
                            <button onClick={() => handlePan('left')} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Pan Left"><ArrowLeft className="w-4 h-4" /></button>
                            <button onClick={() => handlePan('right')} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Pan Right"><ArrowRight className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-slate-800 mx-1" />
                            <button onClick={handleResetZoom} className="p-1.5 hover:bg-slate-800 rounded text-slate-300 transition-colors" title="Reset Scale"><RotateCcw className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>

                {/* Actions */}
                {isExpanded ? (
                    <div className="flex items-center gap-3 flex-shrink-0">
                        {drillCategory && onDrilldown && (
                            <button
                                onClick={() => {
                                    const latest = chartData[chartData.length - 1]?.Date;
                                    if (latest) onDrilldown(latest, drillCategory);
                                }}
                                className="px-3 py-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg flex items-center gap-1.5 border border-slate-700/80 shadow-sm transition-colors"
                                title={`View constituent stocks for ${metric}`}
                            >
                                <Layers className="w-4 h-4 text-cyan-400" />
                                <span>Constituent Stocks</span>
                            </button>
                        )}

                        {onClose && (
                            <button
                                onClick={onClose}
                                className="p-1.5 bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg transition-colors border border-slate-700/80 shadow-sm"
                                title="Close Fullscreen (Esc)"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="flex items-center bg-slate-950/80 border border-slate-800/90 rounded-lg p-0.5 shadow-sm flex-shrink-0">
                        {drillCategory && onDrilldown && (
                            <button
                                onClick={() => {
                                    const latest = chartData[chartData.length - 1]?.Date;
                                    if (latest) onDrilldown(latest, drillCategory);
                                }}
                                className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-cyan-300 hover:bg-slate-800/80 transition-all"
                                title={`View Constituent Stocks (${metric})`}
                            >
                                <Layers className="w-3.5 h-3.5" />
                            </button>
                        )}

                        {drillCategory && onDrilldown && (
                            <div className="w-px h-3.5 bg-slate-800/80 my-auto" />
                        )}

                        <button
                            onClick={onExpand}
                            className="w-7 h-7 flex items-center justify-center rounded-md text-slate-400 hover:text-blue-300 hover:bg-slate-800/80 transition-all"
                            title="Expand to Fullscreen"
                        >
                            <Maximize2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}
            </div>

            <div
                ref={chartContainerRef}
                className={`flex-1 w-full min-h-0 ${isExpanded ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={() => setIsPanning(false)}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart 
                        data={chartData}
                        onClick={(e: any) => {
                            if (e && e.activePayload && e.activePayload.length > 0) {
                                const payloadDate = e.activePayload[0].payload.Date;
                                if (payloadDate && drillCategory && onDrilldown) {
                                    onDrilldown(payloadDate, drillCategory);
                                }
                            }
                        }}
                    >
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                        {isDiverging && (
                            <defs>
                                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset={gradientOffset} stopColor="#22c55e" stopOpacity={1} />
                                    <stop offset={gradientOffset} stopColor="#ef4444" stopOpacity={1} />
                                </linearGradient>
                            </defs>
                        )}

                        {/* Extreme Range Highlights */}
                        {showBanding && (
                            <>
                                <ReferenceArea y1={80} y2={100} fill={topAreaColor} fillOpacity={0.1} />
                                <ReferenceArea y1={0} y2={20} fill={bottomAreaColor} fillOpacity={0.1} />
                            </>
                        )}
                        {isRatio && (
                            <>
                                <ReferenceArea y1={4} y2={50} fill="#22c55e" fillOpacity={0.1} />
                                <ReferenceArea y1={0} y2={0.25} fill="#ef4444" fillOpacity={0.1} />
                            </>
                        )}

                        <XAxis
                            dataKey="Date"
                            stroke="#64748b"
                            fontSize={isExpanded ? 12 : 10}
                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { timeZone: 'UTC', month: 'short', day: 'numeric' })}
                            minTickGap={30}
                            height={isExpanded ? 40 : 30}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={isExpanded ? 12 : 10}
                            domain={['auto', 'auto']}
                            tickFormatter={(val) => val.toFixed(isRatio ? 2 : 1) + (isRatio ? '' : '%')}
                            width={isExpanded ? 60 : 40}
                        />

                        <Tooltip
                            content={<CustomTooltip title={title} isRatio={isRatio} signalFilter={signalFilter} />}
                        />

                        <Line
                            type="monotone"
                            dataKey="Value"
                            stroke={isDiverging ? `url(#${gradientId})` : color}
                            strokeWidth={isExpanded ? 3 : 2}
                            dot={false}
                            isAnimationActive={false}
                            activeDot={isDiverging
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                ? (props: any) => <circle cx={props.cx} cy={props.cy} r={isExpanded ? 6 : 4} fill={props.payload.Value >= threshold ? "#22c55e" : "#ef4444"} />
                                : { r: isExpanded ? 6 : 4, fill: color }
                            }
                        />

                        {/* Rendering Distinct Signal Overlays */}
                        {chartData.filter(d => (d.BuySignal || d.SwingBuySignal)).map(d => renderSignalMarker(d, isExpanded, signalFilter))}
                        {chartData.filter(d => (d.SellSignal || d.SwingSellSignal)).map(d => renderSellMarker(d, isExpanded, signalFilter))}

                        {metric === "Net New Highs" && (
                            <>
                                <ReferenceLine y={0} stroke="#374151" />
                                <ReferenceLine y={6.5} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '+6.5%', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={-3.0} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '-3.0%', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={8.0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '+8.0%', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={-6.5} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '-6.5%', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={10.0} stroke="#a855f7" strokeDasharray="3 3" strokeWidth={2} label={{ value: 'ALL OUT (+10%)', position: 'right', fill: '#a855f7', fontSize: 10, fontWeight: 'bold' }} />
                                <ReferenceLine y={-12.0} stroke="#a855f7" strokeDasharray="3 3" strokeWidth={2} label={{ value: 'ALL IN (-12%)', position: 'right', fill: '#a855f7', fontSize: 10, fontWeight: 'bold' }} />
                            </>
                        )}
                        {metric === "No of stocks above 200 day SMA" && (
                            <>
                                <ReferenceLine y={77.6} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '95th (77.6%)', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={17.0} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '5th (17.0%)', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={84.4} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '99th (84.4%)', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={12.3} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '1st (12.3%)', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                            </>
                        )}
                        {metric === "No of stocks above all 3 SMAs" && (
                            <>
                                <ReferenceLine y={53.7} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '95th (53.7%)', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={8.7} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '5th (8.7%)', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={67.6} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '99th (67.6%)', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={6.0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '1st (6.0%)', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                            </>
                        )}
                        {metric === "Advance/Decline Ratio" && <ReferenceLine y={1} stroke="#374151" />}

                        {/* Interactive Brush Control for Expanded View */}
                        {isExpanded && (
                            <Brush
                                dataKey="Date"
                                height={40}
                                stroke="#475569"
                                fill="#0f172a"
                                className="opacity-80"
                                tickFormatter={() => ""}
                                startIndex={zoomState.left}
                                endIndex={zoomState.right}
                                onChange={(range: any) => {
                                    if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
                                        let left = range.startIndex;
                                        let right = range.endIndex;
                                        if (right - left < 10) {
                                            if (left + 10 < chartData.length) right = left + 10;
                                            else {
                                                right = chartData.length - 1;
                                                left = Math.max(0, right - 10);
                                            }
                                        }
                                        updateZoomState({ left, right });
                                    }
                                }}
                            />
                        )}

                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}

const ChartCard = React.memo(ChartCardComponent);
