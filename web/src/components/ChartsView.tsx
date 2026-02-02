"use client"

import React, { useMemo, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { METRIC_CONFIG, MarketData } from './Heatmap';
import { ArrowLeft, Calendar, Maximize2, X } from 'lucide-react';
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
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
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

    // Gradient Offset for Net New Highs
    const gradientOffset = useMemo(() => {
        if (!isNetNewHighs || chartData.length === 0) return 0;

        const dataMax = Math.max(...chartData.map((i) => i.Value));
        const dataMin = Math.min(...chartData.map((i) => i.Value));

        if (dataMax <= 0) return 0;
        if (dataMin >= 0) return 1;

        return dataMax / (dataMax - dataMin);
    }, [chartData, isNetNewHighs]);

    const isBadMetric = config.type === 'bad';
    const topAreaColor = isBadMetric ? "#ef4444" : "#22c55e";
    const bottomAreaColor = isBadMetric ? "#22c55e" : "#ef4444";

    // Banding logic: Show if NOT Ratio AND NOT 4.5% metrics
    const showBanding = !isRatio && !metric.includes("4.5%");

    return (
        <div className={`bg-slate-900 border border-slate-800 rounded-xl shadow-lg flex flex-col ${isExpanded ? 'h-full border-none shadow-none bg-transparent' : 'h-[300px] p-4'}`}>
            <div className="flex items-center justify-between mb-4 px-1">
                <h3 className={`font-medium text-slate-200 truncate pr-4 ${isExpanded ? 'text-xl md:text-2xl' : 'text-sm'}`} title={title}>
                    {title}
                </h3>
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

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                        {isNetNewHighs && (
                            <defs>
                                <linearGradient id="splitColorNetHighs" x1="0" y1="0" x2="0" y2="1">
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
                            labelFormatter={(label) => new Date(label).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'long', day: 'numeric' })}
                        />
                        <Line
                            type="monotone"
                            dataKey="Value"
                            stroke={isNetNewHighs ? "url(#splitColorNetHighs)" : color}
                            strokeWidth={isExpanded ? 3 : 2}
                            dot={false}
                            activeDot={isNetNewHighs
                                ? (props: any) => <circle cx={props.cx} cy={props.cy} r={isExpanded ? 6 : 4} fill={props.payload.Value >= 0 ? "#22c55e" : "#ef4444"} />
                                : { r: isExpanded ? 6 : 4, fill: color }
                            }
                        />

                        {metric === "Net New Highs" && <ReferenceLine y={0} stroke="#374151" />}
                        {metric === "Advance/Decline Ratio" && <ReferenceLine y={1} stroke="#374151" />}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
