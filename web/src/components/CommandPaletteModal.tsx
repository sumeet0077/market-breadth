"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, Calendar, Compass, LineChart, Layers, Zap, X, ArrowRight, Sparkles, Keyboard } from "lucide-react";
import { ALL_PARENT_SECTORS } from "./DrilldownModal";

interface CommandItem {
  id: string;
  category: "Navigation" | "Action" | "Signal" | "Sector" | "Date";
  title: string;
  subtitle?: string;
  icon: React.ReactNode;
  action: () => void;
}

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectDate: (date: string) => void;
  onSelectSector?: (sector: string) => void;
  onOpenMatrix: () => void;
  onOpenMatcher: () => void;
  onOpenCharts: () => void;
  onOpenShareCard?: () => void;
  onOpenShortcuts?: () => void;
  onTogglePercentages: () => void;
  onReset: () => void;
  availableDates: string[];
}

export function CommandPaletteModal({
  isOpen,
  onClose,
  onSelectDate,
  onSelectSector,
  onOpenMatrix,
  onOpenMatcher,
  onOpenCharts,
  onOpenShareCard,
  onOpenShortcuts,
  onTogglePercentages,
  onReset,
  availableDates,
}: CommandPaletteModalProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const allCommands: CommandItem[] = useMemo(() => {
    const items: CommandItem[] = [
      // Primary Navigation
      {
        id: "nav-charts",
        category: "Navigation",
        title: "Open Multi-Pane Breadth Charts",
        subtitle: "View synchronized time series studio",
        icon: <LineChart className="w-4 h-4 text-indigo-400" />,
        action: () => { onOpenCharts(); onClose(); },
      },
      {
        id: "nav-matrix",
        category: "Navigation",
        title: "Open 12-Scenario Strategy Matrix",
        subtitle: "View institutional exposure directives",
        icon: <Compass className="w-4 h-4 text-cyan-400" />,
        action: () => { onOpenMatrix(); onClose(); },
      },
      {
        id: "nav-matcher",
        category: "Navigation",
        title: "Open Historical Matcher (Analogues)",
        subtitle: "Scan 12-year breadth analogs",
        icon: <Sparkles className="w-4 h-4 text-amber-400" />,
        action: () => { onOpenMatcher(); onClose(); },
      },
      {
        id: "nav-share",
        category: "Action",
        title: "Generate QuantBreadth Social Share Card",
        subtitle: "Create branded dark-mode summary graphic",
        icon: <Zap className="w-4 h-4 text-emerald-400" />,
        action: () => { onOpenShareCard?.(); onClose(); },
      },
      {
        id: "act-pct",
        category: "Action",
        title: "Toggle Percentage (%) vs Count View",
        subtitle: "Shortcut: P or T",
        icon: <Layers className="w-4 h-4 text-blue-400" />,
        action: () => { onTogglePercentages(); onClose(); },
      },
      {
        id: "act-reset",
        category: "Action",
        title: "Reset Timeframe to Latest View",
        subtitle: "Shortcut: R",
        icon: <Calendar className="w-4 h-4 text-slate-400" />,
        action: () => { onReset(); onClose(); },
      },
      {
        id: "act-shortcuts",
        category: "Action",
        title: "View Keyboard Shortcuts",
        subtitle: "Shortcut: ?",
        icon: <Keyboard className="w-4 h-4 text-purple-400" />,
        action: () => { onOpenShortcuts?.(); onClose(); },
      },
    ];

    // Sectors
    ALL_PARENT_SECTORS.forEach((sec) => {
      items.push({
        id: `sector-${sec}`,
        category: "Sector",
        title: `Sector: ${sec}`,
        subtitle: "Filter breakout setups by this parent sector",
        icon: <Layers className="w-4 h-4 text-emerald-400" />,
        action: () => { onSelectSector?.(sec); onClose(); },
      });
    });

    // Significant Dates (Recent & Landmark Sessions)
    const recentDates = availableDates.slice(0, 15);
    recentDates.forEach((d) => {
      items.push({
        id: `date-${d}`,
        category: "Date",
        title: `Inspect Date: ${d}`,
        subtitle: "Jump to this trading session",
        icon: <Calendar className="w-4 h-4 text-slate-400" />,
        action: () => { onSelectDate(d); onClose(); },
      });
    });

    return items;
  }, [availableDates, onOpenCharts, onOpenMatrix, onOpenMatcher, onOpenShareCard, onTogglePercentages, onReset, onSelectSector, onSelectDate, onClose]);

  const filteredCommands = useMemo(() => {
    if (!query.trim()) return allCommands.slice(0, 12);
    const q = query.toLowerCase().trim();
    return allCommands.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.subtitle && c.subtitle.toLowerCase().includes(q)) ||
        c.category.toLowerCase().includes(q)
    ).slice(0, 15);
  }, [allCommands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredCommands]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < filteredCommands.length - 1 ? prev + 1 : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : filteredCommands.length - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredCommands[selectedIndex]) {
        filteredCommands[selectedIndex].action();
      }
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/90 overscroll-contain animate-fadeIn">
      <div
        className="w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transform-gpu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950/60">
          <Search className="w-5 h-5 text-cyan-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search dates (YYYY-MM-DD), sectors, themes, or commands..."
            className="w-full bg-transparent text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="px-2 py-0.5 bg-slate-800 text-[10px] text-slate-400 font-mono rounded border border-slate-700">
            ESC
          </kbd>
        </div>

        {/* Command Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2 divide-y divide-slate-800/40 overscroll-contain transform-gpu">
          {filteredCommands.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No matching commands, sectors, or dates found.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const isSelected = idx === selectedIndex;
              return (
                <button
                  key={cmd.id}
                  onClick={cmd.action}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-left transition-all ${
                    isSelected
                      ? "bg-indigo-600/20 text-white border border-indigo-500/40 shadow-sm"
                      : "text-slate-300 hover:bg-slate-800/60 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`p-2 rounded-lg ${
                        isSelected ? "bg-indigo-600 text-white" : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {cmd.icon}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold text-slate-100 truncate">
                        {cmd.title}
                      </span>
                      {cmd.subtitle && (
                        <span className="text-[10px] text-slate-400 truncate">
                          {cmd.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-950/80 text-slate-400 border border-slate-800 uppercase">
                      {cmd.category}
                    </span>
                    <ArrowRight className={`w-3.5 h-3.5 ${isSelected ? "text-indigo-400" : "text-slate-600"}`} />
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Footer Hotkey Legend */}
        <div className="px-4 py-2 bg-slate-950 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-3">
            <span>
              <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-mono text-slate-300">↑</kbd> <kbd className="px-1 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-mono text-slate-300">↓</kbd> to navigate
            </span>
            <span>
              <kbd className="px-1.5 py-0.5 bg-slate-800 border border-slate-700 rounded text-[9px] font-mono text-slate-300">↵</kbd> to select
            </span>
          </div>
          <span className="text-slate-500 font-mono text-[10px]">QuantBreadth Command Center</span>
        </div>
      </div>
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}
