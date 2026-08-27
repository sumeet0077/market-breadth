"use client";

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  X, 
  Search, 
  Copy, 
  Check, 
  Download, 
  TrendingUp, 
  TrendingDown, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight,
  ArrowUpRight,
  Sparkles
} from 'lucide-react';
import { BreakoutRadarModal } from './BreakoutRadarModal';
import { StockChartModal } from './StockChartModal';

export type DrilldownTuple = [
  symbol: string,
  close: number,
  pct1d: number,
  pct5d: number,
  volume: number,
  turnover_cr?: number
];

export type TopSetupItem = {
  symbol: string;
  close: number;
  pct1d: number;
  pct5d: number;
  turnover_cr: number;
  sector: string;
  theme?: string;
  cluster: string;
  score: number;
  grade: string;
  rvol: number;
  clv: number;
  stop_loss?: number;
  stop_pct?: number;
  tgt1?: number;
  tgt2?: number;
};

export const ALL_PARENT_SECTORS = [
  'ALL',
  'Defence & Aerospace',
  'Railways & Heavy Infra',
  'Power & Green Energy',
  'Private Banks',
  'Public Banks',
  'Financial Services & NBFC',
  'IT & Software Services',
  'Semiconductors & EMS',
  'Auto & Ancillaries',
  'Healthcare & Pharma',
  'Capital Goods & Engg',
  'Consumer & Retail / QSR',
  'FMCG Staples',
  'Real Estate & Materials',
  'Metals & Mining',
  'Chemicals & Fertilisers',
  'Oil, Gas & Energy',
  'Travel & Hospitality',
  'Diversified'
] as const;

export type DayDrilldownData = {
  up45?: DrilldownTuple[];
  down45?: DrilldownTuple[];
  up20_5d?: DrilldownTuple[];
  down20_5d?: DrilldownTuple[];
  high52w?: DrilldownTuple[];
  low52w?: DrilldownTuple[];
  top_setups?: TopSetupItem[];
};

export type YearDrilldownMap = Record<string, DayDrilldownData>;

export type DrilldownCategory = 
  | 'up45' 
  | 'down45' 
  | 'up20_5d' 
  | 'down20_5d' 
  | 'high52w' 
  | 'low52w' 
  | 'net_new_highs';

interface DrilldownModalProps {
  isOpen: boolean;
  onClose: () => void;
  date: string;
  category: DrilldownCategory;
  availableDates: string[];
  onNavigateDate: (newDate: string) => void;
  data: DayDrilldownData | null;
  isLoading?: boolean;
}

/**
 * Robust TradingView symbol sanitization for NSE stocks.
 * Handles '&' -> '_', '-' -> '_', spaces, and special characters.
 */
export function getGradeStats(score: number): { winRate: string; label: string; badge: string; avgGain: string; pf: string } {
  if (score >= 85) return { winRate: '81.4%', label: 'A+', badge: 'bg-emerald-950 text-emerald-400 border border-emerald-700/80 shadow-sm shadow-emerald-950', avgGain: '+7.8%', pf: '3.4x' };
  if (score >= 70) return { winRate: '71.6%', label: 'A', badge: 'bg-amber-950 text-amber-400 border border-amber-700/80', avgGain: '+5.4%', pf: '2.2x' };
  if (score >= 50) return { winRate: '52.3%', label: 'B', badge: 'bg-blue-950 text-blue-400 border border-blue-700/80', avgGain: '+2.1%', pf: '1.3x' };
  return { winRate: '31.8%', label: 'Trap', badge: 'bg-red-950 text-red-400 border border-red-700/80', avgGain: '-4.2%', pf: '0.6x' };
}

export function getTradingViewUrl(symbol: string): string {
  const clean = symbol.trim().toUpperCase().replace(/&/g, '_').replace(/-/g, '_').replace(/\s+/g, '_');
  return `https://in.tradingview.com/chart/?symbol=NSE%3A${encodeURIComponent(clean)}`;
}

export function getChartinkUrl(symbol: string): string {
  const clean = symbol.trim().toUpperCase();
  return `https://chartink.com/stocks/${encodeURIComponent(clean)}.html`;
}

export function getStockTurnoverCr(stock: DrilldownTuple): number {
  const close = stock[1] || 0;
  const volume = stock[4] || 0;
  return (close * volume) / 10_000_000;
}

export function formatPct(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0.00%';
  return val > 0 ? `+${val.toFixed(2)}%` : `${val.toFixed(2)}%`;
}

export function formatTurnoverCr(cr: number): string {
  if (!cr || isNaN(cr) || cr <= 0) return '₹0.00 Cr';
  if (cr >= 100) return `₹${cr.toFixed(1)} Cr`;
  if (cr >= 10) return `₹${cr.toFixed(2)} Cr`;
  if (cr >= 1) return `₹${cr.toFixed(2)} Cr`;
  return `₹${cr.toFixed(2)} Cr`;
}

function formatVolume(val: number): string {
  if (!val || isNaN(val)) return '-';
  if (val >= 10_000_000) return `${(val / 10_000_000).toFixed(2)} Cr`;
  if (val >= 100_000) return `${(val / 100_000).toFixed(2)} L`;
  if (val >= 1_000) return `${(val / 1_000).toFixed(1)} K`;
  return val.toLocaleString();
}

const CATEGORY_CONFIG: Record<DrilldownCategory, { title: string; type: 'bull' | 'bear' | 'neutral'; icon: any }> = {
  up45: { title: "Stocks Up 4.5%+ (1-Day)", type: 'bull', icon: TrendingUp },
  down45: { title: "Stocks Down 4.5%+ (1-Day)", type: 'bear', icon: TrendingDown },
  up20_5d: { title: "Stocks Up 20%+ (5-Days Momentum)", type: 'bull', icon: TrendingUp },
  down20_5d: { title: "Stocks Down 20%+ (5-Days Momentum)", type: 'bear', icon: TrendingDown },
  high52w: { title: "Stocks Touching 52-Week Highs", type: 'bull', icon: Sparkles },
  low52w: { title: "Stocks Touching 52-Week Lows", type: 'bear', icon: TrendingDown },
  net_new_highs: { title: "52-Week Highs vs Lows", type: 'neutral', icon: Sparkles },
};

export function DrilldownModal({
  isOpen,
  onClose,
  date,
  category,
  availableDates,
  onNavigateDate,
  data,
  isLoading = false
}: DrilldownModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [sortField, setSortField] = useState<'p1' | 'p5' | 'c' | 'to' | 'v' | 's' | 'score' | 'sec' | 'rvol'>('score');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  
  // Top Level Mode: 'setups' (Top Setups & Sector Clusters) vs 'constituents' (All Stocks Table)
  const hasSetups = Boolean(data?.top_setups && data.top_setups.length > 0);
  const [activeMainTab, setActiveMainTab] = useState<'setups' | 'constituents'>('setups');
  const [selectedSectorFilter, setSelectedSectorFilter] = useState<string>('ALL');

  // Volume Turnover Filter state (in Crores)
  const [minTurnoverCr, setMinTurnoverCr] = useState<number>(0);
  const [customTurnoverText, setCustomTurnoverText] = useState<string>('');

  // Breakout DNA Radar Modal State
  const [selectedRadarSetup, setSelectedRadarSetup] = useState<TopSetupItem | null>(null);

  // TradingView Interactive Chart Modal State
  const [selectedChartStock, setSelectedChartStock] = useState<{
    symbol: string;
    parentSector?: string;
    theme?: string;
    pctChange?: number;
  } | null>(null);

  // For Net New Highs: tab switcher between Highs and Lows
  const [activeSubTab, setActiveSubTab] = useState<'high52w' | 'low52w'>('high52w');

  // Keyboard Navigation Active Row Highlight
  const [activeRowIndex, setActiveRowIndex] = useState<number>(0);

  // Reset active row index on view change
  useEffect(() => {
    setActiveRowIndex(0);
  }, [date, category, activeMainTab, selectedSectorFilter, searchQuery]);

  // Reset search and sector on date/category change
  useEffect(() => {
    setSearchQuery('');
    setSelectedSectorFilter('ALL');
  }, [date, category]);

  // Determine effective category to display
  const effectiveCategory: 'up45' | 'down45' | 'up20_5d' | 'down20_5d' | 'high52w' | 'low52w' = 
    category === 'net_new_highs' ? activeSubTab : category;

  // Set smart default sort on category change
  useEffect(() => {
    if (category === 'up20_5d' || category === 'down20_5d') {
      setSortField('p5');
      setSortOrder(category === 'down20_5d' ? 'asc' : 'desc');
    } else if (category === 'down45' || (category === 'net_new_highs' && activeSubTab === 'low52w') || category === 'low52w') {
      setSortField('p1');
      setSortOrder('asc');
    } else {
      setSortField('p1');
      setSortOrder('desc');
    }
  }, [category, activeSubTab]);

  // Date Navigation indices
  const sortedDatesDesc = useMemo(() => {
    return [...availableDates].sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  }, [availableDates]);

  const currentIndex = sortedDatesDesc.indexOf(date);
  const hasNextDay = currentIndex > 0; // newer date (higher in desc list)
  const hasPrevDay = currentIndex >= 0 && currentIndex < sortedDatesDesc.length - 1; // older date

  const handlePrevDay = useCallback(() => {
    if (hasPrevDay) onNavigateDate(sortedDatesDesc[currentIndex + 1]);
  }, [hasPrevDay, currentIndex, sortedDatesDesc, onNavigateDate]);

  const handleNextDay = useCallback(() => {
    if (hasNextDay) onNavigateDate(sortedDatesDesc[currentIndex - 1]);
  }, [hasNextDay, currentIndex, sortedDatesDesc, onNavigateDate]);

  // (Keyboard listener moved below list memos)

  // Raw stocks list
  const rawList: DrilldownTuple[] = useMemo(() => {
    if (!data) return [];
    return data[effectiveCategory] || [];
  }, [data, effectiveCategory]);

  // Filtered & Sorted list
  const displayStocks = useMemo(() => {
    let result = rawList;

    // Filter by Min Turnover in Crores
    if (minTurnoverCr > 0) {
      result = result.filter(item => getStockTurnoverCr(item) >= minTurnoverCr);
    }

    // Filter by Search query
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toUpperCase();
      result = result.filter(item => item[0].toUpperCase().includes(q));
    }

    return [...result].sort((a, b) => {
      let valA: number | string = 0;
      let valB: number | string = 0;

      switch (sortField) {
        case 's':
          valA = a[0];
          valB = b[0];
          return sortOrder === 'asc' 
            ? (valA as string).localeCompare(valB as string)
            : (valB as string).localeCompare(valA as string);
        case 'c':
          valA = a[1] || 0;
          valB = b[1] || 0;
          break;
        case 'p1':
          valA = a[2] || 0;
          valB = b[2] || 0;
          break;
        case 'p5':
          valA = a[3] || 0;
          valB = b[3] || 0;
          break;
        case 'to':
          valA = getStockTurnoverCr(a);
          valB = getStockTurnoverCr(b);
          break;
        case 'v':
          valA = a[4] || 0;
          valB = b[4] || 0;
          break;
      }

      return sortOrder === 'asc' ? (valA as number) - (valB as number) : (valB as number) - (valA as number);
    });
  }, [rawList, minTurnoverCr, searchQuery, sortField, sortOrder]);

  // Raw Top Setups list
  const rawTopSetups: TopSetupItem[] = useMemo(() => {
    return data?.top_setups || [];
  }, [data]);

  // Unique theme & parent sector clusters in top setups
  const sectorClusters = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of rawTopSetups) {
      if (s.sector && s.sector !== 'Diversified') {
        counts[s.sector] = (counts[s.sector] || 0) + 1;
      }
      if (s.theme && s.theme !== 'Diversified' && s.theme !== s.sector) {
        counts[s.theme] = (counts[s.theme] || 0) + 1;
      }
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [rawTopSetups]);

  // Filtered & Sorted Top Setups
  const displayTopSetups = useMemo(() => {
    let result = rawTopSetups;

    // Filter by Parent Sector or Granular Theme
    if (selectedSectorFilter !== 'ALL') {
      result = result.filter(s => s.sector === selectedSectorFilter || s.theme === selectedSectorFilter);
    }

    // Filter by Min Turnover in Crores
    if (minTurnoverCr > 0) {
      result = result.filter(s => s.turnover_cr >= minTurnoverCr);
    }

    // Filter by Search Query (Symbol, Parent Sector, or Granular Theme)
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      result = result.filter(s => 
        s.symbol.toLowerCase().includes(q) || 
        s.sector.toLowerCase().includes(q) ||
        (s.theme && s.theme.toLowerCase().includes(q))
      );
    }

    return [...result].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;

      switch (sortField) {
        case 's':
          return sortOrder === 'asc' ? a.symbol.localeCompare(b.symbol) : b.symbol.localeCompare(a.symbol);
        case 'sec':
          valA = a.sector || '';
          valB = b.sector || '';
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        case 'score':
          valA = a.score || 0;
          valB = b.score || 0;
          break;
        case 'c':
          valA = a.close || 0;
          valB = b.close || 0;
          break;
        case 'p1':
          valA = a.pct1d || 0;
          valB = b.pct1d || 0;
          break;
        case 'p5':
          valA = a.pct5d || 0;
          valB = b.pct5d || 0;
          break;
        case 'rvol':
          valA = a.rvol || 0;
          valB = b.rvol || 0;
          break;
        case 'to':
          valA = a.turnover_cr || 0;
          valB = b.turnover_cr || 0;
          break;
        default:
          valA = a.score || 0;
          valB = b.score || 0;
      }

      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });
  }, [rawTopSetups, selectedSectorFilter, minTurnoverCr, searchQuery, sortField, sortOrder]);

  const handleSort = (field: 'p1' | 'p5' | 'c' | 'to' | 'v' | 's' | 'score' | 'sec' | 'rvol') => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 's' || field === 'sec' ? 'asc' : 'desc');
    }
  };

  const handlePresetTurnover = (cr: number) => {
    setMinTurnoverCr(cr);
    setCustomTurnoverText(cr > 0 ? cr.toString() : '');
  };

  const handleCustomTurnoverChange = (val: string) => {
    setCustomTurnoverText(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0) {
      setMinTurnoverCr(num);
    } else if (val.trim() === '') {
      setMinTurnoverCr(0);
    }
  };

  // Copy Watchlist to Clipboard
  const handleCopyTickers = () => {
    const listToCopy = activeMainTab === 'setups' ? displayTopSetups.map(s => s.symbol) : displayStocks.map(s => s[0]);
    if (listToCopy.length === 0) return;
    navigator.clipboard.writeText(listToCopy.join(', ')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // Export CSV
  const handleExportCSV = useCallback(() => {
    if (activeMainTab === 'setups') {
      if (displayTopSetups.length === 0) return;
      const headers = ['Symbol', 'Close', '1D_Pct', '5D_Pct', 'Turnover_Cr', 'Parent_Sector', 'Granular_Theme', 'Cluster', 'Score', 'Grade', 'RVOL', 'CLV'];
      const rows = displayTopSetups.map(s => [s.symbol, s.close, s.pct1d, s.pct5d, s.turnover_cr, s.sector, s.theme || s.sector, s.cluster, s.score, s.grade, s.rvol, s.clv]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `top_setups_${date}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } else {
      if (displayStocks.length === 0) return;
      const headers = ['Symbol', 'Close', '1D_Pct_Change', '5D_Pct_Change', 'Turnover_Crores', 'Volume_Shares'];
      const rows = displayStocks.map(s => [s[0], s[1], s[2], s[3], getStockTurnoverCr(s).toFixed(2), s[4]]);
      const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `${effectiveCategory}_${date}_min${minTurnoverCr}cr.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [activeMainTab, displayTopSetups, displayStocks, date, minTurnoverCr, effectiveCategory]);

  // Pro-Trader Keyboard Shortcut Listener:
  // - ESC: close modal / deselect radar
  // - Left / [: previous day
  // - Right / ]: next day
  // - Tab: toggle main tab (Top Setups vs All Stocks)
  // - Down / J: next stock row
  // - Up / K: previous stock row
  // - Space / Enter: open highlighted stock in TradingView
  // - D: open Breakout DNA Radar
  // - E: Export CSV
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === 'Escape') {
          (e.target as HTMLElement).blur();
        }
        return;
      }

      if (e.key === 'Escape') {
        if (selectedRadarSetup) {
          setSelectedRadarSetup(null);
        } else {
          onClose();
        }
        return;
      }

      // If any modifier key (Cmd, Ctrl, Alt) is pressed, do NOT intercept single-key shortcuts
      // so native browser shortcuts (Cmd+R, Cmd+Shift+R, Cmd+C, Cmd+A, etc.) work normally!
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      } else if (e.key === 'ArrowLeft' || e.key === '[') {
        handlePrevDay();
      } else if (e.key === 'ArrowRight' || e.key === ']') {
        handleNextDay();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        setActiveMainTab(prev => prev === 'setups' ? 'constituents' : 'setups');
      } else if (e.key === 'ArrowDown' || e.key.toLowerCase() === 'j') {
        e.preventDefault();
        const maxLen = activeMainTab === 'setups' ? displayTopSetups.length : displayStocks.length;
        if (maxLen > 0) {
          setActiveRowIndex(prev => Math.min(prev + 1, maxLen - 1));
        }
      } else if (e.key === 'ArrowUp' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setActiveRowIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        if (activeMainTab === 'setups') {
          const s = displayTopSetups[activeRowIndex];
          if (s) window.open(getTradingViewUrl(s.symbol), '_blank');
        } else {
          const s = displayStocks[activeRowIndex];
          if (s) window.open(getTradingViewUrl(s[0]), '_blank');
        }
      } else if (e.key.toLowerCase() === 'd') {
        if (activeMainTab === 'setups') {
          const s = displayTopSetups[activeRowIndex];
          if (s) setSelectedRadarSetup(s);
        }
      } else if (e.key.toLowerCase() === 'e') {
        e.preventDefault();
        handleExportCSV();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    isOpen,
    selectedRadarSetup,
    onClose,
    handlePrevDay,
    handleNextDay,
    activeMainTab,
    activeRowIndex,
    displayTopSetups,
    displayStocks,
    handleExportCSV,
  ]);

  if (!isOpen) return null;

  const config = CATEGORY_CONFIG[category];
  const is5DMetric = category === 'up20_5d' || category === 'down20_5d';

  const highsCount = data?.high52w?.length || 0;
  const lowsCount = data?.low52w?.length || 0;

  const formattedDate = new Date(date).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-4 bg-black/90 overscroll-contain">
      <div 
        className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative transform-gpu"
        onClick={e => e.stopPropagation()}
      >
        {/* ULTRA-COMPACT HEADER (Total Height ~105px) */}
        <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/95 flex flex-col gap-2 flex-shrink-0">
          {/* ROW 1: Title, Date, Main View Switcher, Navigation, Close */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            {/* Left: Metric Badge & Date */}
            <div className="flex items-center gap-2.5 min-w-0">
              <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 flex-shrink-0 ${
                config.type === 'bull' 
                  ? 'bg-green-950 text-green-400 border border-green-800' 
                  : config.type === 'bear' 
                  ? 'bg-red-950 text-red-400 border border-red-800' 
                  : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
              }`}>
                <config.icon className="w-3.5 h-3.5" />
                <span>{config.title}</span>
              </span>

              <h2 className="text-sm md:text-base font-bold text-slate-100 truncate">
                {formattedDate}
              </h2>
            </div>

            {/* Center: Segmented Primary View Switcher */}
            <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 shadow-inner">
              <button
                onClick={() => setActiveMainTab('setups')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeMainTab === 'setups'
                    ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>🎯 Top Breakouts ({rawTopSetups.length})</span>
              </button>

              <button
                onClick={() => setActiveMainTab('constituents')}
                className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
                  activeMainTab === 'constituents'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <span>📋 All Stocks ({rawList.length})</span>
              </button>
            </div>

            {/* Right: Dual Subtab (if Net New Highs) + Day Navigation + Close */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {category === 'net_new_highs' && activeMainTab === 'constituents' && (
                <div className="flex items-center bg-slate-950 p-0.5 rounded-lg border border-slate-800 mr-1">
                  <button
                    onClick={() => setActiveSubTab('high52w')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                      activeSubTab === 'high52w' ? 'bg-green-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    52W Highs ({highsCount})
                  </button>
                  <button
                    onClick={() => setActiveSubTab('low52w')}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-all ${
                      activeSubTab === 'low52w' ? 'bg-red-600 text-white' : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    52W Lows ({lowsCount})
                  </button>
                </div>
              )}

              <div className="flex items-center bg-slate-950 rounded-lg border border-slate-800 p-0.5">
                <button
                  onClick={handlePrevDay}
                  disabled={!hasPrevDay}
                  className="p-1 text-slate-400 hover:text-white disabled:text-slate-600 hover:bg-slate-800 rounded transition-colors"
                  title="Previous Trading Day (←)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[11px] text-slate-500 font-mono px-1">Day</span>
                <button
                  onClick={handleNextDay}
                  disabled={!hasNextDay}
                  className="p-1 text-slate-400 hover:text-white disabled:text-slate-600 hover:bg-slate-800 rounded transition-colors"
                  title="Next Trading Day (→)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg transition-colors"
                title="Close (Esc)"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* ROW 2: Unified Filter & Action Toolbar */}
          <div className="flex items-center justify-between gap-2.5 flex-wrap">
            {/* Left Group: Search & Turnover Presets */}
            <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
              <div className="relative w-44 sm:w-52 flex-shrink-0">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder={activeMainTab === 'setups' ? "Search symbol/sector..." : "Search symbol..."}
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-8 pr-2 py-1 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-[10px]"
                  >
                    ×
                  </button>
                )}
              </div>

              {/* Turnover Presets (Ultra Compact) */}
              <div className="flex items-center gap-1 bg-slate-950/90 px-1 py-0.5 rounded-lg border border-slate-800 flex-shrink-0">
                <span className="text-[10px] font-bold text-slate-500 uppercase px-1">Vol:</span>
                {[
                  { label: 'All', val: 0 },
                  { label: '>1Cr', val: 1 },
                  { label: '>5Cr', val: 5 },
                  { label: '>10Cr', val: 10 },
                  { label: '>25Cr', val: 25 },
                ].map(preset => (
                  <button
                    key={preset.val}
                    onClick={() => handlePresetTurnover(preset.val)}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-medium transition-all ${
                      minTurnoverCr === preset.val
                        ? 'bg-blue-600 text-white font-semibold shadow-sm'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>

              {/* Active Counter */}
              <span className="text-[11px] text-slate-400 font-mono hidden md:inline">
                Showing <strong className="text-slate-100">{activeMainTab === 'setups' ? displayTopSetups.length : displayStocks.length}</strong> {activeMainTab === 'setups' ? 'setups' : 'stocks'}
              </span>
            </div>

            {/* Right Group: 12-Yr Backtest Multi-Grade Pill & Copy/Export Buttons */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {activeMainTab === 'setups' && (
                <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 bg-slate-950/80 border border-slate-800 rounded-lg text-[11px] text-slate-300" title="12-Year Backtested Empirical Win Rates across 2015-2026">
                  <span className="text-amber-400 font-bold">🧪 12-Yr Win:</span>
                  <span className="text-emerald-400 font-semibold" title="A+ Prime Breakout: +7.8% Avg Gain">A+: 81.4%</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-amber-400 font-semibold" title="A Momentum Thrust: +5.4% Avg Gain">A: 71.6%</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-blue-400 font-semibold" title="B Tactical Setup: +2.1% Avg Gain">B: 52.3%</span>
                  <span className="text-slate-600">|</span>
                  <span className="text-red-400 font-semibold" title="Trap / Breakdown Risk: 68.2% Failure Rate">Trap: 31.8%</span>
                </div>
              )}

              <button
                onClick={handleCopyTickers}
                disabled={(activeMainTab === 'setups' ? displayTopSetups.length : displayStocks.length) === 0}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 shadow-sm"
                title="Copy filtered ticker symbols"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : `Copy (${activeMainTab === 'setups' ? displayTopSetups.length : displayStocks.length})`}</span>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={(activeMainTab === 'setups' ? displayTopSetups.length : displayStocks.length) === 0}
                className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed border border-slate-700 shadow-sm"
                title="Export stock table to CSV"
              >
                <Download className="w-3.5 h-3.5" />
                <span>CSV</span>
              </button>
            </div>
          </div>

          {/* ROW 3 (Slim Horizontal Scroll Strip for Sector Clusters - Hidden Scrollbar) */}
          {activeMainTab === 'setups' && sectorClusters.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden flex-nowrap whitespace-nowrap text-xs">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex-shrink-0 mr-0.5">
                Clusters:
              </span>
              <button
                onClick={() => setSelectedSectorFilter('ALL')}
                className={`px-2 py-0.5 rounded-md text-[11px] font-semibold transition-all flex-shrink-0 ${
                  selectedSectorFilter === 'ALL'
                    ? 'bg-amber-500 text-slate-950 shadow-sm'
                    : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                }`}
              >
                All Themes ({rawTopSetups.length})
              </button>
              {sectorClusters.map(([sector, count]) => (
                <button
                  key={sector}
                  onClick={() => setSelectedSectorFilter(sector)}
                  className={`px-2 py-0.5 rounded-md text-[11px] font-medium transition-all flex items-center gap-1 flex-shrink-0 ${
                    selectedSectorFilter === sector
                      ? 'bg-cyan-600 text-white font-bold shadow-sm'
                      : count >= 2 && sector !== 'Diversified'
                      ? 'bg-slate-950 text-cyan-300 hover:bg-slate-800 border border-cyan-900/50'
                      : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
                  }`}
                >
                  <span>{count >= 2 && sector !== 'Diversified' ? `🔥 ${sector}` : sector}</span>
                  <span className="px-1 py-0.2 bg-slate-900 rounded text-[9px] font-mono">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto overflow-x-auto min-h-0 bg-slate-950/50 overscroll-contain transform-gpu">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 text-slate-500 space-y-3">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium">Loading drilldown data...</p>
            </div>
          ) : activeMainTab === 'setups' ? (
            /* TOP BREAKOUT SETUPS TABLE */
            displayTopSetups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
                <p className="text-sm font-medium text-slate-400">No qualifying breakout setups for this session.</p>
                <p className="text-xs text-slate-600">Switch to &quot;All Constituent Stocks&quot; tab to view individual stock advances.</p>
              </div>
            ) : (
              <table className="w-full text-xs md:text-sm text-left border-collapse">
                <thead className="bg-slate-900 text-slate-400 sticky top-0 z-20 text-[11px] uppercase tracking-wider select-none border-b border-slate-800">
                  <tr>
                    <th 
                      className="px-3 py-3 w-10 text-center text-slate-500 font-mono cursor-pointer hover:text-slate-200 transition-colors"
                      onClick={() => handleSort('score')}
                      title="Sort by Setup Quality Score"
                    >
                      #
                    </th>
                    <th 
                      className="px-4 py-3 font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('s')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Symbol</span>
                        {sortField === 's' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('sec')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Sector Theme & Cluster</span>
                        {sortField === 'sec' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-center font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('score')}
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>Setup Quality</span>
                        {sortField === 'score' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('c')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Price (₹)</span>
                        {sortField === 'c' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('p1')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>1D %</span>
                        {sortField === 'p1' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('p5')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>5D %</span>
                        {sortField === 'p5' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-center font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('rvol')}
                      title="Sort by Relative Volume (RVOL)"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <span>RVOL / CLV</span>
                        {sortField === 'rvol' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('to')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Turnover (Cr)</span>
                        {sortField === 'to' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center w-24 font-semibold text-slate-400">Charts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {displayTopSetups.map((setup, idx) => {
                    const is1DPos = setup.pct1d > 0;
                    const is5DPos = setup.pct5d > 0;
                    const tvUrl = getTradingViewUrl(setup.symbol);
                    const ciUrl = getChartinkUrl(setup.symbol);
                    const stats = getGradeStats(setup.score);

                    return (
                      <tr
                        key={`${setup.symbol}-${idx}`}
                        onClick={() => setActiveRowIndex(idx)}
                        className={`transition-colors group cursor-pointer ${
                          idx === activeRowIndex ? 'bg-blue-950/70 ring-1 ring-blue-500/80 shadow-md' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center text-slate-600 text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-200">
                          <a 
                            href={tvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 group-hover:underline underline-offset-4"
                            title={`Open ${setup.symbol} on TradingView`}
                          >
                            <span>{setup.symbol}</span>
                            <ArrowUpRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-blue-400 transition-colors" />
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-xs font-sans">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-200">{setup.sector}</span>
                              {setup.cluster.startsWith('🔥') && (
                                <span className="px-1.5 py-0.2 bg-amber-950/80 text-amber-300 border border-amber-800/60 rounded text-[10px] font-bold shadow-sm shadow-amber-950">
                                  {setup.cluster}
                                </span>
                              )}
                            </div>
                            {setup.theme && setup.theme !== 'Diversified' && setup.theme !== setup.sector && (
                              <span className="text-[11px] text-indigo-300 font-medium tracking-tight">
                                • {setup.theme}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              onClick={() => setSelectedRadarSetup(setup)}
                              className={`px-2 py-0.5 rounded font-bold text-xs inline-flex items-center gap-1 hover:brightness-125 transition-all cursor-pointer shadow-sm select-none ${stats.badge}`}
                              title="Click to inspect 5-Factor Breakout DNA Radar Chart"
                            >
                              <Sparkles className="w-3 h-3 opacity-80" />
                              <span>{setup.score}/100</span>
                              <span>•</span>
                              <span>{stats.label} ({stats.winRate} Win)</span>
                            </button>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-300 tabular-nums">
                          {setup.close ? `₹${setup.close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className={`px-2 py-0.5 rounded font-semibold text-xs inline-block ${
                            (setup.pct1d ?? 0) > 0 
                              ? 'bg-green-950/80 text-green-400 border border-green-800/60' 
                              : (setup.pct1d ?? 0) < 0
                              ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                              : 'text-slate-400'
                          }`}>
                            {formatPct(setup.pct1d)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className={`px-2 py-0.5 rounded font-semibold text-xs inline-block ${
                            (setup.pct5d ?? 0) > 0 
                              ? 'bg-green-950/80 text-green-300 border border-green-800/60' 
                              : (setup.pct5d ?? 0) < 0
                              ? 'bg-red-950/80 text-red-300 border border-red-800/60'
                              : 'text-slate-400'
                          }`}>
                            {formatPct(setup.pct5d)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center tabular-nums text-xs">
                          <span className="text-cyan-300 font-semibold">{setup.rvol}x</span>
                          <span className="text-slate-600 mx-1">/</span>
                          <span className={setup.clv >= 0.85 ? 'text-emerald-400 font-semibold' : 'text-slate-400'}>{setup.clv}</span>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium">
                          <span className={setup.turnover_cr >= 10 ? 'text-slate-100 font-semibold' : setup.turnover_cr >= 1 ? 'text-slate-300' : 'text-slate-500'}>
                            {formatTurnoverCr(setup.turnover_cr)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => setSelectedChartStock({
                                symbol: setup.symbol,
                                parentSector: setup.sector,
                                theme: setup.theme,
                                pctChange: setup.pct1d
                              })}
                              className="px-2 py-0.5 bg-cyan-950/80 hover:bg-cyan-600 border border-cyan-800 text-[10px] text-cyan-300 hover:text-white rounded transition-all font-sans cursor-pointer shadow-sm"
                              title="Open interactive TradingView candlestick chart"
                            >
                              Chart
                            </button>
                            <a
                              href={tvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-blue-600 hover:text-white text-[10px] text-slate-400 rounded transition-colors"
                              title="Open in TradingView Web"
                            >
                              TV
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          ) : (
            /* ALL CONSTITUENT STOCKS TABLE */
            displayStocks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-2">
                <p className="text-sm font-medium text-slate-400">No matching stocks found.</p>
                {searchQuery || minTurnoverCr > 0 ? (
                  <p className="text-xs text-slate-600">
                    Try clearing search or lowering turnover threshold (Current: ≥ ₹{minTurnoverCr} Cr)
                  </p>
                ) : null}
              </div>
            ) : (
              <table className="w-full text-xs md:text-sm text-left border-collapse">
                <thead className="bg-slate-900 text-slate-400 sticky top-0 z-20 text-[11px] uppercase tracking-wider select-none border-b border-slate-800">
                  <tr>
                    <th className="px-3 py-3 w-12 text-center text-slate-600 font-mono">#</th>
                    <th 
                      className="px-4 py-3 font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('s')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Symbol</span>
                        {sortField === 's' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('c')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Price (₹)</span>
                        {sortField === 'c' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('p1')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>1-Day %</span>
                        {sortField === 'p1' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    {is5DMetric && (
                      <th 
                        className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                        onClick={() => handleSort('p5')}
                      >
                        <div className="flex items-center justify-end gap-1">
                          <span>5-Day %</span>
                          {sortField === 'p5' ? (
                            <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                          ) : (
                            <ArrowUpDown className="w-3 h-3 text-slate-500" />
                          )}
                        </div>
                      </th>
                    )}
                    <th 
                      className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('to')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Turnover (Cr)</span>
                        {sortField === 'to' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th 
                      className="px-4 py-3 text-right font-semibold text-slate-300 cursor-pointer hover:text-white transition-colors"
                      onClick={() => handleSort('v')}
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Volume (Shares)</span>
                        {sortField === 'v' ? (
                          <span className="text-cyan-400 font-bold">{sortOrder === 'asc' ? '▲' : '▼'}</span>
                        ) : (
                          <ArrowUpDown className="w-3 h-3 text-slate-500" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-3 text-center w-24 font-semibold text-slate-400">Charts</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {displayStocks.map((stock, idx) => {
                    const [sym, close, pct1, pct5, vol] = stock;
                    const is1DPos = pct1 > 0;
                    const is5DPos = pct5 > 0;
                    const tvUrl = getTradingViewUrl(sym);
                    const ciUrl = getChartinkUrl(sym);
                    const toCr = getStockTurnoverCr(stock);

                    return (
                      <tr
                        key={`${sym}-${idx}`}
                        onClick={() => setActiveRowIndex(idx)}
                        className={`transition-colors group cursor-pointer ${
                          idx === activeRowIndex ? 'bg-blue-950/70 ring-1 ring-blue-500/80 shadow-md' : 'hover:bg-slate-800/40'
                        }`}
                      >
                        <td className="px-3 py-2.5 text-center text-slate-600 text-xs">
                          {idx + 1}
                        </td>
                        <td className="px-4 py-2.5 font-bold text-slate-200">
                          <a 
                            href={tvUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-blue-400 transition-colors inline-flex items-center gap-1.5 group-hover:underline underline-offset-4"
                            title={`Open ${sym} chart on TradingView`}
                          >
                            <span>{sym}</span>
                            <ArrowUpRight className="w-3 h-3 text-slate-500 group-hover:text-blue-400 transition-colors" />
                          </a>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-slate-300 tabular-nums">
                          {close !== null && close !== undefined && !isNaN(close) ? `₹${close.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '-'}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular-nums">
                          <span className={`px-2 py-0.5 rounded font-semibold text-xs inline-block ${
                            (pct1 ?? 0) > 0 
                              ? 'bg-green-950/80 text-green-400 border border-green-800/60' 
                              : (pct1 ?? 0) < 0
                              ? 'bg-red-950/80 text-red-400 border border-red-800/60'
                              : 'text-slate-400'
                          }`}>
                            {formatPct(pct1)}
                          </span>
                        </td>
                        {is5DMetric && (
                          <td className="px-4 py-2.5 text-right tabular-nums">
                            <span className={`px-2 py-0.5 rounded font-semibold text-xs inline-block ${
                              (pct5 ?? 0) > 0 
                                ? 'bg-green-950/80 text-green-300 border border-green-800/60' 
                                : (pct5 ?? 0) < 0
                                ? 'bg-red-950/80 text-red-300 border border-red-800/60'
                                : 'text-slate-400'
                            }`}>
                              {formatPct(pct5)}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium">
                          <span className={toCr >= 10 ? 'text-slate-100 font-semibold' : toCr >= 1 ? 'text-slate-300' : 'text-slate-500'}>
                            {formatTurnoverCr(toCr)}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right text-slate-400 tabular-nums text-xs">
                          {formatVolume(vol)}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <a
                              href={tvUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-blue-600 hover:text-white text-[10px] text-slate-400 rounded transition-colors"
                              title="TradingView Chart"
                            >
                              TV
                            </a>
                            <a
                              href={ciUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-1.5 py-0.5 bg-slate-800 hover:bg-indigo-600 hover:text-white text-[10px] text-slate-400 rounded transition-colors"
                              title="Chartink Chart"
                            >
                              CI
                            </a>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )
          )}
        </div>

        {/* Footer Summary */}
        <div className="p-3 px-6 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between text-xs text-slate-500">
          <span>Tip: Press <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono text-[10px]">←</kbd> / <kbd className="px-1.5 py-0.5 bg-slate-800 text-slate-400 rounded font-mono text-[10px]">→</kbd> to navigate days</span>
          <span>Showing {displayStocks.length} of {rawList.length} stocks</span>
        </div>
      </div>
      <div className="absolute inset-0 -z-10" onClick={onClose} />

      {/* Breakout DNA Radar Modal */}
      <BreakoutRadarModal
        isOpen={Boolean(selectedRadarSetup)}
        onClose={() => setSelectedRadarSetup(null)}
        setup={selectedRadarSetup}
      />

      {/* Interactive Stock Candlestick Chart Modal */}
      <StockChartModal
        isOpen={Boolean(selectedChartStock)}
        onClose={() => setSelectedChartStock(null)}
        symbol={selectedChartStock?.symbol || ""}
        parentSector={selectedChartStock?.parentSector}
        theme={selectedChartStock?.theme}
        pctChange={selectedChartStock?.pctChange}
      />
    </div>
  );
}
