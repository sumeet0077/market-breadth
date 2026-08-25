'use client';

import React from 'react';
import { X, Keyboard, Command, Sparkles } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ShortcutGroup {
  category: string;
  items: { key: string; label: string; note?: string }[];
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const shortcutGroups: ShortcutGroup[] = [
    {
      category: '🌐 Dashboard & Views',
      items: [
        { key: '1', label: 'Switch to Heatmap View' },
        { key: '2', label: 'Switch to Charts & Breadth Thrusts' },
        { key: 'P / T', label: 'Toggle % View vs Absolute Numbers' },
        { key: 'C', label: 'Toggle Column Metrics Selector' },
        { key: 'R', label: 'Reset Inspected Date to Latest Session' },
        { key: '← / [', label: 'Step 1 Day Backward (Previous Date)' },
        { key: '→ / ]', label: 'Step 1 Day Forward (Next Date)' },
      ],
    },
    {
      category: '🧭 Modals & Cockpit Engines',
      items: [
        { key: 'M', label: 'Open / Close Strategy Matrix Modal' },
        { key: 'H / A', label: 'Open / Close Historical Analogues Matcher' },
        { key: '?', label: 'Open / Close Keyboard Shortcuts Cheat Sheet' },
        { key: 'Esc', label: 'Close any active modal or overlay' },
      ],
    },
    {
      category: '🔍 Drilldown & Stock Table Hotkeys',
      items: [
        { key: 'Tab', label: 'Switch between Top Setups & All Stocks' },
        { key: '↓ / J', label: 'Highlight Next Stock Row' },
        { key: '↑ / K', label: 'Highlight Previous Stock Row' },
        { key: 'Space / ↵', label: 'Open Highlighted Stock in TradingView' },
        { key: 'D', label: 'Inspect Breakout DNA Radar for Highlighted Stock' },
        { key: 'E', label: 'Export Active Table to CSV' },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/90 overscroll-contain">
      <div
        className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative transform-gpu"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 md:p-5 border-b border-slate-800 bg-slate-900/95 flex items-center justify-between gap-4 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-950/80 border border-indigo-700/80 rounded-xl text-indigo-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base md:text-lg font-bold text-slate-100 flex items-center gap-2">
                <span>Power-Trader Keyboard Shortcuts</span>
                <span className="text-xs font-normal text-indigo-300 bg-indigo-950/90 border border-indigo-800/80 px-2 py-0.5 rounded-full font-mono">
                  Pro Hotkeys
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Navigate dates, toggle institutional metrics, and launch stock charts with zero friction.
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
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-6 overscroll-contain transform-gpu">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {shortcutGroups.map(group => (
              <div key={group.category} className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-4 space-y-3 shadow-inner">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-300 border-b border-slate-800 pb-2">
                  {group.category}
                </h3>

                <div className="space-y-2">
                  {group.items.map(item => (
                    <div key={item.key} className="flex items-center justify-between gap-3 text-xs">
                      <span className="text-slate-400">{item.label}</span>
                      <div className="flex items-center gap-1">
                        {item.key.split(' / ').map(k => (
                          <kbd
                            key={k}
                            className="px-2 py-1 bg-slate-900 border border-slate-700 text-slate-200 rounded font-mono font-bold text-[11px] shadow-sm"
                          >
                            {k}
                          </kbd>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 px-5 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between text-xs text-slate-400">
          <span>Press <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded font-mono text-[10px] text-slate-300">?</kbd> anywhere to toggle this guide</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
