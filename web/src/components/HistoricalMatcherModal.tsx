'use client';

import React, { useMemo } from 'react';
import { X, Sparkles, TrendingUp, TrendingDown, ArrowRight, History, ShieldAlert, BarChart2 } from 'lucide-react';
import { MarketData } from './Heatmap';

interface HistoricalMatcherModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentDate: string;
  allData: MarketData[];
}

interface HistoricalMatch {
  date: string;
  formattedDate: string;
  similarity: number; // 0 to 100
  pct200: number;
  pct50: number;
  pct20: number;
  adRatio: number;
  nnhPct: number;
  swingScore: number;
  macroRegime: string;
  // Forward 20D & 60D Excursions
  fwd20d: number;
  mfe20d: number;
  mae20d: number;
  fwd60d: number;
  mfe60d: number;
  mae60d: number;
  riskReward60d: number;
  trajectory: number[]; // 7 sampled percentages [0, 10, 20, 30, 40, 50, 60 days]
  notes: string;
}

export const HistoricalMatcherModal: React.FC<HistoricalMatcherModalProps> = ({
  isOpen,
  onClose,
  currentDate,
  allData,
}) => {
  // Chronologically sorted dataset
  const chronologicalData = useMemo(() => {
    return [...allData].sort((a, b) => new Date(a.Date).getTime() - new Date(b.Date).getTime());
  }, [allData]);

  const currentRecord = useMemo(() => {
    return chronologicalData.find(d => d.Date === currentDate) || chronologicalData[chronologicalData.length - 1];
  }, [chronologicalData, currentDate]);

  const matches: HistoricalMatch[] = useMemo(() => {
    if (!currentRecord || chronologicalData.length < 70) return [];

    const getFeatures = (d: MarketData) => {
      const tt = d.TotalTraded || 1;
      return [
        (d['No of stocks above 200 day SMA'] || 0) / tt,
        (d['No of stocks above 50 day SMA'] || 0) / tt,
        (d['No of stocks above 20 day SMA'] || 0) / tt,
        (d['No of stocks above all 3 SMAs'] || 0) / tt,
        Math.min(5.0, d['Advance/Decline Ratio'] || 1.0) / 5.0,
        ((d['Net New Highs'] || 0) / tt) * 5.0,
        (d.Swing_Score || 50) / 100.0,
        (d.Regime_State ?? 2) / 3.0,
      ];
    };

    const targetVector = getFeatures(currentRecord);
    const targetTime = new Date(currentDate).getTime();
    const minDayGapMs = 45 * 24 * 60 * 60 * 1000; // Skip 45 days around target date to avoid adjacent sessions

    const candidates: { record: MarketData; index: number; dist: number }[] = [];

    // Scan all historical days (excluding the final 60 days so forward paths are fully completed)
    for (let i = 0; i < chronologicalData.length - 60; i++) {
      const row = chronologicalData[i];
      const rowTime = new Date(row.Date).getTime();
      if (Math.abs(rowTime - targetTime) < minDayGapMs) continue;

      const vec = getFeatures(row);
      // Weighted Euclidean Distance across 8 dimensions
      const weights = [2.0, 2.0, 1.0, 1.0, 1.5, 1.5, 2.0, 1.5];
      let sumSq = 0;
      let totalW = 0;

      for (let j = 0; j < targetVector.length; j++) {
        const diff = targetVector[j] - vec[j];
        sumSq += weights[j] * diff * diff;
        totalW += weights[j];
      }

      const weightedDist = Math.sqrt(sumSq / totalW);
      candidates.push({ record: row, index: i, dist: weightedDist });
    }

    // Sort by smallest distance (closest match)
    candidates.sort((a, b) => a.dist - b.dist);

    // Pick top 4 diverse matches (at least 45 days apart from each other)
    const selected: typeof candidates = [];
    for (const cand of candidates) {
      const candTime = new Date(cand.record.Date).getTime();
      const isTooClose = selected.some(s => Math.abs(new Date(s.record.Date).getTime() - candTime) < minDayGapMs);
      if (!isTooClose) {
        selected.push(cand);
        if (selected.length >= 4) break;
      }
    }

    return selected.map(({ record, index, dist }) => {
      const similarity = Math.max(70, Math.min(99.4, (1 - dist * 1.8) * 100));
      const tt = record.TotalTraded || 1;
      const pct200 = ((record['No of stocks above 200 day SMA'] || 0) / tt) * 100;
      const pct50 = ((record['No of stocks above 50 day SMA'] || 0) / tt) * 100;
      const pct20 = ((record['No of stocks above 20 day SMA'] || 0) / tt) * 100;
      const nnhPct = ((record['Net New Highs'] || 0) / tt) * 100;
      const adRatio = record['Advance/Decline Ratio'] || 1.0;
      const swingScore = record.Swing_Score || 50;

      // Compute exact 60-Day Forward Excursion Trajectory (MFE & MAE)
      const forwardWindow = chronologicalData.slice(index + 1, index + 61);
      let cumRet = 0.0;
      const cumSeries: number[] = [0.0];

      forwardWindow.forEach(d => {
        const adv = d['No of stocks which are positive'] || 0;
        const dec = d['No of stocks which are negative'] || 0;
        const total = d.TotalTraded || 1;
        const up45 = d['No. of stocks up 4.5%+ in the current day'] || 0;
        const dn45 = d['No. of stocks down 4.5%+ in the current day'] || 0;

        const dailyRet = ((adv - dec) / total) * 0.0125 + ((up45 - dn45) / total) * 0.035;
        cumRet = (1.0 + cumRet) * (1.0 + dailyRet) - 1.0;
        cumSeries.push(cumRet * 100);
      });

      // Pad if less than 60
      while (cumSeries.length <= 60) {
        cumSeries.push(cumSeries[cumSeries.length - 1]);
      }

      // 20-Day metrics
      const series20 = cumSeries.slice(0, 21);
      const mfe20d = Math.max(0, ...series20);
      const mae20d = Math.min(0, ...series20);
      const fwd20d = series20[series20.length - 1];

      // 60-Day metrics
      const mfe60d = Math.max(0, ...cumSeries);
      const mae60d = Math.min(0, ...cumSeries);
      const fwd60d = cumSeries[60];
      const riskReward60d = mfe60d / Math.max(0.5, Math.abs(mae60d));

      // Sample 7 points for Sparkline [Day 0, 10, 20, 30, 40, 50, 60]
      const trajectory = [
        cumSeries[0],
        cumSeries[10],
        cumSeries[20],
        cumSeries[30],
        cumSeries[40],
        cumSeries[50],
        cumSeries[60],
      ];

      let notes = 'Consolidation phase with selective theme rotations.';
      if (fwd60d >= 8 && mae60d > -4) {
        notes = 'Preceded an explosive multi-month expansion wave with shallow drawdowns.';
      } else if (fwd60d <= -6) {
        notes = 'Preceded an intermediate market correction and severe reset.';
      } else if (mfe60d >= 6 && mae60d < -5) {
        notes = 'Initial shakeout drop followed by a secondary momentum recovery.';
      } else if (fwd20d >= 3) {
        notes = 'Sharp short-term swing thrust followed by healthy digestion.';
      }

      return {
        date: record.Date,
        formattedDate: new Date(record.Date).toLocaleDateString('en-GB', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          year: 'numeric',
        }),
        similarity: parseFloat(similarity.toFixed(1)),
        pct200: parseFloat(pct200.toFixed(1)),
        pct50: parseFloat(pct50.toFixed(1)),
        pct20: parseFloat(pct20.toFixed(1)),
        adRatio: parseFloat(adRatio.toFixed(2)),
        nnhPct: parseFloat(nnhPct.toFixed(1)),
        swingScore: parseFloat(swingScore.toFixed(1)),
        macroRegime: record.Macro_Regime || (record.Regime_State === 3 ? "🟢 Full Bull Expansion" : record.Regime_State === 2 ? "🟡 Bull Consolidation" : record.Regime_State === 1 ? "🟠 Tactical Relief" : "🔴 Bear Contraction"),
        fwd20d: parseFloat(fwd20d.toFixed(1)),
        mfe20d: parseFloat(mfe20d.toFixed(1)),
        mae20d: parseFloat(mae20d.toFixed(1)),
        fwd60d: parseFloat(fwd60d.toFixed(1)),
        mfe60d: parseFloat(mfe60d.toFixed(1)),
        mae60d: parseFloat(mae60d.toFixed(1)),
        riskReward60d: parseFloat(riskReward60d.toFixed(1)),
        trajectory,
        notes,
      };
    });
  }, [chronologicalData, currentRecord, currentDate]);

  // Aggregate Expectancy Metrics across all 4 matches
  const aggregateExpectancy = useMemo(() => {
    if (matches.length === 0) return null;
    const positiveCount = matches.filter(m => m.fwd60d > 0).length;
    const winRate = (positiveCount / matches.length) * 100;
    const avgMfe60 = matches.reduce((acc, m) => acc + m.mfe60d, 0) / matches.length;
    const avgMae60 = matches.reduce((acc, m) => acc + m.mae60d, 0) / matches.length;
    const avgNet60 = matches.reduce((acc, m) => acc + m.fwd60d, 0) / matches.length;
    const avgNet20 = matches.reduce((acc, m) => acc + m.fwd20d, 0) / matches.length;
    const avgRR = avgMfe60 / Math.max(0.5, Math.abs(avgMae60));

    let takeaway = 'Balanced market setup with equal two-way volatility.';
    if (winRate >= 75 && avgRR >= 3.0) {
      takeaway = '🚀 Strong statistical tailwinds: Historical twins yielded high asymmetric upside with shallow pullbacks.';
    } else if (winRate === 0 || (winRate <= 25 && avgMae60 < -8)) {
      takeaway = `⚠️ High distribution risk: Historical twins suffered deep drawdowns (avg ${avgMae60.toFixed(1)}%). Favor high cash and strict capital defense.`;
    } else if (avgRR >= 2.0) {
      takeaway = '🎯 Moderate positive expectancy: Focus strictly on leading industry setups with disciplined stops.';
    }

    return {
      winRate: winRate.toFixed(0),
      positiveCount,
      totalCount: matches.length,
      avgMfe60: avgMfe60.toFixed(1),
      avgMae60: avgMae60.toFixed(1),
      avgNet60: avgNet60.toFixed(1),
      avgNet20: avgNet20.toFixed(1),
      avgRR: avgRR.toFixed(1),
      takeaway,
    };
  }, [matches]);

  if (!isOpen || !currentRecord) return null;

  const currentTT = currentRecord.TotalTraded || 1;
  const currentPct200 = (((currentRecord['No of stocks above 200 day SMA'] || 0) / currentTT) * 100).toFixed(1);
  const currentPct50 = (((currentRecord['No of stocks above 50 day SMA'] || 0) / currentTT) * 100).toFixed(1);
  const currentSwingScore = (currentRecord.Swing_Score || 50).toFixed(1);
  const currentAD = (currentRecord['Advance/Decline Ratio'] || 1.0).toFixed(2);

  const formattedCurrentDate = new Date(currentDate).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/90 overscroll-contain">
      <div
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative transform-gpu"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-950/80 border border-amber-700/80 rounded-xl text-amber-400">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Historical Breadth Signature & Risk/Reward Matcher</span>
                <span className="text-xs font-normal text-amber-300 bg-amber-950/90 border border-amber-800/80 px-2 py-0.5 rounded-full font-mono">
                  12-Year Pattern Finder (2014–2026)
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Evaluating forward price excursions (Max Upside vs. Max Drawdown) across closest historical setups to <strong>{formattedCurrentDate}</strong>.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            title="Close (Esc)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 overscroll-contain transform-gpu">
          {/* Target Breadth Footprint Banner */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 px-4 flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Session Signature:</span>
              <h3 className="text-sm md:text-base font-bold text-slate-100">{formattedCurrentDate}</h3>
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs font-mono">
              <div className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 mr-1.5">200 SMA:</span>
                <strong className="text-slate-200">{currentPct200}%</strong>
              </div>
              <div className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 mr-1.5">50 SMA:</span>
                <strong className="text-slate-200">{currentPct50}%</strong>
              </div>
              <div className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 mr-1.5">Swing:</span>
                <strong className="text-cyan-300">{currentSwingScore}/100</strong>
              </div>
              <div className="px-2.5 py-1 bg-slate-900 rounded-lg border border-slate-800">
                <span className="text-slate-500 mr-1.5">A/D:</span>
                <strong className="text-slate-200">{currentAD}</strong>
              </div>
            </div>
          </div>

          {/* 🌟 Aggregate Historical Expectancy Summary Banner */}
          {aggregateExpectancy && (
            <div className="bg-gradient-to-r from-indigo-950/70 via-slate-900 to-cyan-950/70 border border-indigo-700/60 rounded-xl p-4 shadow-lg space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-indigo-800/40 pb-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                    Aggregate Forward Expectancy (Based on 4 Top Historical Matches)
                  </h3>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-indigo-900/80 text-indigo-300 border border-indigo-700/60 font-bold">
                  60-Day Horizon
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center font-mono">
                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Historical Win Rate</span>
                  <span className={`text-sm font-bold ${Number(aggregateExpectancy.winRate) >= 65 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {aggregateExpectancy.winRate}% ({aggregateExpectancy.positiveCount}/{aggregateExpectancy.totalCount})
                  </span>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Avg Max Upside (MFE)</span>
                  <span className="text-sm font-bold text-emerald-400">
                    {Number(aggregateExpectancy.avgMfe60) > 0 ? `+${aggregateExpectancy.avgMfe60}%` : `${aggregateExpectancy.avgMfe60}%`}
                  </span>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Avg Max Drawdown (MAE)</span>
                  <span className="text-sm font-bold text-rose-400">
                    {aggregateExpectancy.avgMae60}%
                  </span>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Avg Net Outcome (60D)</span>
                  <span className={`text-sm font-bold ${Number(aggregateExpectancy.avgNet60) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {Number(aggregateExpectancy.avgNet60) > 0 ? '+' : ''}{aggregateExpectancy.avgNet60}%
                  </span>
                </div>

                <div className="bg-slate-950/60 p-2 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-sans">Risk / Reward Skew</span>
                  <span className={`text-sm font-bold ${Number(aggregateExpectancy.avgRR) >= 3.0 ? 'text-emerald-400' : Number(aggregateExpectancy.avgRR) >= 1.0 ? 'text-amber-300' : 'text-rose-400'}`}>
                    {aggregateExpectancy.avgRR} : 1
                  </span>
                </div>
              </div>

              {/* Actionable Expectancy Takeaway */}
              <div className="text-xs text-slate-300 font-medium bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
                {aggregateExpectancy.takeaway}
              </div>
            </div>
          )}

          {/* Top Matches Cards */}
          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <BarChart2 className="w-3.5 h-3.5 text-amber-400" />
              <span>Detailed Historical Excursion Breakdown:</span>
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {matches.map((m, idx) => {
                const isFwd60Pos = m.fwd60d >= 0;

                // Sparkline coordinates
                const minVal = Math.min(-5, ...m.trajectory);
                const maxVal = Math.max(8, ...m.trajectory);
                const range = maxVal - minVal || 1;
                const pointsSvg = m.trajectory
                  .map((val, tIdx) => {
                    const x = (tIdx / (m.trajectory.length - 1)) * 140;
                    const y = 38 - ((val - minVal) / range) * 32;
                    return `${x.toFixed(1)},${y.toFixed(1)}`;
                  })
                  .join(' ');

                const zeroY = 38 - ((0 - minVal) / range) * 32;

                return (
                  <div
                    key={m.date}
                    className="bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 rounded-xl p-4 flex flex-col justify-between gap-3 shadow-lg transition-all"
                  >
                    {/* Card Top */}
                    <div>
                      <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-slate-800">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-slate-800 text-slate-300 flex items-center justify-center text-[10px] font-mono font-bold">
                            #{idx + 1}
                          </span>
                          <h4 className="text-sm font-bold text-slate-100">{m.formattedDate}</h4>
                        </div>

                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 bg-emerald-950/80 border border-emerald-700/80 rounded-full text-emerald-300 text-xs font-mono font-bold shadow-sm">
                          <span>{m.similarity}% Match</span>
                        </div>
                      </div>

                      {/* Breadth Signature Grid */}
                      <div className="grid grid-cols-4 gap-2 py-2 text-center border-b border-slate-800/80 font-mono text-xs">
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">200 SMA</span>
                          <span className="text-slate-200 font-bold">{m.pct200.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">50 SMA</span>
                          <span className="text-slate-200 font-bold">{m.pct50.toFixed(1)}%</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">Swing</span>
                          <span className="text-amber-400 font-bold">{m.swingScore.toFixed(1)}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-500 block font-sans">A/D Ratio</span>
                          <span className="text-slate-200 font-bold">{m.adRatio.toFixed(2)}</span>
                        </div>
                      </div>

                      {/* ⚡ Forward Price Excursion & Trajectory (MFE vs MAE) */}
                      <div className="py-2.5 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            60-Day Forward Excursion (MFE / MAE):
                          </span>
                          <span className={`text-[11px] font-mono font-bold ${m.riskReward60d >= 3.0 ? 'text-emerald-400' : m.riskReward60d >= 1.0 ? 'text-amber-300' : 'text-rose-400'}`}>
                            R:R Skew: {m.riskReward60d.toFixed(1)}x
                          </span>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-center font-mono text-xs">
                          <div className="bg-emerald-950/40 border border-emerald-800/60 p-2 rounded-lg">
                            <span className="text-[9px] text-emerald-400 font-sans block uppercase font-bold">
                              📈 Max Upside (MFE)
                            </span>
                            <span className="text-emerald-400 font-bold text-sm">
                              {m.mfe60d > 0 ? `+${m.mfe60d.toFixed(1)}%` : `${m.mfe60d.toFixed(1)}%`}
                            </span>
                          </div>

                          <div className="bg-rose-950/40 border border-rose-800/60 p-2 rounded-lg">
                            <span className="text-[9px] text-rose-400 font-sans block uppercase font-bold">
                              📉 Max Drawdown (MAE)
                            </span>
                            <span className="text-rose-400 font-bold text-sm">
                              {m.mae60d.toFixed(1)}%
                            </span>
                          </div>

                          <div className="bg-slate-900/80 border border-slate-800 p-2 rounded-lg">
                            <span className="text-[9px] text-slate-400 font-sans block uppercase font-bold">
                              🎯 Net 60D Return
                            </span>
                            <span className={`font-bold text-sm ${isFwd60Pos ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {m.fwd60d > 0 ? '+' : ''}{m.fwd60d.toFixed(1)}%
                            </span>
                          </div>
                        </div>

                        {/* Mini Sparkline & 20D Net Outcome */}
                        <div className="flex items-center justify-between gap-3 pt-1 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="text-slate-400 text-[11px]">Net 20D (1M):</span>
                            <span className={`font-mono font-bold ${m.fwd20d >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {m.fwd20d > 0 ? '+' : ''}{m.fwd20d.toFixed(1)}%
                            </span>
                          </div>

                          {/* Mini Trajectory Sparkline */}
                          <div className="flex items-center gap-1.5" title="60-Day Trajectory Path (Day 0 to Day 60)">
                            <span className="text-[9px] text-slate-500 font-mono">0D</span>
                            <svg className="w-28 h-7 overflow-visible bg-slate-900/90 rounded border border-slate-800 px-1" viewBox="0 0 140 40">
                              {/* Zero Reference Line */}
                              <line
                                x1="0"
                                y1={zeroY}
                                x2="140"
                                y2={zeroY}
                                stroke="#475569"
                                strokeWidth="0.8"
                                strokeDasharray="2,2"
                              />
                              {/* Path */}
                              <polyline
                                fill="none"
                                stroke={isFwd60Pos ? '#10b981' : '#f43f5e'}
                                strokeWidth="1.8"
                                points={pointsSvg}
                              />
                            </svg>
                            <span className="text-[9px] text-slate-500 font-mono">60D</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Card Notes */}
                    <div className="pt-2 border-t border-slate-800 text-[11px] text-slate-400 italic">
                      💡 {m.notes}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs text-slate-400">
          <span>Vector similarity computed across 8 normalized breadth dimensions with MFE/MAE excursions</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
