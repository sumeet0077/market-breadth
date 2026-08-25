"use client";

import React, { useState, useMemo } from "react";
import { 
  Layers, 
  Flame, 
  TrendingUp, 
  TrendingDown, 
  Search, 
  Copy, 
  Check, 
  ChevronRight, 
  ChevronLeft,
  Calendar,
  Zap, 
  ArrowUpDown, 
  Sparkles, 
  ShieldCheck, 
  BarChart3,
  Filter,
  Eye
} from "lucide-react";
import { ALL_PARENT_SECTORS, TopSetupItem } from "./DrilldownModal";
import { MarketData } from "./Heatmap";

interface SectorLeadershipViewProps {
  activeDate: string;
  activeData: MarketData | null;
  topSetups: TopSetupItem[];
  allDates?: string[];
  onDateChange?: (date: string) => void;
  onOpenStockChart: (symbol: string, parentSector?: string, theme?: string, pctChange?: number) => void;
}

type SortField = 'pct1d' | 'pct5d' | 'rvol' | 'clv' | 'turnover_cr' | 'score' | 'symbol';
type QuickFilter = 'all' | 'a_plus' | 'high_rvol' | 'strong_clv' | 'high_momentum' | 'institutional';

export function SectorLeadershipView({
  activeDate,
  activeData,
  topSetups,
  allDates = [],
  onDateChange,
  onOpenStockChart,
}: SectorLeadershipViewProps) {
  const [selectedSector, setSelectedSector] = useState<string>("All");
  const [themeSearch, setThemeSearch] = useState<string>("");
  const [minTurnoverCr, setMinTurnoverCr] = useState<number>(0);
  const [quickFilter, setQuickFilter] = useState<QuickFilter>("all");
  const [sortField, setSortField] = useState<SortField>("pct1d");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [showAllThemes, setShowAllThemes] = useState<boolean>(false);
  const [clusterFilterMode, setClusterFilterMode] = useState<"clusters_only" | "all">("clusters_only");

  // Date Navigation Helpers
  const currentDateIdx = useMemo(() => {
    return allDates.findIndex(d => d === activeDate);
  }, [allDates, activeDate]);

  const hasPrevDate = currentDateIdx > 0;
  const hasNextDate = currentDateIdx >= 0 && currentDateIdx < allDates.length - 1;

  const handlePrevDay = () => {
    if (hasPrevDate && onDateChange) {
      onDateChange(allDates[currentDateIdx - 1]);
    }
  };

  const handleNextDay = () => {
    if (hasNextDate && onDateChange) {
      onDateChange(allDates[currentDateIdx + 1]);
    }
  };

  const handleLatestDay = () => {
    if (allDates.length > 0 && onDateChange) {
      onDateChange(allDates[allDates.length - 1]);
    }
  };

  // Copy helper for TradingView / Broker Watchlists
  const copySymbolsToClipboard = (symbols: string[], key: string) => {
    const formatted = symbols.map(s => `NSE:${s}`).join(", ");
    navigator.clipboard.writeText(formatted);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Total Market Setup Turnover (₹ Cr)
  const totalSetupTurnoverCr = useMemo(() => {
    return topSetups.reduce((sum, s) => sum + (s.turnover_cr || 0), 0);
  }, [topSetups]);

  // Group top setups by Parent Sector & calculate flow statistics (excluding redundant "ALL")
  const parentSectorsList = useMemo(() => {
    return ALL_PARENT_SECTORS.filter(s => s !== "ALL");
  }, []);

  const sectorSummary = useMemo(() => {
    const map: Record<string, { 
      count: number; 
      turnoverCr: number;
      avgPct1d: number;
      themes: Record<string, number>; 
      setups: TopSetupItem[] 
    }> = {};

    parentSectorsList.forEach((sec) => {
      map[sec] = { count: 0, turnoverCr: 0, avgPct1d: 0, themes: {}, setups: [] };
    });

    topSetups.forEach((setup) => {
      const sec = setup.sector || "Diversified";
      if (!map[sec]) {
        map[sec] = { count: 0, turnoverCr: 0, avgPct1d: 0, themes: {}, setups: [] };
      }
      map[sec].count += 1;
      map[sec].turnoverCr += (setup.turnover_cr || 0);
      map[sec].setups.push(setup);

      const th = setup.theme || "General";
      map[sec].themes[th] = (map[sec].themes[th] || 0) + 1;
    });

    // Compute average % return per sector
    Object.keys(map).forEach((sec) => {
      if (map[sec].count > 0) {
        const sumPct = map[sec].setups.reduce((sum, s) => sum + (s.pct1d || 0), 0);
        map[sec].avgPct1d = sumPct / map[sec].count;
      }
    });

    return map;
  }, [topSetups, parentSectorsList]);

  // Rank Themes by Breakout Intensity (Sympathy Clusters with Alpha Leaders)
  const themeRankings = useMemo(() => {
    const themeMap: Record<string, { 
      sector: string; 
      setups: TopSetupItem[]; 
      totalTurnover: number;
    }> = {};

    topSetups.forEach((setup) => {
      const th = setup.theme;
      if (!th || th === "Diversified" || th === "General") return;

      if (!themeMap[th]) {
        themeMap[th] = {
          sector: setup.sector || "Diversified",
          setups: [],
          totalTurnover: 0,
        };
      }
      themeMap[th].setups.push(setup);
      themeMap[th].totalTurnover += (setup.turnover_cr || 0);
    });

    return Object.entries(themeMap)
      .map(([theme, data]) => {
        // Find Alpha Leader (highest 1D gain + high volume)
        const sorted = [...data.setups].sort((a, b) => (b.pct1d || 0) - (a.pct1d || 0));
        const alphaLeader = sorted[0];
        const avgPct = data.setups.reduce((sum, s) => sum + (s.pct1d || 0), 0) / data.setups.length;

        return {
          theme,
          sector: data.sector,
          count: data.setups.length,
          alphaLeader,
          avgPct,
          totalTurnover: data.totalTurnover,
          symbols: data.setups.map(s => s.symbol),
        };
      })
      .sort((a, b) => b.count - a.count || b.totalTurnover - a.totalTurnover);
  }, [topSetups]);

  // Themes filtered by selected parent sector if any
  const filteredThemeRankings = useMemo(() => {
    if (selectedSector === "All") return themeRankings;
    return themeRankings.filter((t) => t.sector === selectedSector);
  }, [themeRankings, selectedSector]);

  const multiStockClusters = useMemo(() => {
    return filteredThemeRankings.filter((t) => t.count >= 2);
  }, [filteredThemeRankings]);

  // Displayed themes list (clusters only or all)
  const displayedThemes = useMemo(() => {
    if (clusterFilterMode === "clusters_only" && multiStockClusters.length > 0) {
      return multiStockClusters;
    }
    return showAllThemes ? filteredThemeRankings : filteredThemeRankings.slice(0, 8);
  }, [filteredThemeRankings, multiStockClusters, clusterFilterMode, showAllThemes]);

  // Handle Sort Click
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  // Filtered & Sorted Setups Table
  const filteredAndSortedSetups = useMemo(() => {
    const result = topSetups.filter((s) => {
      // 1. Sector Filter
      if (selectedSector !== "All" && s.sector !== selectedSector) return false;

      // 2. Text Search
      if (themeSearch.trim()) {
        const q = themeSearch.toLowerCase().trim();
        const matchesTheme = s.theme?.toLowerCase().includes(q);
        const matchesSymbol = s.symbol.toLowerCase().includes(q);
        const matchesSec = s.sector?.toLowerCase().includes(q);
        if (!matchesTheme && !matchesSymbol && !matchesSec) return false;
      }

      // 3. Min Turnover
      if (minTurnoverCr > 0 && (s.turnover_cr || 0) < minTurnoverCr) return false;

      // 4. Quick Filter Pills
      if (quickFilter === "a_plus" && !s.grade?.includes("A+") && (s.score || 0) < 80) return false;
      if (quickFilter === "high_rvol" && (s.rvol || 0) < 2.0) return false;
      if (quickFilter === "strong_clv" && (s.clv || 0) < 0.75) return false;
      if (quickFilter === "high_momentum" && (s.pct5d || 0) < 10.0) return false;
      if (quickFilter === "institutional" && (s.turnover_cr || 0) < 25.0) return false;

      return true;
    });

    // Sort Results
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "symbol") {
        valA = a.symbol || "";
        valB = b.symbol || "";
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }

      valA = Number(valA) || 0;
      valB = Number(valB) || 0;
      return sortAsc ? valA - valB : valB - valA;
    });

    return result;
  }, [topSetups, selectedSector, themeSearch, minTurnoverCr, quickFilter, sortField, sortAsc]);

  const formattedActiveDate = new Date(activeDate).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return (
    <div className="space-y-4">
      {/* 🌟 Master Header: 2-Tier Institutional Command Bar */}
      <div className="bg-slate-900 border border-slate-800/90 rounded-2xl shadow-xl overflow-hidden">
        {/* TIER 1: Title, Subtitle & Global Action Telemetry */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 p-4 md:px-5 md:py-4 border-b border-slate-800/80">
          {/* Left: Branding & Overview */}
          <div className="flex items-center gap-3">
            <span className="p-2.5 rounded-xl bg-indigo-600/20 border border-indigo-500/40 text-indigo-400 shrink-0">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-lg md:text-xl font-bold text-slate-100 tracking-tight flex items-center gap-2">
                <span>Sectors &amp; Themes Leadership Matrix</span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Relative Strength (RS), Volume Quality (RVOL), and Hot Sympathy Wave Clusters
              </p>
            </div>
          </div>

          {/* Right: Key Telemetry Metrics & Global Watchlist Copy Button */}
          <div className="flex items-center gap-2.5 self-start md:self-auto shrink-0">
            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/90 px-3 py-1.5 rounded-xl text-xs font-mono h-9">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Setups:</span>
              <span className="font-bold text-emerald-400">{topSetups.length} Stocks</span>
            </div>

            <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/90 px-3 py-1.5 rounded-xl text-xs font-mono h-9">
              <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Inflow:</span>
              <span className="font-bold text-cyan-300">₹{totalSetupTurnoverCr.toFixed(0)} Cr</span>
            </div>

            {topSetups.length > 0 && (
              <button
                onClick={() => copySymbolsToClipboard(filteredAndSortedSetups.map(s => s.symbol), 'all')}
                className="h-9 px-3.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-1.5 cursor-pointer shrink-0 whitespace-nowrap"
                title="Copy all filtered symbols formatted as NSE:SYMBOL for TradingView watchlist"
              >
                {copiedKey === 'all' ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
                <span>{copiedKey === 'all' ? "Copied!" : `Copy ${filteredAndSortedSetups.length} Watchlist`}</span>
              </button>
            )}
          </div>
        </div>

        {/* TIER 2: Dedicated Chronological Session Navigator Ribbon */}
        {onDateChange && allDates.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 px-4 md:px-5 py-2.5 bg-slate-950/60 text-xs">
            {/* Left: Date Stepper Controls */}
            <div className="flex items-center gap-2 font-mono">
              <span className="text-[11px] text-slate-500 uppercase font-bold tracking-wider hidden sm:inline mr-1">
                Session:
              </span>

              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5 shadow-inner">
                <button
                  onClick={handlePrevDay}
                  disabled={!hasPrevDate}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                    hasPrevDate 
                      ? "bg-slate-800/90 hover:bg-slate-700 text-slate-200 cursor-pointer" 
                      : "text-slate-600 cursor-not-allowed opacity-50"
                  }`}
                  title="Previous Trading Session (←)"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="text-[11px] font-bold">Prev</span>
                </button>

                <div className="px-3.5 py-1 text-slate-100 font-bold flex items-center gap-1.5 whitespace-nowrap">
                  <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                  <span>{formattedActiveDate}</span>
                </div>

                <button
                  onClick={handleNextDay}
                  disabled={!hasNextDate}
                  className={`px-2.5 py-1 rounded-lg flex items-center gap-1 transition-all ${
                    hasNextDate 
                      ? "bg-slate-800/90 hover:bg-slate-700 text-slate-200 cursor-pointer" 
                      : "text-slate-600 cursor-not-allowed opacity-50"
                  }`}
                  title="Next Trading Session (→)"
                >
                  <span className="text-[11px] font-bold">Next</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>

              <button
                onClick={handleLatestDay}
                className="px-2.5 py-1 bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/60 rounded-xl text-[11px] font-bold transition-all cursor-pointer"
                title="Jump to Latest Session"
              >
                Latest
              </button>
            </div>

            {/* Right: Active Macro Regime & Theme Stats */}
            <div className="flex items-center gap-3 text-slate-400 font-mono text-[11px]">
              {activeData && (
                <div className="hidden lg:flex items-center gap-2">
                  <span className="text-slate-500">Regime:</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-800 text-slate-200 font-bold">
                    {activeData.Macro_Regime || "🟡 Selective Regime"}
                  </span>
                </div>
              )}

              <span className="hidden sm:inline text-slate-600">•</span>

              <span className="text-slate-300">
                <strong className="text-cyan-300">{themeRankings.length}</strong> Granular Themes Active
              </span>
            </div>
          </div>
        )}
      </div>

      {/* 🔥 Hot Sympathy Wave Clusters (Themes with Multiple Concurrent Breakouts) */}
      {filteredThemeRankings.length > 0 && (
        <div className="bg-slate-900 border border-slate-800/90 p-4 md:p-5 rounded-2xl shadow-lg space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-800/80 pb-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="flex items-center gap-2">
                <Flame className="w-4 h-4 text-amber-400" />
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  {selectedSector !== "All" ? `${selectedSector} Sub-Themes` : "Hot Sympathy Wave Clusters"}
                </h3>
              </div>

              {selectedSector !== "All" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                    Parent: {selectedSector}
                  </span>
                  <button
                    onClick={() => {
                      setSelectedSector("All");
                      setThemeSearch("");
                    }}
                    className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                  >
                    Show All Sectors
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Segmented Filter: Multi-Stock Waves vs All Themes */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 text-[11px]">
                <button
                  onClick={() => setClusterFilterMode("clusters_only")}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer flex items-center gap-1 ${
                    clusterFilterMode === "clusters_only"
                      ? "bg-amber-950 text-amber-300 border border-amber-800/80 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Show only themes with 2+ simultaneous breakout stocks (institutional basket buying)"
                >
                  <Flame className="w-3 h-3 text-amber-400" />
                  <span>Multi-Stock Waves ({multiStockClusters.length})</span>
                </button>

                <button
                  onClick={() => setClusterFilterMode("all")}
                  className={`px-2.5 py-1 rounded-md font-bold transition-colors cursor-pointer ${
                    clusterFilterMode === "all"
                      ? "bg-slate-800 text-slate-200 border border-slate-700 shadow-sm"
                      : "text-slate-400 hover:text-slate-200"
                  }`}
                  title="Show all themes including single-stock breakouts"
                >
                  <span>All Themes ({filteredThemeRankings.length})</span>
                </button>
              </div>

              {clusterFilterMode === "all" && filteredThemeRankings.length > 8 && (
                <button
                  onClick={() => setShowAllThemes(!showAllThemes)}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 rounded-lg text-xs font-bold transition-colors cursor-pointer"
                >
                  {showAllThemes ? "Show Top 8" : `Show All ${filteredThemeRankings.length}`}
                </button>
              )}
            </div>
          </div>

          {displayedThemes.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              No multi-stock sympathy clusters found for this selection. Switch to &quot;All Themes&quot; to view single-stock breakouts.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {displayedThemes.map((t) => {
              const isSelected = themeSearch.toLowerCase() === t.theme.toLowerCase();
              const copyKey = `theme-${t.theme}`;

              return (
                <div
                  key={t.theme}
                  onClick={() => {
                    setSelectedSector(t.sector);
                    setThemeSearch(t.theme);
                  }}
                  className={`bg-slate-950/80 border p-3 rounded-xl transition-all shadow-sm flex flex-col justify-between gap-2.5 cursor-pointer group ${
                    isSelected 
                      ? "border-amber-500 ring-1 ring-amber-500/50 bg-slate-900" 
                      : "border-slate-800/90 hover:border-amber-500/70 hover:bg-slate-900/90"
                  }`}
                >
                  <div>
                    {/* Theme Header & Sympathy Count */}
                    <div className="flex items-center justify-between gap-2">
                      <span 
                        className="text-xs font-bold text-slate-200 group-hover:text-amber-300 transition-colors truncate"
                        title={t.theme}
                      >
                        {t.theme}
                      </span>
                      <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-950/90 text-amber-300 border border-amber-800/80 shrink-0">
                        {t.count} {t.count === 1 ? "Stock" : "Stocks"}
                      </span>
                    </div>

                    {/* Sector Tag */}
                    <div className="text-[10px] text-slate-500 truncate mt-0.5">
                      {t.sector}
                    </div>

                    {/* Alpha Leader Badge */}
                    {t.alphaLeader && (
                      <div className="mt-2 bg-slate-900/90 border border-slate-800 p-1.5 px-2 rounded-lg flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 text-[10px]">👑 Anchor Leader:</span>
                        <div className="flex items-center gap-1.5 font-mono font-bold">
                          <span className="text-slate-100">{t.alphaLeader.symbol}</span>
                          <span className={t.alphaLeader.pct1d >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {t.alphaLeader.pct1d >= 0 ? `+${t.alphaLeader.pct1d.toFixed(1)}%` : `${t.alphaLeader.pct1d.toFixed(1)}%`}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Card Bottom Actions: Filter & 1-Click Copy */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80 text-[10px]">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copySymbolsToClipboard(t.symbols, copyKey);
                      }}
                      className="text-slate-400 hover:text-amber-300 flex items-center gap-1 transition-colors cursor-pointer"
                      title="Copy theme symbols for TradingView"
                    >
                      {copiedKey === copyKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                      <span>{copiedKey === copyKey ? "Copied" : "Copy Theme"}</span>
                    </button>

                    <span className="text-cyan-400 group-hover:text-cyan-300 font-medium flex items-center gap-0.5 transition-colors">
                      <span>Filter Table</span>
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          )}
        </div>
      )}

      {/* 📊 Parent Sectors Flow & Momentum Grid */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-3.5 h-3.5 text-indigo-400" />
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
              Parent Sector Capital Flow & Setup Density
            </h3>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="flex items-center gap-1 text-amber-400 bg-amber-950/60 border border-amber-800/60 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
              <span>Pulsing Dot = Hot Sector (3+ Breakouts)</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2.5">
          {/* ALL Sectors Button */}
          <button
            onClick={() => {
              setSelectedSector("All");
              setThemeSearch("");
            }}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              selectedSector === "All" && !themeSearch
                ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/50"
                : "bg-slate-900/70 border-slate-800 text-slate-300 hover:bg-slate-800/80"
            }`}
          >
            <div className="text-[10px] font-bold uppercase text-slate-400">All Parent Sectors</div>
            <div className="text-base font-mono font-bold mt-1 text-slate-100">{topSetups.length} Setups</div>
            <div className="text-[10px] font-mono text-cyan-300 mt-0.5">₹{totalSetupTurnoverCr.toFixed(0)} Cr Total</div>
          </button>

          {/* Individual Parent Sectors (Excluding duplicate "ALL") */}
          {parentSectorsList.map((sec) => {
            const secData = sectorSummary[sec];
            const count = secData?.count || 0;
            const turnoverCr = secData?.turnoverCr || 0;
            const avgPct = secData?.avgPct1d || 0;
            const isSelected = selectedSector === sec;
            const isHot = count >= 3;

            return (
              <button
                key={sec}
                onClick={() => {
                  setSelectedSector(sec);
                  setThemeSearch("");
                }}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
                  isSelected
                    ? "bg-indigo-600/20 border-indigo-500 text-white shadow-md ring-1 ring-indigo-500/50"
                    : count > 0
                    ? "bg-slate-900/80 border-slate-800 text-slate-200 hover:bg-slate-800 hover:border-slate-700"
                    : "bg-slate-950/40 border-slate-900 text-slate-500 hover:bg-slate-900/40"
                }`}
              >
                {isHot && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400 animate-pulse shadow-sm shadow-amber-400/50" title="Hot Sector (3+ active setups)" />
                )}
                <div className="text-[10px] font-bold uppercase tracking-tight truncate text-slate-400 pr-2" title={sec}>
                  {sec}
                </div>
                <div className="flex items-baseline justify-between gap-1 mt-1">
                  <span className={`text-base font-mono font-bold ${count > 0 ? "text-emerald-400" : "text-slate-600"}`}>
                    {count} {count === 1 ? "Setup" : "Setups"}
                  </span>
                  {count > 0 && (
                    <span className={`text-[10px] font-mono font-bold ${avgPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {avgPct >= 0 ? `+${avgPct.toFixed(1)}%` : `${avgPct.toFixed(1)}%`}
                    </span>
                  )}
                </div>
                <div className="text-[10px] font-mono text-slate-500 mt-0.5">
                  {turnoverCr > 0 ? `₹${turnoverCr.toFixed(0)} Cr Inflow` : "No Active Flow"}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 🎯 Breakout Stocks Leadership Table (With Multi-Metric Sorting & Quick Filters) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl space-y-0">
        {/* Table Filters & Search Toolbar */}
        <div className="p-4 border-b border-slate-800 bg-slate-950/80 space-y-3">
          {/* Top Row: Search Input + Min Turnover + Count Summary */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={themeSearch}
                  onChange={(e) => setThemeSearch(e.target.value)}
                  placeholder="Search symbol, sector or theme..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-indigo-500 w-52 sm:w-64"
                />
                {themeSearch && (
                  <button 
                    onClick={() => setThemeSearch("")}
                    className="absolute right-2.5 top-2 text-slate-500 hover:text-slate-300 text-xs font-bold"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="hidden sm:inline">Min Turnover:</span>
                <select
                  value={minTurnoverCr}
                  onChange={(e) => setMinTurnoverCr(Number(e.target.value))}
                  className="bg-slate-950 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none cursor-pointer"
                >
                  <option value={0}>All Turnover</option>
                  <option value={5}>&gt; ₹5 Cr</option>
                  <option value={10}>&gt; ₹10 Cr</option>
                  <option value={25}>&gt; ₹25 Cr (Institutional)</option>
                  <option value={50}>&gt; ₹50 Cr (Mega Liquid)</option>
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs text-slate-400 font-mono">
              <span>Showing <strong className="text-slate-100">{filteredAndSortedSetups.length}</strong> of {topSetups.length} Setups</span>
            </div>
          </div>

          {/* Bottom Row: Quick Filter Badges */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mr-1">
              <Filter className="w-3 h-3" /> Quick Filter:
            </span>

            {[
              { id: "all", label: "All Setups" },
              { id: "a_plus", label: "🏆 A+ Prime Breakouts" },
              { id: "high_rvol", label: "⚡ High RVOL (> 2.0x Volume)" },
              { id: "strong_clv", label: "🟢 Strong Closes (CLV > 75%)" },
              { id: "high_momentum", label: "🚀 5D Momentum (> 10%)" },
              { id: "institutional", label: "🏛️ Institutional (> ₹25 Cr)" },
            ].map((f) => {
              const isActive = quickFilter === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setQuickFilter(f.id as QuickFilter)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                    isActive
                      ? "bg-indigo-600 text-white font-bold shadow-sm"
                      : "bg-slate-950 hover:bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200"
                  }`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Stock List Table (Fluid smooth page scrolling) */}
        <div className="overflow-x-auto [contain:paint]">
          <table className="w-full min-w-[960px] text-xs text-left border-collapse table-fixed">
            <thead className="text-[10px] uppercase bg-slate-950 text-slate-400 sticky top-0 z-20 border-b border-slate-800 select-none">
              <tr>
                {/* Symbol */}
                <th 
                  onClick={() => handleSort("symbol")}
                  className="w-36 px-4 py-3 font-bold cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center gap-1">
                    <span>Symbol</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>

                {/* Sector & Theme */}
                <th className="w-56 px-3 py-3 font-bold">Sector & Micro-Theme</th>

                {/* Grade / Score */}
                <th 
                  onClick={() => handleSort("score")}
                  className="w-28 px-3 py-3 font-bold cursor-pointer hover:text-slate-200 text-center"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Grade / Score</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>

                {/* 1D % Change */}
                <th 
                  onClick={() => handleSort("pct1d")}
                  className="w-28 px-3 py-3 font-bold text-right cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>1D % Change</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>

                {/* 5D Momentum */}
                <th 
                  onClick={() => handleSort("pct5d")}
                  className="w-28 px-3 py-3 font-bold text-right cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>5D Momentum</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>

                {/* RVOL Volume Multiple */}
                <th 
                  onClick={() => handleSort("rvol")}
                  className="w-28 px-3 py-3 font-bold text-center cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>RVOL Multiple</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>

                {/* Close Location Value (CLV Bar) */}
                <th 
                  onClick={() => handleSort("clv")}
                  className="w-36 px-3 py-3 font-bold text-center cursor-pointer hover:text-slate-200"
                  title="🟢 Green: >=75% (Closed near High), 🟡 Amber: 45-74% (Mid), 🔴 Red: <45% (Upper Wick Rejection)"
                >
                  <div className="flex items-center justify-center gap-1">
                    <span>Closing Strength (CLV)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>

                {/* Turnover */}
                <th 
                  onClick={() => handleSort("turnover_cr")}
                  className="w-32 px-3 py-3 font-bold text-right cursor-pointer hover:text-slate-200"
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>Turnover ₹ Cr</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-600" />
                  </div>
                </th>

                {/* Chart Trigger */}
                <th className="w-20 px-3 py-3 font-bold text-center">Chart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50 font-mono">
              {filteredAndSortedSetups.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 font-sans">
                    No matching stocks found for the active filter criteria.
                  </td>
                </tr>
              ) : (
                filteredAndSortedSetups.map((stock) => {
                  const turnoverCr = stock.turnover_cr !== undefined ? stock.turnover_cr.toFixed(1) : "-";
                  const pct1d = stock.pct1d;
                  const pct5d = stock.pct5d;
                  const rvol = stock.rvol ?? 1.0;
                  const clv = stock.clv ?? 0.5;
                  const clvPct = Math.round(clv * 100);
                  const isAPlus = stock.grade?.includes("A+") || (stock.score || 0) >= 80;

                  return (
                    <tr
                      key={stock.symbol}
                      onClick={() => onOpenStockChart(stock.symbol, stock.sector, stock.theme, pct1d)}
                      className="hover:bg-slate-800/60 transition-colors cursor-pointer group"
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '42px' }}
                    >
                      {/* Symbol */}
                      <td className="px-4 py-2.5 font-bold text-slate-100 group-hover:text-cyan-300 transition-colors">
                        <div className="flex items-center gap-2">
                          <span>{stock.symbol}</span>
                          {isAPlus && (
                            <span className="text-[9px] font-sans font-bold px-1.5 py-0.2 rounded bg-amber-950 text-amber-300 border border-amber-800/80">
                              A+
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Sector & Theme */}
                      <td className="px-3 py-2.5 font-sans">
                        <div className="text-slate-300 text-xs font-medium truncate max-w-[180px]">
                          {stock.sector || "Diversified"}
                        </div>
                        <div className="text-cyan-400 text-[11px] font-semibold truncate max-w-[180px]">
                          {stock.theme || "-"}
                        </div>
                      </td>

                      {/* Grade / Score */}
                      <td className="px-3 py-2.5 text-center">
                        <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                          isAPlus 
                            ? "bg-emerald-950 text-emerald-300 border border-emerald-800/80" 
                            : (stock.score || 0) >= 65 
                            ? "bg-slate-800 text-slate-300" 
                            : "bg-slate-900 text-slate-500"
                        }`}>
                          {stock.score || "-"} pts
                        </span>
                      </td>

                      {/* 1D % Change */}
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                        {pct1d !== undefined ? (
                          <span className={pct1d >= 0 ? "text-emerald-400 text-xs" : "text-rose-400 text-xs"}>
                            {pct1d >= 0 ? `+${pct1d.toFixed(2)}%` : `${pct1d.toFixed(2)}%`}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* 5D Momentum */}
                      <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                        {pct5d !== undefined ? (
                          <span className={pct5d >= 0 ? "text-emerald-400" : "text-rose-400"}>
                            {pct5d >= 0 ? `+${pct5d.toFixed(1)}%` : `${pct5d.toFixed(1)}%`}
                          </span>
                        ) : (
                          "-"
                        )}
                      </td>

                      {/* RVOL Volume Multiple */}
                      <td className="px-3 py-2.5 text-center font-bold">
                        <span className={`text-[11px] px-2 py-0.5 rounded font-mono ${
                          rvol >= 2.5 
                            ? "bg-cyan-950 text-cyan-300 border border-cyan-800/80 font-bold" 
                            : rvol >= 1.5 
                            ? "bg-indigo-950 text-indigo-300 border border-indigo-800/60" 
                            : "text-slate-400"
                        }`}>
                          {rvol.toFixed(1)}x Vol
                        </span>
                      </td>

                      {/* CLV Closing Strength Bar */}
                      <td className="px-3 py-2.5 text-center">
                        <div className="flex items-center justify-center gap-1.5" title={`Close Location Value: ${clvPct}% (${clv >= 0.75 ? "🟢 Strong Close at Highs" : clv >= 0.45 ? "🟡 Mid-range Close" : "🔴 Upper Wick Rejection"})`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            clv >= 0.75 ? "bg-emerald-400" : clv >= 0.45 ? "bg-amber-400" : "bg-rose-400"
                          }`} />
                          <div className="w-12 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                clv >= 0.75 ? "bg-emerald-400" : clv >= 0.45 ? "bg-amber-400" : "bg-rose-400"
                              }`}
                              style={{ width: `${clvPct}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold ${
                            clv >= 0.75 ? "text-emerald-400" : clv >= 0.45 ? "text-amber-400" : "text-rose-400"
                          }`}>
                            {clvPct}%
                          </span>
                        </div>
                      </td>

                      {/* Turnover */}
                      <td className="px-3 py-2.5 text-right text-slate-300 tabular-nums font-bold">
                        ₹{turnoverCr} Cr
                      </td>

                      {/* Chart Button */}
                      <td className="px-3 py-2.5 text-center">
                        <span className="px-2.5 py-1 rounded-lg bg-slate-800 group-hover:bg-cyan-600 text-slate-300 group-hover:text-white text-[10px] font-sans font-medium transition-all shadow-sm">
                          Chart
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
