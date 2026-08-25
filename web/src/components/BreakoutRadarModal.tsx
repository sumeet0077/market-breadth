'use client';

import React from 'react';
import { X, Sparkles, TrendingUp, ShieldCheck, Flame, ArrowUpRight } from 'lucide-react';
import { TopSetupItem, getTradingViewUrl, getGradeStats, formatPct, formatTurnoverCr } from './DrilldownModal';

interface BreakoutRadarModalProps {
  isOpen: boolean;
  onClose: () => void;
  setup: TopSetupItem | null;
}

export const BreakoutRadarModal: React.FC<BreakoutRadarModalProps> = ({
  isOpen,
  onClose,
  setup,
}) => {
  if (!isOpen || !setup) return null;

  const tvUrl = getTradingViewUrl(setup.symbol);
  const stats = getGradeStats(setup.score);

  // Compute normalized 5-axis values (0 to 100)
  // 1. Volume Force: RVOL 1.0x = 35%, 2.0x = 65%, 3.5x+ = 100%
  const volumeAxis = Math.min(100, Math.max(20, Math.round((setup.rvol / 3.5) * 100)));

  // 2. Closing Power: CLV 0.5 = 50%, 0.85 = 85%, 1.0 = 100%
  const clvAxis = Math.min(100, Math.max(15, Math.round(setup.clv * 100)));

  // 3. Price Velocity: 1D % (e.g. 5% = 60%, 10%+ = 100%)
  const velocityAxis = Math.min(100, Math.max(25, Math.round(((setup.pct1d || 5) / 12) * 100)));

  // 4. Sector Sympathy Wave:
  const isHotCluster = setup.cluster.startsWith('🔥');
  const sympathyAxis = isHotCluster ? 95 : setup.sector !== 'Diversified' ? 70 : 45;

  // 5. Setup Quality Score:
  const scoreAxis = Math.min(100, Math.max(20, setup.score));

  const axes = [
    { label: 'Volume Force (RVOL)', val: volumeAxis, raw: `${setup.rvol}x RVOL` },
    { label: 'Closing Power (CLV)', val: clvAxis, raw: `${setup.clv} CLV` },
    { label: 'Price Velocity (1D %)', val: velocityAxis, raw: formatPct(setup.pct1d) },
    { label: 'Sector Sympathy', val: sympathyAxis, raw: setup.cluster },
    { label: 'Quality Score', val: scoreAxis, raw: `${setup.score}/100` },
  ];

  // SVG Radar Geometry (Center at 150, 150; Radius = 100)
  const cx = 150;
  const cy = 150;
  const r = 100;
  const numAxes = 5;

  const getCoordinates = (index: number, valuePct: number) => {
    // Start from top (-90 degrees) and rotate clockwise
    const angle = (Math.PI * 2 * index) / numAxes - Math.PI / 2;
    const distance = (r * valuePct) / 100;
    const x = cx + distance * Math.cos(angle);
    const y = cy + distance * Math.sin(angle);
    return { x, y };
  };

  // Polygon points
  const polygonPoints = axes
    .map((axis, i) => {
      const { x, y } = getCoordinates(i, axis.val);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  // Grid concentric rings (20%, 40%, 60%, 80%, 100%)
  const rings = [20, 40, 60, 80, 100];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/90 overscroll-contain">
      <div
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative transform-gpu"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-950/80 border border-emerald-700/80 rounded-xl text-emerald-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base md:text-lg font-bold text-slate-100">{setup.symbol}</h2>
                <span className={`px-2 py-0.5 rounded font-bold text-xs ${stats.badge}`}>
                  {setup.score}/100 • {stats.label} ({stats.winRate} Win)
                </span>
              </div>
              <p className="text-xs text-slate-400 flex items-center gap-1.5 flex-wrap mt-0.5">
                <span className="text-slate-200 font-semibold">{setup.sector}</span>
                {setup.theme && setup.theme !== 'Diversified' && setup.theme !== setup.sector && (
                  <>
                    <span className="text-slate-600">•</span>
                    <span className="text-indigo-300 font-medium">{setup.theme}</span>
                  </>
                )}
                <span className="text-slate-600">•</span>
                <span className="text-slate-400">Turnover: {formatTurnoverCr(setup.turnover_cr)}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 shadow-sm"
              title="Open full interactive chart on TradingView"
            >
              <span>TradingView</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 overscroll-contain transform-gpu">
          {/* Radar Chart & Key Stats Row */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            {/* SVG Radar Chart */}
            <div className="relative w-72 h-72 flex-shrink-0 flex items-center justify-center">
              <svg viewBox="0 0 300 300" className="w-full h-full">
                {/* Background Grid Rings */}
                {rings.map(ringPct => {
                  const ringPoints = Array.from({ length: numAxes })
                    .map((_, i) => {
                      const { x, y } = getCoordinates(i, ringPct);
                      return `${x.toFixed(1)},${y.toFixed(1)}`;
                    })
                    .join(' ');

                  return (
                    <polygon
                      key={ringPct}
                      points={ringPoints}
                      fill="none"
                      stroke="#334155"
                      strokeWidth="0.75"
                      strokeDasharray={ringPct === 100 ? 'none' : '2,2'}
                    />
                  );
                })}

                {/* Spokes from Center */}
                {axes.map((_, i) => {
                  const { x, y } = getCoordinates(i, 100);
                  return (
                    <line
                      key={i}
                      x1={cx}
                      y1={cy}
                      x2={x}
                      y2={y}
                      stroke="#334155"
                      strokeWidth="0.75"
                    />
                  );
                })}

                {/* The Breakout DNA Filled Polygon */}
                <polygon
                  points={polygonPoints}
                  fill="url(#radarGradient)"
                  fillOpacity="0.55"
                  stroke="#10b981"
                  strokeWidth="2"
                />

                {/* Node Points */}
                {axes.map((axis, i) => {
                  const { x, y } = getCoordinates(i, axis.val);
                  return (
                    <circle
                      key={i}
                      cx={x}
                      cy={y}
                      r="4"
                      className="fill-emerald-400 stroke-slate-950 stroke-2"
                    />
                  );
                })}

                {/* Gradients */}
                <defs>
                  <radialGradient id="radarGradient" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#10b981" stopOpacity="0.8" />
                    <stop offset="100%" stopColor="#059669" stopOpacity="0.2" />
                  </radialGradient>
                </defs>
              </svg>
            </div>

            {/* Factor Scores Breakdown */}
            <div className="flex-1 w-full space-y-2.5">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Factor Quality Scores:
              </h4>

              {axes.map((axis, i) => (
                <div key={axis.label} className="bg-slate-950/80 border border-slate-800 rounded-lg p-2 px-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-300 font-medium">{axis.label}</span>
                    <span className="text-slate-100 font-mono font-bold">{axis.raw}</span>
                  </div>
                  <div className="w-full bg-slate-900 h-1.5 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className={`h-full rounded-full transition-all ${
                        axis.val >= 80 ? 'bg-emerald-500' : axis.val >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                      }`}
                      style={{ width: `${axis.val}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Setup Profile & Liquidity Card */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Setup Profile & Liquidity Footprint:</span>
              </span>
              <span className="text-xs font-mono text-slate-400">
                Turnover: <strong className="text-slate-200">{formatTurnoverCr(setup.turnover_cr)}</strong>
              </span>
            </div>

            <div className="grid grid-cols-4 gap-2.5 text-center text-xs font-mono">
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block">Close Price</span>
                <span className="text-slate-100 font-bold text-sm">₹{setup.close.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block">1-Day Gain</span>
                <span className={`font-bold text-sm ${(setup.pct1d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPct(setup.pct1d)}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block">5-Day Gain</span>
                <span className={`font-bold text-sm ${(setup.pct5d ?? 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatPct(setup.pct5d)}
                </span>
              </div>
              <div className="bg-slate-900/80 p-2.5 rounded-lg border border-slate-800">
                <span className="text-[10px] text-slate-500 block">RVOL / CLV</span>
                <span className="text-cyan-300 font-bold text-sm">{setup.rvol}x / {setup.clv}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs text-slate-400">
          <span>12-Year Backtested Expectancy: <strong className="text-emerald-400">{stats.winRate} Win Rate</strong> ({stats.avgGain} Avg Gain)</span>
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
