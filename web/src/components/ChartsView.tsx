"use client"

import React, { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, ReferenceArea } from 'recharts';
import { METRIC_CONFIG, MarketData } from './Heatmap';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ChartsViewProps {
    initialData: MarketData[];
}

export function ChartsView({ initialData }: ChartsViewProps) {
    // 1. Sort Data Ascending for Charts (Timeline)
    const sortedData = useMemo(() =>
        [...initialData].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime()),
        [initialData]);

    // 2. Prepare Metrics
    const metrics = Object.keys(METRIC_CONFIG);

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <Link href="/" className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to Heatmap
                </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {metrics.map(metric => (
                    <ChartCard key={metric} metric={metric} data={sortedData} />
                ))}
            </div>
        </div>
    );
}

function ChartCard({ metric, data }: { metric: string, data: MarketData[] }) {
    const isRatio = metric === "Advance/Decline Ratio";
    const config = METRIC_CONFIG[metric];

    // Process data for this chart
    const chartData = useMemo(() => {
        return data.map(d => {
            const rawVal = d[metric];
            // If it's the Ratio, keep raw. 
            // If it's anything else, convert to % of TotalTraded.
            let val = rawVal;

            if (!isRatio && d.TotalTraded) {
                // Ensure rawVal is valid
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
                // store original for tooltip if needed
                Original: rawVal,
                Total: d.TotalTraded
            };
        });
    }, [data, metric, isRatio]);

    const title = isRatio ? metric : `${metric} (%)`;
    const color = config.type === 'bad' ? '#ef4444' : '#22c55e';

    // Highlight Colors logic
    // If metric is 'good' (e.g. SMA): High (80-100) is Good (Green), Low (0-20) is Bad (Red)
    // If metric is 'bad' (e.g. Down 4%): High (80-100) is Bad (Red), Low (0-20) is Good (Green)
    // If metric is 'diverging' (e.g. A/D Ratio, Net New Highs): Let's stick to standard 'good'=High interpretation for now, or just neutral.
    // Actually, A/D Ratio is excluded from highlights. Net New Highs is 'diverging'.
    // For Net New Highs (diverging), usually > 0 is good. Logic below handles 'bad' type specifically.

    const isBadMetric = config.type === 'bad';

    const topAreaColor = isBadMetric ? "#ef4444" : "#22c55e";
    const bottomAreaColor = isBadMetric ? "#22c55e" : "#ef4444";

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-col h-[300px]">
            <h3 className="text-sm font-medium text-slate-400 mb-4 px-2 truncate" title={title}>
                {title}
            </h3>
            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />

                        {/* Extreme Range Highlights */}
                        {/* Case 1: Percentages (0-100 scale) */}
                        {!isRatio && (
                            <>
                                <ReferenceArea y1={80} y2={100} fill={topAreaColor} fillOpacity={0.1} />
                                <ReferenceArea y1={0} y2={20} fill={bottomAreaColor} fillOpacity={0.1} />
                            </>
                        )}
                        {/* Case 2: Ratio (Logarithmic-like scale extremes)
                            80% Advancers => Ratio 4.0 (80/20)
                            20% Advancers => Ratio 0.25 (20/80) 
                        */}
                        {isRatio && (
                            <>
                                <ReferenceArea y1={4} y2={50} fill="#22c55e" fillOpacity={0.1} />
                                <ReferenceArea y1={0} y2={0.25} fill="#ef4444" fillOpacity={0.1} />
                            </>
                        )}

                        <XAxis
                            dataKey="Date"
                            stroke="#64748b"
                            fontSize={10}
                            tickFormatter={(val) => new Date(val).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#64748b"
                            fontSize={10}
                            domain={['auto', 'auto']}
                            tickFormatter={(val) => val.toFixed(isRatio ? 2 : 1) + (isRatio ? '' : '%')}
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
                            labelFormatter={(label) => new Date(label).toLocaleDateString()}
                        />
                        <Line
                            type="monotone"
                            dataKey="Value"
                            stroke={color}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4, fill: color }}
                        />
                        {/* Reference lines for zero/parity */}
                        {metric === "Net New Highs" && <ReferenceLine y={0} stroke="#374151" />}
                        {metric === "Advance/Decline Ratio" && <ReferenceLine y={1} stroke="#374151" />}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    )
}
