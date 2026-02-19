"use client"

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea, Brush } from 'recharts';
import { METRIC_CONFIG, MarketData } from './Heatmap';
import { ArrowLeft, Calendar, Maximize2, X, ZoomIn, ZoomOut, RotateCcw, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface ChartsViewProps {
    initialData: MarketData[];
}

export function ChartsView({ initialData }: ChartsViewProps) {
    // 1. Data Prep & Range Calculation (Same as DashboardClient)
    const allSorted = useMemo(() =>
        [...initialData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()), // Descending for calculations
        [initialData]);

    const maxDate = allSorted[0]?.Date || new Date().toISOString().split('T')[0];
    const minDate = allSorted[allSorted.length - 1]?.Date || "2022-01-01";

    // Default to FULL range
    const defaultStart = minDate;

    // 2. State
    const [startDate, setStartDate] = useState(defaultStart);
    const [endDate, setEndDate] = useState(maxDate);
    const [expandedMetric, setExpandedMetric] = useState<string | null>(null);

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
        setStartDate(minDate);
        setEndDate(maxDate);
    }

    const metrics = Object.keys(METRIC_CONFIG);

    return (
        <div className="space-y-6">
            {/* Header / Controls */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 p-4 rounded-xl border border-slate-800 backdrop-blur-sm sticky top-4 z-40 shadow-xl">
                <div className="flex items-center gap-4">
                    <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors group">
                        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
                        <span className="font-medium">Back</span>
                    </Link>
                    <div className="h-6 w-px bg-slate-800" />
                    <h2 className="text-slate-200 font-semibold hidden md:block">Time Series</h2>
                </div>

                {/* Date Controls (Matching Page 1 Style) */}
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            min={minDate}
                            max={maxDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            onClick={(e) => e.currentTarget.showPicker()}
                            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-slate-700 transition-colors"
                        />
                    </div>
                    <div className="flex flex-col gap-1">
                        <label className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">End Date</label>
                        <input
                            type="date"
                            value={endDate}
                            min={minDate}
                            max={maxDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            onClick={(e) => e.currentTarget.showPicker()}
                            className="bg-slate-950 border border-slate-800 rounded px-3 py-1.5 text-sm text-slate-200 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer hover:border-slate-700 transition-colors"
                        />
                    </div>

                    <button
                        onClick={handleReset}
                        className="md:mt-5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded transition-colors flex items-center gap-2"
                        title="Reset Date Range"
                    >
                        <Calendar className="w-3.5 h-3.5" />
                    </button>

                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {metrics.map(metric => (
                    <ChartCard
                        key={metric}
                        metric={metric}
                        data={filteredData}
                        onExpand={() => setExpandedMetric(metric)}
                    />
                ))}
            </div>

            {/* Expanded Modal */}
            {expandedMetric && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-[95vw] h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
                        {/* Close Button */}
                        <button
                            onClick={() => setExpandedMetric(null)}
                            className="absolute top-4 right-4 p-2 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors z-10"
                        >
                            <X className="w-6 h-6" />
                        </button>

                        <div className="p-6 md:p-8 flex-1 min-h-0">
                            <ChartCard
                                metric={expandedMetric}
                                data={filteredData}
                                isExpanded={true}
                            />
                        </div>
                    </div>
                    <div className="absolute inset-0 -z-10" onClick={() => setExpandedMetric(null)} />
                </div>
            )}
        </div>
    );
}

function ChartCard({ metric, data, onExpand, isExpanded = false }: { metric: string, data: MarketData[], onExpand?: () => void, isExpanded?: boolean }) {
    const isRatio = metric === "Advance/Decline Ratio";
    const isNetNewHighs = metric === "Net New Highs";
    const config = METRIC_CONFIG[metric];

    // Process data for this chart
    const chartData = useMemo(() => {
        return data.map(d => {
            const rawVal = d[metric];
            // If it's the Ratio, keep raw. 
            // If it's anything else, convert to % of TotalTraded.
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
                Total: d.TotalTraded
            };
        });
    }, [data, metric, isRatio]);

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
    const isPanning = useRef(false);
    const lastPanX = useRef(0);
    const lastMouseX = useRef(0); // Track hover position for pivot zoom
    const wheelTimeout = useRef<NodeJS.Timeout | null>(null);
    const chartContainerRef = useRef<HTMLDivElement>(null);

    // Initialize zoom on data load or expand
    useEffect(() => {
        if (chartData.length > 0) {
            setZoomState({ left: 0, right: chartData.length - 1 });
        }
    }, [chartData.length]);

    // Pivot-based Zoom Logic
    const handleZoom = (direction: 'in' | 'out', mouseX?: number) => {
        setZoomState(prev => {
            const span = prev.right - prev.left;
            if (direction === 'in' && span <= 10) return prev; // Max zoom limit
            if (direction === 'out' && span >= chartData.length - 1) return { left: 0, right: chartData.length - 1 };

            const zoomFactor = direction === 'in' ? 0.75 : 1.33;
            let newSpan = Math.floor(span * zoomFactor);
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

            return { left: newLeft, right: newRight };
        });
    };

    const handleZoomIn = () => handleZoom('in');
    const handleZoomOut = () => handleZoom('out');

    const handlePan = (direction: 'left' | 'right') => {
        setZoomState(prev => {
            const span = prev.right - prev.left;
            // Adaptive pan shift based on current zoom level
            const shift = Math.max(1, Math.floor(span * 0.1)); // 10% smoother panning
            if (direction === 'left') {
                const newLeft = Math.max(0, prev.left - shift);
                return { left: newLeft, right: Math.min(chartData.length - 1, newLeft + span) };
            } else {
                const newRight = Math.min(chartData.length - 1, prev.right + shift);
                return { left: Math.max(0, newRight - span), right: newRight };
            }
        });
    };

    const handleResetZoom = () => {
        setZoomState({ left: 0, right: chartData.length - 1 });
    }

    // Native Wheel Event to prevent background scrolling
    useEffect(() => {
        const container = chartContainerRef.current;
        if (!container || !isExpanded) return;

        const handleNativeWheel = (e: WheelEvent) => {
            e.preventDefault(); // Stop page scrolling
            if (wheelTimeout.current) return;

            if (e.deltaY < -5) handleZoom('in', lastMouseX.current);
            else if (e.deltaY > 5) handleZoom('out', lastMouseX.current);

            wheelTimeout.current = setTimeout(() => {
                wheelTimeout.current = null;
            }, 30); // smooth 30ms throttle
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
    }, [isExpanded, chartData.length]);

    // Mouse Drag (Panning) Handlers
    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isExpanded) return;
        isPanning.current = true;
        lastPanX.current = e.clientX;
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        if (!isExpanded || !isPanning.current) return;

        const deltaX = e.clientX - lastPanX.current;

        setZoomState(prev => {
            const span = prev.right - prev.left;
            // Adaptive sensitivity based on zoom level (increase sensitivity for smoother panning)
            const pixelsPerPoint = Math.max(0.5, 800 / span);

            if (Math.abs(deltaX) > pixelsPerPoint) {
                // Finer shift resolution
                const shiftCount = Math.abs(deltaX) / pixelsPerPoint;
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
                return { left: newLeft, right: newRight };
            }
            return prev;
        });
    };

    const handleMouseUp = () => { isPanning.current = false; };
    const handleMouseLeave = () => { isPanning.current = false; };

    // Explicitly slice data for the chart to force re-render and fix slider lag
    const visibleData = isExpanded ? chartData.slice(zoomState.left, zoomState.right + 1) : chartData;

    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex flex-col ${isExpanded ? 'h-full border-none shadow-none bg-transparent' : 'h-[300px] p-4'}`}>
            <div className="flex items-center justify-between mb-4 px-1">
                {/* Title and Controls */}
                <div className="flex items-center gap-4">
                    <h3 className={`font-medium text-slate-200 truncate pr-4 ${isExpanded ? 'text-xl md:text-2xl' : 'text-sm'}`} title={title}>
                        {title}
                    </h3>

                    {/* Zoom Controls (Visible only when Expanded) */}
                    {isExpanded && (
                        <div className="flex items-center gap-1 bg-slate-800 rounded-lg p-1 border border-slate-700">
                            <button onClick={handleZoomIn} className="p-1.5 hover:bg-slate-700 rounded text-slate-300" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
                            <button onClick={handleZoomOut} className="p-1.5 hover:bg-slate-700 rounded text-slate-300" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-slate-700 mx-1" />
                            <button onClick={() => handlePan('left')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300" title="Pan Left"><ArrowLeft className="w-4 h-4" /></button>
                            <button onClick={() => handlePan('right')} className="p-1.5 hover:bg-slate-700 rounded text-slate-300" title="Pan Right"><ArrowRight className="w-4 h-4" /></button>
                            <div className="w-px h-4 bg-slate-700 mx-1" />
                            <button onClick={handleResetZoom} className="p-1.5 hover:bg-slate-700 rounded text-slate-300" title="Reset Scale"><RotateCcw className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>

                {!isExpanded && (
                    <button
                        onClick={onExpand}
                        className="text-slate-500 hover:text-blue-400 transition-colors p-1"
                        title="Expand Chart"
                    >
                        <Maximize2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            <div
                ref={chartContainerRef}
                className={`flex-1 w-full min-h-0 ${isExpanded ? (isPanning.current ? 'cursor-grabbing' : 'cursor-grab') : ''}`}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseLeave}
            >
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={visibleData}>
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
                            formatter={(value: number | string | Array<number | string> | undefined) => {
                                const val = Number(value);
                                return [
                                    (isNaN(val) ? value : val.toFixed(2)) + (isRatio ? '' : '%'),
                                    isRatio ? "Ratio" : "Percentage"
                                ];
                            }}
                            labelFormatter={(label) => {
                                if (!label) return '';
                                return new Date(label).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' });
                            }}
                        />
                        <Line
                            type="monotone"
                            dataKey="Value"
                            stroke={isDiverging ? `url(#${gradientId})` : color}
                            strokeWidth={isExpanded ? 3 : 2}
                            dot={false}
                            activeDot={isDiverging
                                ? (props: any) => <circle cx={props.cx} cy={props.cy} r={isExpanded ? 6 : 4} fill={props.payload.Value >= threshold ? "#22c55e" : "#ef4444"} />
                                : { r: isExpanded ? 6 : 4, fill: color }
                            }
                        />

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
                                    if (!isPanning.current && range && range.startIndex !== undefined && range.endIndex !== undefined) {
                                        setZoomState({ left: range.startIndex, right: range.endIndex });
                                    }
                                }}
                            />
                        )}

                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
