"use client"

import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, ReferenceDot, Brush } from 'recharts';
import { METRIC_CONFIG, MarketData, DRILLDOWN_METRICS } from './Heatmap';
import { DrilldownModal, DrilldownCategory, YearDrilldownMap } from './DrilldownModal';
import { ArrowLeft, Calendar, Maximize2, X, ZoomIn, ZoomOut, RotateCcw, ArrowRight, Layers } from 'lucide-react';
import Link from 'next/link';

interface ChartsViewProps {
    initialData: MarketData[];
    hideHeader?: boolean;
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
        const d = new Date(maxDate);
        d.setFullYear(d.getFullYear() - 1);
        const calcStart = d.toISOString().split('T')[0];
        return calcStart >= minDate ? calcStart : minDate;
    }, [maxDate, minDate]);

    // 2. State
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(maxDate);
    const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

    // Quick timeframe presets
    const handleSetTimeframe = (preset: '6M' | '1Y' | '3Y' | '5Y' | 'ALL') => {
        const end = new Date(maxDate);
        setEndDate(maxDate);
        if (preset === 'ALL') {
            setStartDate(minDate);
            return;
        }
        const start = new Date(maxDate);
        if (preset === '6M') start.setMonth(start.getMonth() - 6);
        if (preset === '1Y') start.setFullYear(start.getFullYear() - 1);
        if (preset === '3Y') start.setFullYear(start.getFullYear() - 3);
        if (preset === '5Y') start.setFullYear(start.getFullYear() - 5);

        const strStart = start.toISOString().split('T')[0];
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
                const res = await fetch(`/drilldowns/${year}.json?v=${Date.now()}`, { cache: 'no-store' });
                if (res.ok) {
                    const json: YearDrilldownMap = await res.json();
                    setYearCache(prev => ({ ...prev, [year]: json }));
                }
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
    };

    const metrics = Object.keys(METRIC_CONFIG);

    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            {!hideHeader ? (
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-slate-900 p-3 px-4 rounded-2xl border border-slate-800 sticky top-3 z-40 shadow-xl">
                    {/* Left: Brand Identity + Navigation Tabs */}
                    <div className="flex flex-wrap items-center gap-4">
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

                        <div className="h-5 w-px bg-slate-800 hidden sm:block" />

                        {/* Navigation Tabs */}
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

                    {/* Right: Timeframe Presets, Date Pickers & Reset */}
                    <div className="flex flex-wrap items-center gap-2">
                        {/* Timeframe Presets */}
                        <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                            {(['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'] as const).map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => {
                                        if (preset === '1M') {
                                            const end = new Date(maxDate);
                                            end.setMonth(end.getMonth() - 1);
                                            setStartDate(end.toISOString().split('T')[0]);
                                            setEndDate(maxDate);
                                        } else if (preset === '3M') {
                                            const end = new Date(maxDate);
                                            end.setMonth(end.getMonth() - 3);
                                            setStartDate(end.toISOString().split('T')[0]);
                                            setEndDate(maxDate);
                                        } else if (preset === 'YTD') {
                                            const y = new Date(maxDate).getFullYear();
                                            setStartDate(`${y}-01-01`);
                                            setEndDate(maxDate);
                                        } else {
                                            handleSetTimeframe(preset as any);
                                        }
                                    }}
                                    className="px-2 py-1 rounded font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        {/* Date Inputs */}
                        <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-lg border border-slate-800 text-xs font-mono">
                            <input
                                type="date"
                                value={startDate}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                onClick={(e) => e.currentTarget.showPicker()}
                                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer w-24"
                            />
                            <span className="text-slate-600 text-xs">→</span>
                            <input
                                type="date"
                                value={endDate}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                onClick={(e) => e.currentTarget.showPicker()}
                                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer w-24"
                            />
                        </div>

                        {/* Reset Button */}
                        <button
                            onClick={handleReset}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                            title="Reset Date Range to 1Y"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span>Reset</span>
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 p-3 px-4.5 rounded-2xl border border-slate-800 shadow-xl">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
                            <LineChart className="w-4 h-4 text-emerald-400" />
                            <span>Synchronized Breadth Studio ({filteredData.length} sessions)</span>
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                        {/* Timeframe Presets */}
                        <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
                            {(['1M', '3M', '6M', 'YTD', '1Y', '3Y', 'ALL'] as const).map((preset) => (
                                <button
                                    key={preset}
                                    onClick={() => {
                                        if (preset === '1M') {
                                            const end = new Date(maxDate);
                                            end.setMonth(end.getMonth() - 1);
                                            setStartDate(end.toISOString().split('T')[0]);
                                            setEndDate(maxDate);
                                        } else if (preset === '3M') {
                                            const end = new Date(maxDate);
                                            end.setMonth(end.getMonth() - 3);
                                            setStartDate(end.toISOString().split('T')[0]);
                                            setEndDate(maxDate);
                                        } else if (preset === 'YTD') {
                                            const y = new Date(maxDate).getFullYear();
                                            setStartDate(`${y}-01-01`);
                                            setEndDate(maxDate);
                                        } else {
                                            handleSetTimeframe(preset as any);
                                        }
                                    }}
                                    className="px-3 py-1 rounded-lg text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-850 transition-all cursor-pointer"
                                >
                                    {preset}
                                </button>
                            ))}
                        </div>

                        {/* Date Inputs */}
                        <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
                            <Calendar className="w-3.5 h-3.5 text-slate-500" />
                            <input
                                type="date"
                                value={startDate}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                onClick={(e) => e.currentTarget.showPicker()}
                                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer w-24"
                            />
                            <span className="text-slate-600 text-xs">→</span>
                            <input
                                type="date"
                                value={endDate}
                                min={minDate}
                                max={maxDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                onClick={(e) => e.currentTarget.showPicker()}
                                className="bg-transparent text-slate-200 text-xs focus:outline-none cursor-pointer w-24"
                            />
                        </div>

                        {/* Reset Button */}
                        <button
                            onClick={handleReset}
                            className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 text-slate-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 border border-slate-800 cursor-pointer"
                            title="Reset Date Range to 1Y"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-slate-400" />
                            <span>Reset</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {metrics.map(metric => (
                    <ChartCard
                        key={metric}
                        metric={metric}
                        data={filteredData}
                        onExpand={() => setExpandedMetric(metric)}
                        onDrilldown={openDrilldown}
                    />
                ))}
            </div>

            {/* Expanded Modal */}
            {expandedMetric && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 overscroll-contain">
                    <div className="bg-slate-900 border border-slate-800 rounded-2xl w-[95vw] h-[90vh] flex flex-col shadow-2xl overflow-hidden relative p-6 md:p-8 transform-gpu">
                        <ChartCard
                            metric={expandedMetric}
                            data={filteredData}
                            isExpanded={true}
                            onDrilldown={openDrilldown}
                            onClose={() => setExpandedMetric(null)}
                        />
                    </div>
                    <div className="absolute inset-0 -z-10" onClick={() => setExpandedMetric(null)} />
                </div>
            )}

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

// Fast peak-and-signal preserving decimation for instant grid rendering
function decimateChartData<T extends { Date: string; Value: number; BuySignal?: boolean; SellSignal?: boolean }>(
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
            if (pt.BuySignal || pt.SellSignal) signals.push(pt);
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

function ChartCardComponent({ 
    metric, 
    data, 
    onExpand, 
    isExpanded = false,
    onDrilldown,
    onClose
}: { 
    metric: string, 
    data: MarketData[], 
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
    const signalMap: Record<string, { buy: string, sell: string, prob: string }> = {
        "No of stocks above 50 day SMA": { buy: "Bullseye_Buy_Signal", sell: "Bullseye_Sell_Signal", prob: "Buy_Reversal_Prob" },
        "Net New Highs": { buy: "Bull_NNH_Buy", sell: "Bull_NNH_Sell", prob: "Bull_NNH_Prob" },
        "No of stocks above 200 day SMA": { buy: "Bull_200SMA_Buy", sell: "Bull_200SMA_Sell", prob: "Bull_200SMA_Prob" },
        "No of stocks above all 3 SMAs": { buy: "Bull_AllSMA_Buy", sell: "Bull_AllSMA_Sell", prob: "Bull_AllSMA_Prob" },
    };
    const signals = signalMap[metric];

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

            return {
                Date: d.Date,
                Value: val,
                Original: rawVal,
                Total: d.TotalTraded,
                BuySignal: signals ? d[signals.buy] : false,
                SellSignal: signals ? d[signals.sell] : false,
                BuyProb: signals ? d[signals.prob] : 0,
                SellProb: signals ? d[signals.prob] : 0
            };
        });
    }, [data, metric, isRatio, signals]);

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

        return (dataMax - threshold) / (dataMax - dataMin);
    }, [chartData, isDiverging, threshold]);

    const isBadMetric = config.type === 'bad';
    const topAreaColor = isBadMetric ? "#ef4444" : "#22c55e";
    const bottomAreaColor = isBadMetric ? "#22c55e" : "#ef4444";

    // Gradient ID
    const gradientId = `splitColor-${metric.replace(/\s+/g, '')}`;

    // Banding logic: Show if NOT Ratio AND NOT 4.5% metrics AND NOT 20% metrics AND NOT Net New Highs
    const showBanding = !isRatio && !metric.includes("4.5%") && !metric.includes("20%+") && metric !== "Net New Highs";

    // State for Zoom/Pan
    const [zoomState, setZoomState] = useState<{ left: number, right: number }>({ left: 0, right: 0 });
    const zoomRef = useRef<{ left: number, right: number }>({ left: 0, right: 0 }); // Single source of truth for high-frequency updates
    const [isPanning, setIsPanning] = useState(false);
    const isBrushDragging = useRef(false); // Track active Brush drag to isolate from panning
    const lastPanX = useRef(0);
    const lastMouseX = useRef(0); // Track hover position for pivot zoom
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
        if (direction === 'in' && span <= 10) return; // Max zoom limit
        if (direction === 'out' && span >= chartData.length - 1) {
            updateZoomState({ left: 0, right: chartData.length - 1 });
            return;
        }

        const zoomFactor = direction === 'in' ? 0.75 : 1.33;
        let newSpan = Math.max(10, Math.floor(span * zoomFactor)); // Enforce minimum span to prevent frozen zoom states
        if (newSpan >= chartData.length) newSpan = chartData.length - 1;

        const diff = span - newSpan;

        // Default center if no mouse position provided
        let focusRatio = 0.5;

        // Calculate focus ratio based on mouse position within the container bounds
        if (mouseX !== undefined && chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            // Rough estimate accounting for Y-axis width (approx 60px)
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

        // Distribute the zoom diff based on the focus ratio
        const leftDiff = Math.floor(diff * focusRatio);
        const rightDiff = diff - leftDiff;

        let newLeft = prev.left + leftDiff;
        let newRight = prev.right - rightDiff;

        // Boundary checks
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
        // Adaptive pan shift based on current zoom level
        const shift = Math.max(1, Math.floor(span * 0.1)); // 10% smoother panning
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
    }

    // Native Wheel Event to prevent background scrolling
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || !isExpanded) return;

        let lastWheelTime = 0;
        const handleNativeWheel = (e: WheelEvent) => {
            e.preventDefault(); // Stop page scrolling

            // Debounce actual zoom calculation slightly to avoid jumping by too many frames
            const now = Date.now();
            if (now - lastWheelTime < 16) return; // ~60fps Limit
            lastWheelTime = now;

            if (e.deltaY < -2) handleZoom('in', lastMouseX.current);
            else if (e.deltaY > 2) handleZoom('out', lastMouseX.current);
        };

        // Track hover position for zoom pivot
        const handleNativeMouseMove = (e: MouseEvent) => {
            lastMouseX.current = e.clientX;
        };

        // passive: false is REQUIRED to allow preventDefault
        container.addEventListener('wheel', handleNativeWheel, { passive: false });
        container.addEventListener('mousemove', handleNativeMouseMove);

        return () => {
            container.removeEventListener('wheel', handleNativeWheel);
            container.removeEventListener('mousemove', handleNativeMouseMove);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExpanded, chartData.length]);

    // Mouse Drag (Panning) Handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isExpanded) return;
        // If the Brush is being dragged, don't start panning
        if (isBrushDragging.current) return;

        // Block panning if clicking in the Brush zone (bottom 60px of the container)
        if (chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const containerHeight = rect.height;
            if (clickY > containerHeight - 60) {
                isBrushDragging.current = true;
                return;
            }
        }

        // Also check SVG class as fallback
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

        // Adaptive sensitivity based on zoom level (increase sensitivity for smoother panning)
        const pixelsPerPoint = Math.max(0.5, 800 / span);

        if (Math.abs(deltaX) > pixelsPerPoint) {
            // Finer shift resolution
            const shiftCount = Math.abs(deltaX) / (pixelsPerPoint * 0.8); // 0.8 multiplier makes it slightly faster
            const direction = deltaX > 0 ? -1 : 1;
            // Accumulate fractional shifts to integer boundaries
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
        // If the Brush was being dragged, sync the final position to state
        if (isBrushDragging.current) {
            isBrushDragging.current = false;
            setZoomState({ ...zoomRef.current });
        }
    };
    const handleMouseLeave = () => { setIsPanning(false); };

    // Global mouseup listener to catch brush drag release even outside the container
    useEffect(() => {
        const handleGlobalMouseUp = () => {
            if (isBrushDragging.current) {
                isBrushDragging.current = false;
                setZoomState({ ...zoomRef.current });
            }
        };
        window.addEventListener('mouseup', handleGlobalMouseUp);
        return () => window.removeEventListener('mouseup', handleGlobalMouseUp);
    }, []);

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

                {/* Actions: Clean Full-Bar when Expanded, Dock when Grid */}
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
                onMouseLeave={handleMouseLeave}
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
                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
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
                            contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', color: '#f8fafc' }}
                            itemStyle={{ color: '#f8fafc' }}
                            labelStyle={{ color: '#94a3b8' }}
                            formatter={(value: number | string | Array<number | string> | undefined, name: any, props: any) => {
                                const val = Number(value);
                                const isBuy = props.payload?.BuySignal;
                                const isSell = props.payload?.SellSignal;
                                const buyProb = props.payload?.BuyProb;
                                const sellProb = props.payload?.SellProb;

                                let label = (isNaN(val) ? value : val.toFixed(2)) + (isRatio ? '' : '%');
                                if (isBuy) label += ` 🟢 B_BUY (${buyProb?.toFixed(1) || '99.0'}% Prob)`;
                                if (isSell) label += ` 🔴 B_SELL (${sellProb?.toFixed(1) || '99.0'}% Prob)`;

                                return [
                                    label,
                                    title
                                ];
                            }}
                            labelFormatter={(label) => {
                                return new Date(label).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
                            }}
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

                        {/* Rendering Bullseye Signals as Overlays */}
                        {chartData.filter(d => d.BuySignal).map((d) => (
                            <ReferenceDot
                                key={`buy-${d.Date}`}
                                x={d.Date}
                                y={d.Value}
                                r={isExpanded ? 8 : 5}
                                fill="#22c55e"
                                stroke="#000"
                                strokeWidth={2}
                            />
                        ))}
                        {chartData.filter(d => d.SellSignal).map((d) => (
                            <ReferenceDot
                                key={`sell-${d.Date}`}
                                x={d.Date}
                                y={d.Value}
                                r={isExpanded ? 8 : 5}
                                fill="#ef4444"
                                stroke="#000"
                                strokeWidth={2}
                            />
                        ))}

                        {metric === "Net New Highs" && (
                            <>
                                <ReferenceLine y={0} stroke="#374151" />
                                {/* Amber (Warning): 10% Probability */}
                                <ReferenceLine y={6.5} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '+6.5%', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={-3.0} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '-3.0%', position: 'right', fill: '#f59e0b', fontSize: 10 }} />

                                {/* Red (Extreme): 5% Probability */}
                                <ReferenceLine y={8.0} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '+8.0%', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={-6.5} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '-6.5%', position: 'right', fill: '#ef4444', fontSize: 10 }} />

                                {/* Purple (All-In / All-Out): ~1% Probability */}
                                <ReferenceLine y={10.0} stroke="#a855f7" strokeDasharray="3 3" strokeWidth={2} label={{ value: 'ALL OUT (+10%)', position: 'right', fill: '#a855f7', fontSize: 10, fontWeight: 'bold' }} />
                                <ReferenceLine y={-12.0} stroke="#a855f7" strokeDasharray="3 3" strokeWidth={2} label={{ value: 'ALL IN (-12%)', position: 'right', fill: '#a855f7', fontSize: 10, fontWeight: 'bold' }} />
                            </>
                        )}
                        {metric === "No of stocks above 200 day SMA" && (
                            <>
                                {/* Amber (Warning): 95th and 5th Percentile */}
                                <ReferenceLine y={77.6} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '95th (77.6%)', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={17.0} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '5th (17.0%)', position: 'right', fill: '#f59e0b', fontSize: 10 }} />

                                {/* Red (Extreme): 99th and 1st Percentile */}
                                <ReferenceLine y={84.4} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '99th (84.4%)', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                                <ReferenceLine y={12.3} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: '1st (12.3%)', position: 'right', fill: '#ef4444', fontSize: 10 }} />
                            </>
                        )}
                        {metric === "No of stocks above all 3 SMAs" && (
                            <>
                                {/* Amber (Warning): 95th and 5th Percentile */}
                                <ReferenceLine y={53.7} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '95th (53.7%)', position: 'right', fill: '#f59e0b', fontSize: 10 }} />
                                <ReferenceLine y={8.7} stroke="#f59e0b" strokeDasharray="3 3" strokeWidth={1} label={{ value: '5th (8.7%)', position: 'right', fill: '#f59e0b', fontSize: 10 }} />

                                {/* Red (Extreme): 99th and 1st Percentile */}
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
                                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                                onChange={(range: any) => {
                                    if (range && range.startIndex !== undefined && range.endIndex !== undefined) {
                                        let left = range.startIndex;
                                        let right = range.endIndex;
                                        // Enforce 10-day minimum
                                        if (right - left < 10) {
                                            if (left + 10 < chartData.length) right = left + 10;
                                            else {
                                                right = chartData.length - 1;
                                                left = Math.max(0, right - 10);
                                            }
                                        }
                                        // ONLY update ref during drag — NO setState, NO re-render.
                                        // This preserves the Brush's internal drag tracking.
                                        // State is synced on mouseup via handleMouseUp/handleGlobalMouseUp.
                                        zoomRef.current = { left, right };
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
