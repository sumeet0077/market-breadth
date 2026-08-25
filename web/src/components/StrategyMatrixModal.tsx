'use client';

import React from 'react';
import { X, Compass } from 'lucide-react';

interface StrategyMatrixModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMacroState?: number;
  currentSwingScore?: number;
}

export const StrategyMatrixModal: React.FC<StrategyMatrixModalProps> = ({
  isOpen,
  onClose,
  currentMacroState = 2,
  currentSwingScore = 50,
}) => {
  if (!isOpen) return null;

  const swingTier = currentSwingScore >= 70 ? 'high' : currentSwingScore >= 45 ? 'mid' : 'low';

  const matrixData = [
    {
      macroState: 3,
      macroName: '🟢 Full Macro Bull Expansion (State 3)',
      macroDesc: '>70% stocks > 200 SMA • Broad structural uptrend',
      badgeColor: 'text-emerald-400',
      activeCellBg: 'bg-emerald-950/30 border-emerald-500/80 ring-1 ring-emerald-500/50',
      activeBadge: 'bg-emerald-500 text-slate-950',
      activeText: 'text-emerald-300',
      scenarios: [
        {
          tier: 'high',
          id: 'Scenario 1',
          name: '🚀 Max Bull Expansion',
          exposure: '100% – 120%',
          posSize: '15% – 20%',
          setupFilter: 'Grade A+ & A Setups',
          tactics: 'Aggressive trend following',
        },
        {
          tier: 'mid',
          id: 'Scenario 2',
          name: '🎯 Disciplined Bull',
          exposure: '60% – 80%',
          posSize: '8% – 10%',
          setupFilter: 'Grade A+ Leaders',
          tactics: 'Selective momentum & rotations',
        },
        {
          tier: 'low',
          id: 'Scenario 3',
          name: '⚠️ Bull Pullback / Digest',
          exposure: '30% – 50%',
          posSize: '5% Starter',
          setupFilter: 'Top 1-2 A+ Only',
          tactics: 'Defensive posture / avoid chasing',
        },
      ],
    },
    {
      macroState: 2,
      macroName: '🟡 Bull Consolidation / Pullback (State 2)',
      macroDesc: '50–65% stocks > 200 SMA • Normal digestive consolidation',
      badgeColor: 'text-amber-300',
      activeCellBg: 'bg-amber-950/30 border-amber-500/80 ring-1 ring-amber-500/50',
      activeBadge: 'bg-amber-500 text-slate-950',
      activeText: 'text-amber-300',
      scenarios: [
        {
          tier: 'high',
          id: 'Scenario 4',
          name: '⚡ Dip-Buying Thrust',
          exposure: '60% – 80%',
          posSize: '10% – 12%',
          setupFilter: 'Grade A+ VCP Bases',
          tactics: 'Buy high-tight pullbacks',
        },
        {
          tier: 'mid',
          id: 'Scenario 5',
          name: '🔍 Selective Rotation',
          exposure: '40% – 50%',
          posSize: '5% – 8%',
          setupFilter: 'Hot Sector Clusters',
          tactics: 'Quick swings in leading themes',
        },
        {
          tier: 'low',
          id: 'Scenario 6',
          name: '🛡️ Consolidation Chop',
          exposure: '15% – 30%',
          posSize: '3% – 5%',
          setupFilter: 'Highest-Bar A+ Only',
          tactics: 'Preserve cash / wait for clarity',
        },
      ],
    },
    {
      macroState: 1,
      macroName: '🟠 Tactical Relief / Repair (State 1)',
      macroDesc: '30–45% stocks > 200 SMA • Early base building / dead-cat risk',
      badgeColor: 'text-orange-400',
      activeCellBg: 'bg-orange-950/30 border-orange-500/80 ring-1 ring-orange-500/50',
      activeBadge: 'bg-orange-500 text-slate-950',
      activeText: 'text-orange-300',
      scenarios: [
        {
          tier: 'high',
          id: 'Scenario 7',
          name: '🏹 Counter-Trend Relief',
          exposure: '30% – 40%',
          posSize: '5% – 7%',
          setupFilter: 'Thrust Reversal Leaders',
          tactics: 'Short-term tactical bounce',
        },
        {
          tier: 'mid',
          id: 'Scenario 8',
          name: '♟️ Dead-Cat Chop',
          exposure: '15% – 20%',
          posSize: '3% – 5%',
          setupFilter: 'Strictly Grade A+ Leaders',
          tactics: 'High caution / fast exits',
        },
        {
          tier: 'low',
          id: 'Scenario 9',
          name: '🚫 Bear Grind Contraction',
          exposure: '0% – 10%',
          posSize: '0%',
          setupFilter: 'Avoid All Breakouts',
          tactics: 'Capital preservation / 100% cash',
        },
      ],
    },
    {
      macroState: 0,
      macroName: '🔴 Structural Bear Contraction (State 0)',
      macroDesc: '<25% stocks > 200 SMA • Heavy distribution and breakdown risk',
      badgeColor: 'text-rose-400',
      activeCellBg: 'bg-rose-950/30 border-rose-500/80 ring-1 ring-rose-500/50',
      activeBadge: 'bg-rose-500 text-slate-950',
      activeText: 'text-rose-300',
      scenarios: [
        {
          tier: 'high',
          id: 'Scenario 10',
          name: '🎣 Bear Market Bounce',
          exposure: '10% – 20%',
          posSize: '3% Scalp',
          setupFilter: 'Capitulation Thrusts',
          tactics: 'Strict scalps / same-day exits',
        },
        {
          tier: 'mid',
          id: 'Scenario 11',
          name: '❌ No Trade Zone',
          exposure: '0% – 5%',
          posSize: '0%',
          setupFilter: 'No Breakout Entries',
          tactics: 'Sit on hands / stay in cash',
        },
        {
          tier: 'low',
          id: 'Scenario 12',
          name: '🛑 Maximum Cash / Capital Preservation',
          exposure: '0% (100% Cash)',
          posSize: '0%',
          setupFilter: '68.2% Breakout Failure Rate',
          tactics: '100% Cash / Wait for Capitulation',
        },
      ],
    },
  ];

  const activeRow = matrixData.find(r => r.macroState === currentMacroState) || matrixData[1];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/90 overscroll-contain">
      <div 
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative transform-gpu"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-950/80 border border-indigo-700/80 rounded-xl text-indigo-400">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Market Regime & Trading Playbook Decision Matrix</span>
                <span className="text-xs font-normal text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full">
                  12 Scenarios
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Actionable portfolio exposure and position sizing rules mapped across Macro (1–6M) &times; Swing Momentum (3–10D).
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

        {/* Scrollable Matrix Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 overscroll-contain transform-gpu">
          {/* Active Highlight Banner */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border border-slate-800 rounded-xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-cyan-500 text-slate-950 font-bold uppercase tracking-wider text-[10px]">
                Currently Active
              </span>
              <span className="text-slate-300">
                Macro State: <strong className={`font-bold ${activeRow.badgeColor}`}>State {currentMacroState} ({activeRow.macroName.split('(')[0].trim()})</strong> &nbsp;|&nbsp; 
                Swing Score: <strong className="text-cyan-300 font-mono">{currentSwingScore}/100 ({swingTier.toUpperCase()})</strong>
              </span>
            </div>
            <span className={`font-medium ${activeRow.badgeColor}`}>
              Active Scenario Highlighted Below
            </span>
          </div>

          {/* Decision Grid */}
          <div className="space-y-4">
            {matrixData.map(row => {
              const isCurrentMacro = row.macroState === currentMacroState;

              return (
                <div 
                  key={row.macroState}
                  className={`rounded-xl border transition-all ${
                    isCurrentMacro 
                      ? 'bg-slate-900/90 border-slate-700 shadow-md' 
                      : 'bg-slate-950/50 border-slate-800/80 opacity-90'
                  }`}
                >
                  {/* Row Header */}
                  <div className="px-4 py-2.5 bg-slate-950/80 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-bold ${row.badgeColor}`}>{row.macroName}</span>
                      <span className="text-[11px] text-slate-500 font-mono">({row.macroDesc})</span>
                    </div>
                  </div>

                  {/* 3 Swing Columns for this Macro State */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3">
                    {row.scenarios.map(sc => {
                      const isCurrentCell = isCurrentMacro && sc.tier === swingTier;

                      return (
                        <div
                          key={sc.id}
                          className={`p-3.5 rounded-lg border flex flex-col justify-between gap-2 transition-all ${
                            isCurrentCell
                              ? row.activeCellBg
                              : 'bg-slate-900/60 border-slate-800/80 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between gap-2 mb-1.5">
                              <span className={`text-xs font-bold ${isCurrentCell ? row.activeText : 'text-slate-200'}`}>
                                {sc.name}
                              </span>
                              {isCurrentCell && (
                                <span className={`px-1.5 py-0.2 text-[9px] font-extrabold rounded uppercase ${row.activeBadge}`}>
                                  Live Now
                                </span>
                              )}
                            </div>

                            <div className="space-y-1 text-xs">
                              <div className="flex items-center justify-between text-slate-400">
                                <span>Max Exposure:</span>
                                <strong className="text-slate-200 font-mono">{sc.exposure}</strong>
                              </div>
                              <div className="flex items-center justify-between text-slate-400">
                                <span>Position Sizing:</span>
                                <strong className="text-slate-200 font-mono">{sc.posSize}</strong>
                              </div>
                              <div className="flex items-center justify-between text-slate-400">
                                <span>Setup Filter:</span>
                                <span className="text-slate-300 text-[11px] font-medium">{sc.setupFilter}</span>
                              </div>
                            </div>
                          </div>

                          <div className="pt-2 border-t border-slate-800/80 text-[11px] text-slate-400 italic">
                            {sc.tactics}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs text-slate-400">
          <span>Click anywhere outside or press Esc to close</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Close Matrix
          </button>
        </div>
      </div>
    </div>
  );
};
