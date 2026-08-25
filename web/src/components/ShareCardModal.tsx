"use client";

import React, { useRef, useState } from "react";
import { X, Download, Copy, Check, Share2, Sparkles, Shield, Flame, Layers } from "lucide-react";
import { MarketData } from "./Heatmap";

interface ShareCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeDate: string;
  activeData: MarketData | null;
  macroRegime: string;
  swingScore: number;
  swingRegime: string;
  exposure: string;
  tacticalStyle: string;
  hotThemes: string[];
}

export function ShareCardModal({
  isOpen,
  onClose,
  activeDate,
  activeData,
  macroRegime,
  swingScore,
  swingRegime,
  exposure,
  tacticalStyle,
  hotThemes,
}: ShareCardModalProps) {
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !activeData) return null;

  const pct200 = activeData.TotalTraded
    ? ((activeData["No of stocks above 200 day SMA"] / activeData.TotalTraded) * 100).toFixed(1)
    : "0";
  const pct50 = activeData.TotalTraded
    ? ((activeData["No of stocks above 50 day SMA"] / activeData.TotalTraded) * 100).toFixed(1)
    : "0";
  const adRatio = activeData["Advance/Decline Ratio"]?.toFixed(2) || "1.00";
  const netHighs = activeData["Net New Highs"] !== undefined ? activeData["Net New Highs"] : 0;

  const handleCopyText = () => {
    const text = `📊 QuantBreadth™ Market Wrap (${activeDate})
──────────────────────────────
🌐 Macro Regime: ${macroRegime}
⚡ Swing Score: ${swingScore.toFixed(1)}/100 (${swingRegime})
🛡️ Max Recommended Exposure: ${exposure}
🎯 Style: ${tacticalStyle}

📈 Breadth Internals:
• Stocks > 200 SMA: ${pct200}%
• Stocks > 50 SMA: ${pct50}%
• Advance/Decline Ratio: ${adRatio}
• Net 52W Highs: ${netHighs >= 0 ? `+${netHighs}` : netHighs}

🔥 Top Theme Clusters: ${hotThemes.slice(0, 4).join(", ") || "Selective"}
──────────────────────────────
⚡ Generated via QuantBreadth PRO (NSE Internals Intelligence)`;

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 overscroll-contain animate-fadeIn">
      <div
        className="w-full max-w-xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transform-gpu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <Share2 className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-bold text-slate-100">QuantBreadth™ Social Share Card</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* The Graphic Card Container */}
        <div className="p-6 bg-[#070b14] overflow-y-auto max-h-[70vh]">
          <div
            ref={cardRef}
            className="w-full bg-gradient-to-br from-slate-900 via-slate-950 to-[#070b14] border border-slate-700/80 rounded-2xl p-6 shadow-2xl space-y-5 text-slate-100 relative overflow-hidden"
          >
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl -z-10 pointer-events-none" />

            {/* Top Branding */}
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-cyan-500/20 font-mono">
                  QB
                </div>
                <div>
                  <h2 className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                    QuantBreadth<span className="text-cyan-400">™</span>
                  </h2>
                  <p className="text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                    Institutional Terminal
                  </p>
                </div>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-mono text-slate-400 block uppercase">Session Date</span>
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-200">
                  {activeDate}
                </span>
              </div>
            </div>

            {/* Core Metrics Grid */}
            <div className="grid grid-cols-2 gap-3">
              {/* Macro Regime */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">🌐 Macro Regime</span>
                <div className="text-xs font-bold text-slate-100 truncate">{macroRegime}</div>
                <div className="text-[10px] text-slate-400 font-mono">Structural &gt; 200 SMA: {pct200}%</div>
              </div>

              {/* Swing Score */}
              <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">⚡ Swing Momentum</span>
                <div className="text-xs font-bold text-emerald-400">{swingScore.toFixed(1)} / 100</div>
                <div className="text-[10px] text-slate-400 font-mono">{swingRegime}</div>
              </div>
            </div>

            {/* Tactical Exposure & Style */}
            <div className="p-3.5 bg-indigo-950/30 border border-indigo-800/40 rounded-xl flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-indigo-300 block">Recommended Exposure</span>
                <span className="text-sm font-mono font-extrabold text-white">{exposure}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Tactical Style</span>
                <span className="text-xs font-semibold text-slate-200">{tacticalStyle}</span>
              </div>
            </div>

            {/* Breadth Internals 4-Card Bar */}
            <div className="grid grid-cols-4 gap-2 pt-1">
              <div className="p-2 bg-slate-950 border border-slate-800/80 rounded-lg text-center">
                <span className="text-[9px] text-slate-500 font-bold block uppercase">&gt; 200 SMA</span>
                <span className="text-xs font-mono font-bold text-slate-200">{pct200}%</span>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800/80 rounded-lg text-center">
                <span className="text-[9px] text-slate-500 font-bold block uppercase">&gt; 50 SMA</span>
                <span className="text-xs font-mono font-bold text-slate-200">{pct50}%</span>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800/80 rounded-lg text-center">
                <span className="text-[9px] text-slate-500 font-bold block uppercase">A/D Ratio</span>
                <span className="text-xs font-mono font-bold text-slate-200">{adRatio}</span>
              </div>
              <div className="p-2 bg-slate-950 border border-slate-800/80 rounded-lg text-center">
                <span className="text-[9px] text-slate-500 font-bold block uppercase">Net Highs</span>
                <span className={`text-xs font-mono font-bold ${netHighs >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {netHighs >= 0 ? `+${netHighs}` : netHighs}
                </span>
              </div>
            </div>

            {/* Hot Themes */}
            {hotThemes.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-amber-400 text-[11px] font-bold">
                  <Flame className="w-3.5 h-3.5" />
                  <span>Hot Themes:</span>
                </div>
                <div className="flex items-center gap-1.5 truncate max-w-[280px]">
                  {hotThemes.slice(0, 3).map((th) => (
                    <span
                      key={th}
                      className="px-2 py-0.5 bg-slate-800 border border-slate-700 text-slate-200 rounded text-[10px] font-mono"
                    >
                      {th}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Watermark Footer */}
            <div className="pt-2 text-center text-[10px] font-mono text-slate-500 tracking-wider">
              QUANTBREADTH PRO • 4.77M NSE DATA POINTS • 2014–2026
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between gap-3">
          <button
            onClick={handleCopyText}
            className="flex-1 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? "Copied Text Wrap!" : "Copy Summary Text"}</span>
          </button>

          <button
            onClick={() => window.print()}
            className="py-2 px-4 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md shadow-indigo-500/20"
          >
            <Download className="w-4 h-4" />
            <span>Print / Save PDF</span>
          </button>
        </div>
      </div>
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
