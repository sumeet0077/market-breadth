"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { MarketData, METRIC_CONFIG, DISPLAY_HEADERS } from "@/components/Heatmap";
import { Heatmap } from "./Heatmap";
import { DrilldownModal, DrilldownCategory, YearDrilldownMap, TopSetupItem } from "./DrilldownModal";
import { StrategyMatrixModal } from "./StrategyMatrixModal";
import { HistoricalMatcherModal } from "./HistoricalMatcherModal";
import { KeyboardShortcutsModal } from "./KeyboardShortcutsModal";
import { CommandPaletteModal } from "./CommandPaletteModal";
import { SectorLeadershipView } from "./SectorLeadershipView";
import { ChartsView } from "./ChartsView";
import { ShareCardModal } from "./ShareCardModal";
import { StockChartModal } from "./StockChartModal";
import {
  Calendar,
  Settings,
  Check,
  LineChart,
  Compass,
  History,
  Keyboard,
  Search,
  Share2,
  Layers,
  Sparkles,
  Zap,
  Shield,
  Download,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface PlaybookDirectives {
  scenarioTitle: string;
  exposure: string;
  exposureBadge: string;
  positionSize: string;
  setupFilter: string;
  tacticalStyle: string;
}

function getPlaybookDirectives(macroState: number | undefined, swingScore: number | undefined): PlaybookDirectives {
  const state = macroState ?? 2;
  const score = swingScore ?? 50;

  if (state === 3) {
    if (score >= 70) {
      return {
        scenarioTitle: "Scenario 1: Max Bull Expansion",
        exposure: "100% – 120%",
        exposureBadge: "Aggressive Offense (100–120%)",
        positionSize: "15% – 20% Base (Full Risk)",
        setupFilter: "Stage 2 Breakouts & Power Thrusts",
        tacticalStyle: "Add to High-Volume Leaders / Pyramid",
      };
    } else if (score >= 45) {
      return {
        scenarioTitle: "Scenario 2: Healthy Bull Trend",
        exposure: "80% – 100%",
        exposureBadge: "Offense (80–100%)",
        positionSize: "10% – 15% Base",
        setupFilter: "Leading Industry Highs & 20D Pullbacks",
        tacticalStyle: "Standard Pivot Breakouts / Trail Tight",
      };
    } else {
      return {
        scenarioTitle: "Scenario 3: Extended Bull Climax",
        exposure: "60% – 80%",
        exposureBadge: "Cautious Offense (60–80%)",
        positionSize: "8% – 10% Trimmed",
        setupFilter: "Overbought Divergence / Low Chase",
        tacticalStyle: "Lock Partial Profits / Avoid Late Breakouts",
      };
    }
  } else if (state === 2) {
    if (score >= 70) {
      return {
        scenarioTitle: "Scenario 4: Bull Pullback Thrust",
        exposure: "70% – 90%",
        exposureBadge: "Tactical Offensive (70–90%)",
        positionSize: "10% – 12% Base",
        setupFilter: "50-SMA Reversals & VCP Breakouts",
        tacticalStyle: "Aggressive Dip Buys into Leading Themes",
      };
    } else if (score >= 45) {
      return {
        scenarioTitle: "Scenario 5: Neutral Pullback",
        exposure: "40% – 60%",
        exposureBadge: "Selective (40–60%)",
        positionSize: "5% – 8% (Half Size)",
        setupFilter: "Hot Sector Theme Clusters",
        tacticalStyle: "Quick Swings in Leading Themes",
      };
    } else {
      return {
        scenarioTitle: "Scenario 6: Deepening Correction",
        exposure: "20% – 40%",
        exposureBadge: "Defensive (20–40%)",
        positionSize: "3% – 5% Pilot",
        setupFilter: "High Failure Rate / High Stop Risk",
        tacticalStyle: "Raise Cash / Require Strong Bases",
      };
    }
  } else if (state === 1) {
    if (score >= 70) {
      return {
        scenarioTitle: "Scenario 7: Bottoming Breadth Thrust",
        exposure: "50% – 70%",
        exposureBadge: "Opportunistic (50–70%)",
        positionSize: "7% – 10% Initial",
        setupFilter: "Early Stage-1 Bases & Washout Thrusts",
        tacticalStyle: "Fast Sector Rotations / Tight Stops",
      };
    } else if (score >= 45) {
      return {
        scenarioTitle: "Scenario 8: Choppy Range / Selective",
        exposure: "25% – 40%",
        exposureBadge: "Choppy Defense (25–40%)",
        positionSize: "4% – 6% Tactical",
        setupFilter: "Isolated RS Standouts",
        tacticalStyle: "Take Quick 3–5% Gains / Strict Stop Loss",
      };
    } else {
      return {
        scenarioTitle: "Scenario 9: Bear Transition Risk",
        exposure: "10% – 25%",
        exposureBadge: "Heavy Cash (10–25%)",
        positionSize: "2% – 4% Test Pilot Only",
        setupFilter: "Bull Traps & Exhaustion Gaps",
        tacticalStyle: "Preserve Capital / Extreme Discipline",
      };
    }
  } else {
    // state === 0 (Bear Defense / Cash)
    if (score >= 70) {
      return {
        scenarioTitle: "Scenario 10: Bear Market Relief Rally",
        exposure: "20% – 35%",
        exposureBadge: "Counter-Trend (20–35%)",
        positionSize: "3% – 5% Tactical",
        setupFilter: "Oversold Snapbacks / Short Squeezes",
        tacticalStyle: "Scalp Fast / Trail Immediately",
      };
    } else if (score >= 45) {
      return {
        scenarioTitle: "Scenario 11: Bearish Drift",
        exposure: "10% – 20%",
        exposureBadge: "Defensive Fortress (10–20%)",
        positionSize: "0% – 3% Pilot",
        setupFilter: "Defensive Relative Strength Only",
        tacticalStyle: "Do Not Add to Losers / Sit in Cash",
      };
    } else {
      return {
        scenarioTitle: "Scenario 12: Severe Panic / Capitulation",
        exposure: "0% – 10%",
        exposureBadge: "100% Cash / Max Defense (0–10%)",
        positionSize: "0% (No New Positions)",
        setupFilter: "68.2% Breakout Failure Rate",
        tacticalStyle: "100% Cash / Wait for Capitulation",
      };
    }
  }
}

interface DashboardClientProps {
  initialData: MarketData[];
  initialTab?: "heatmap" | "sectors" | "charts";
}

export function DashboardClient({ initialData, initialTab }: DashboardClientProps) {
  // Navigation Tabs: 'heatmap' | 'sectors' | 'charts'
  const [activeTab, setActiveTab] = useState<"heatmap" | "sectors" | "charts">(initialTab || "heatmap");

  // 1. State: Date Range
  const sortedByDate = useMemo(
    () => [...initialData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()),
    [initialData]
  );

  const maxDate = sortedByDate[0]?.Date || new Date().toISOString().split("T")[0];
  const minDate = sortedByDate[sortedByDate.length - 1]?.Date || "2014-06-02";
  const defaultStart = new Date(new Date(maxDate).getTime() - 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const [startDate, setStartDate] = useState(defaultStart);
  const [endDate, setEndDate] = useState(maxDate);
  const [activeTimeframe, setActiveTimeframe] = useState<"1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "ALL" | "CUSTOM">("1M");

  // Timeframe presets helper
  const handleSetTimeframe = useCallback(
    (preset: "1M" | "3M" | "6M" | "YTD" | "1Y" | "3Y" | "ALL") => {
      setEndDate(maxDate);
      if (preset === "ALL") {
        setStartDate(minDate);
        return;
      }
      const end = new Date(maxDate);
      if (preset === "1M") end.setMonth(end.getMonth() - 1);
      if (preset === "3M") end.setMonth(end.getMonth() - 3);
      if (preset === "6M") end.setMonth(end.getMonth() - 6);
      if (preset === "YTD") {
        const y = new Date(maxDate).getFullYear();
        setStartDate(`${y}-01-01`);
        return;
      }
      if (preset === "1Y") end.setFullYear(end.getFullYear() - 1);
      if (preset === "3Y") end.setFullYear(end.getFullYear() - 3);

      const strStart = end.toISOString().split("T")[0];
      setStartDate(strStart >= minDate ? strStart : minDate);
    },
    [maxDate, minDate]
  );

  // Year quick selector
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    initialData.forEach((d) => {
      if (d.Date) years.add(d.Date.split("-")[0]);
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [initialData]);

  const handleSelectYear = (year: string) => {
    setStartDate(`${year}-01-01`);
    setEndDate(`${year}-12-31`);
  };

  // Signal Filter State
  const [signalFilter, setSignalFilter] = useState<"all" | "thrust" | "panic">("all");

  // Column Visibility State with localStorage persistence
  const allMetrics = Object.keys(METRIC_CONFIG);
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>(allMetrics);
  const [showPercentages, setShowPercentages] = useState(false);
  const [isColumnMenuOpen, setIsColumnMenuOpen] = useState(false);

  // Hydration-safe localStorage persistence
  useEffect(() => {
    try {
      const savedPct = localStorage.getItem("qb_show_percentages");
      if (savedPct !== null) setShowPercentages(savedPct === "true");
      const savedCols = localStorage.getItem("qb_selected_columns");
      if (savedCols) {
        const parsed = JSON.parse(savedCols);
        if (Array.isArray(parsed) && parsed.length > 0) setSelectedMetrics(parsed);
      }
    } catch (e) {
      // Ignore private browsing storage errors
    }
  }, []);

  const handleTogglePercentages = () => {
    setShowPercentages((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("qb_show_percentages", String(next));
      } catch (e) {}
      return next;
    });
  };

  // Drilldown State & Year-level in-memory cache
  const [drilldownState, setDrilldownState] = useState<{
    isOpen: boolean;
    date: string;
    category: DrilldownCategory;
  }>({
    isOpen: false,
    date: "",
    category: "up45",
  });

  const router = useRouter();

  // Modals
  const [isMatrixOpen, setIsMatrixOpen] = useState(false);
  const [isMatcherOpen, setIsMatcherOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [isShareOpen, setIsShareOpen] = useState(false);

  // Standalone Stock Candlestick Chart Modal State
  const [activeStockChart, setActiveStockChart] = useState<{
    symbol: string;
    parentSector?: string;
    theme?: string;
    pctChange?: number;
  } | null>(null);

  const [yearCache, setYearCache] = useState<Record<string, YearDrilldownMap>>({});
  const [isDrilldownLoading, setIsDrilldownLoading] = useState(false);

  const openDrilldown = useCallback(
    async (date: string, category: DrilldownCategory) => {
      setDrilldownState({ isOpen: true, date, category });

      const year = date.split("-")[0];
      if (!yearCache[year]) {
        setIsDrilldownLoading(true);
        try {
          const res = await fetch(`/drilldowns/${year}.json?v=${Date.now()}`, { cache: "no-store" });
          if (!res.ok) throw new Error("Failed to load drilldown data");
          const json: YearDrilldownMap = await res.json();
          setYearCache((prev) => ({ ...prev, [year]: json }));
        } catch (err) {
          console.error(`Failed to load drilldown data for ${year}:`, err);
        } finally {
          setIsDrilldownLoading(false);
        }
      }
    },
    [yearCache]
  );

  const handleDrilldownNavigateDate = useCallback(
    (newDate: string) => {
      openDrilldown(newDate, drilldownState.category);
    },
    [openDrilldown, drilldownState.category]
  );

  const closeDrilldown = useCallback(() => {
    setDrilldownState((prev) => ({ ...prev, isOpen: false }));
  }, []);

  const allAvailableDates = useMemo(() => initialData.map((d) => d.Date), [initialData]);

  const currentYear = drilldownState.date ? drilldownState.date.split("-")[0] : "";
  const currentDayData = (currentYear && yearCache[currentYear]?.[drilldownState.date]) || null;

  // Reset Handler
  const handleReset = useCallback(() => {
    setStartDate(defaultStart);
    setEndDate(maxDate);
    setSelectedMetrics(allMetrics);
    setSignalFilter("all");
  }, [defaultStart, maxDate, allMetrics]);

  const toggleMetric = (metric: string) => {
    setSelectedMetrics((prev) => {
      const next = prev.includes(metric) ? prev.filter((m) => m !== metric) : [...prev, metric];
      try {
        localStorage.setItem("qb_selected_columns", JSON.stringify(next));
      } catch (e) {}
      return next;
    });
  };

  // 2. Filter Data by Date Range and Signal Filter
  const filteredData = useMemo(() => {
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    const effectiveStart = Math.min(s, e);
    const effectiveEnd = Math.max(s, e);

    return initialData.filter((d) => {
      const t = new Date(d.Date).getTime();
      if (t < effectiveStart || t > effectiveEnd) return false;

      if (signalFilter === "thrust") {
        return Boolean(
          d.Bullseye_Buy_Signal ||
            d.Bull_NNH_Buy ||
            d.Bull_200SMA_Buy ||
            d.Bull_AllSMA_Buy ||
            (d["Advance/Decline Ratio"] && d["Advance/Decline Ratio"] >= 2.5)
        );
      }
      if (signalFilter === "panic") {
        return Boolean(
          (d["Advance/Decline Ratio"] && d["Advance/Decline Ratio"] <= 0.20) ||
            (d["No. of stocks down 4.5%+ in the current day"] &&
              d.TotalTraded &&
              d["No. of stocks down 4.5%+ in the current day"] / d.TotalTraded >= 0.15)
        );
      }
      return true;
    });
  }, [initialData, startDate, endDate, signalFilter]);

  // 3. Derived KPI Logic
  const [inspectedDate, setInspectedDate] = useState<string | null>(null);

  const sortedFiltered = useMemo(
    () => [...filteredData].sort((a, b) => new Date(b.Date).getTime() - new Date(a.Date).getTime()),
    [filteredData]
  );

  const latestView = sortedFiltered[0] || initialData[0];
  const prevView = sortedFiltered[1] || latestView;

  // Active View for Macro Banner & KPIs
  const activeView = inspectedDate
    ? initialData.find((d) => d.Date === inspectedDate) || latestView
    : latestView;

  const activePrevView = useMemo(() => {
    if (!activeView) return activeView;
    const idx = sortedByDate.findIndex((d) => d.Date === activeView.Date);
    return idx >= 0 && idx + 1 < sortedByDate.length ? sortedByDate[idx + 1] : activeView;
  }, [activeView, sortedByDate]);

  // KPI Calculations
  const kpiAbove200Pct =
    activeView && activeView.TotalTraded
      ? (activeView["No of stocks above 200 day SMA"] / activeView.TotalTraded) * 100
      : 0;
  const kpiAbove200PctPrev =
    activePrevView && activePrevView.TotalTraded
      ? (activePrevView["No of stocks above 200 day SMA"] / activePrevView.TotalTraded) * 100
      : 0;

  // 20-Day (1-Month Institutional Cycle) Dynamic Sparkline Trend Arrays
  const sparklines = useMemo(() => {
    const curIdx = activeView ? sortedByDate.findIndex((d) => d.Date === activeView.Date) : 0;
    const effectiveIdx = curIdx >= 0 ? curIdx : 0;
    const recent20 = sortedByDate.slice(effectiveIdx, effectiveIdx + 20).reverse();
    return {
      sma200: recent20.map((d) => (d.TotalTraded ? (d["No of stocks above 200 day SMA"] / d.TotalTraded) * 100 : 0)),
      adRatio: recent20.map((d) => d["Advance/Decline Ratio"] || 1.0),
      nnh: recent20.map((d) => (d.TotalTraded ? (d["Net New Highs"] / d.TotalTraded) * 100 : 0)),
    };
  }, [sortedByDate, activeView]);

  // Global Power-Trader Keyboard Shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
        return;
      }

      if (drilldownState.isOpen) return;

      // ⌘K or Ctrl+K for Command Palette
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandOpen((prev) => !prev);
        return;
      }

      // If any modifier key (Cmd, Ctrl, Alt) is pressed, do NOT intercept single-key shortcuts
      // so native browser shortcuts (Cmd+R, Cmd+Shift+R, Cmd+C, Cmd+A, etc.) work normally!
      if (e.metaKey || e.ctrlKey || e.altKey) {
        return;
      }

      if (e.key === "?" || (e.shiftKey && e.key === "/")) {
        e.preventDefault();
        setIsShortcutsOpen((prev) => !prev);
      } else if (e.key === "Escape") {
        setIsCommandOpen(false);
        setIsShortcutsOpen(false);
        setIsMatrixOpen(false);
        setIsMatcherOpen(false);
        setIsShareOpen(false);
        setIsColumnMenuOpen(false);
        setInspectedDate(null);
        setActiveStockChart(null);
      } else if (e.key === "1") {
        setActiveTab("heatmap");
      } else if (e.key === "2") {
        setActiveTab("sectors");
      } else if (e.key === "3") {
        setActiveTab("charts");
      } else if (e.key.toLowerCase() === "p" || e.key.toLowerCase() === "t") {
        e.preventDefault();
        handleTogglePercentages();
      } else if (e.key.toLowerCase() === "c") {
        e.preventDefault();
        setIsColumnMenuOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === "r") {
        e.preventDefault();
        handleReset();
        setInspectedDate(null);
      } else if (e.key.toLowerCase() === "m") {
        e.preventDefault();
        setIsMatrixOpen((prev) => !prev);
      } else if (e.key.toLowerCase() === "h" || e.key.toLowerCase() === "a") {
        e.preventDefault();
        setIsMatcherOpen((prev) => !prev);
      } else if (e.key === "ArrowLeft" || e.key === "[") {
        e.preventDefault();
        const allDatesDesc = initialData.map((d) => d.Date);
        const curDate = inspectedDate || maxDate;
        const idx = allDatesDesc.indexOf(curDate);
        if (idx < allDatesDesc.length - 1) {
          setInspectedDate(allDatesDesc[idx + 1]);
        }
      } else if (e.key === "ArrowRight" || e.key === "]") {
        e.preventDefault();
        const allDatesDesc = initialData.map((d) => d.Date);
        const curDate = inspectedDate || maxDate;
        const idx = allDatesDesc.indexOf(curDate);
        if (idx > 0) {
          setInspectedDate(allDatesDesc[idx - 1]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [drilldownState.isOpen, router, inspectedDate, maxDate, initialData, handleReset]);

  // Pre-fetch active year drilldown for Sector Leadership view
  const activeYear = activeView?.Date ? activeView.Date.split("-")[0] : "";
  useEffect(() => {
    if (activeYear && !yearCache[activeYear]) {
      fetch(`/drilldowns/${activeYear}.json?v=${Date.now()}`)
        .then((r) => r.json())
        .then((json) => setYearCache((prev) => ({ ...prev, [activeYear]: json })))
        .catch((err) => console.error(err));
    }
  }, [activeYear, yearCache]);

  const activeTopSetups: TopSetupItem[] = useMemo(() => {
    if (!activeView || !yearCache[activeYear]?.[activeView.Date]) return [];
    return yearCache[activeYear][activeView.Date].top_setups || [];
  }, [activeView, yearCache, activeYear]);

  // Hot themes for active session
  const activeHotThemes = useMemo(() => {
    const counts: Record<string, number> = {};
    activeTopSetups.forEach((s) => {
      if (s.theme && s.theme !== "Diversified" && s.theme !== "General") {
        counts[s.theme] = (counts[s.theme] || 0) + 1;
      }
    });
    return Object.entries(counts)
      .filter(([_, c]) => c >= 2)
      .sort((a, b) => b[1] - a[1])
      .map(([th, c]) => `${th} (${c})`);
  }, [activeTopSetups]);

  // Directives for Active Session
  const directives = getPlaybookDirectives(activeView?.Regime_State, activeView?.Swing_Score);

  return (
    <div className="space-y-5">
      {/* 💎 Institutional Top Brand & View Navigation Bar */}
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-3.5 bg-slate-900 border border-slate-800 p-3 px-4.5 rounded-2xl shadow-xl">
        {/* Left: Brand Identity + Integrated View Switcher Tabs */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-black text-white text-xs shadow-md shadow-cyan-500/20 font-mono">
              QB
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                QuantBreadth<span className="text-cyan-400">™</span>
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-800/80 font-bold">
                PRO
              </span>
            </div>
          </div>

          <div className="h-6 w-px bg-slate-800 hidden sm:block" />

          {/* Primary View Switcher Tabs */}
          <nav className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800/90">
            <button
              onClick={() => setActiveTab("heatmap")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "heatmap"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Breadth Heatmap</span>
            </button>

            <button
              onClick={() => setActiveTab("sectors")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "sectors"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-300" />
              <span>Sectors &amp; Themes</span>
            </button>

            <button
              onClick={() => setActiveTab("charts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === "charts"
                  ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30"
                  : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
              }`}
            >
              <LineChart className="w-3.5 h-3.5 text-emerald-400" />
              <span>Charts Studio</span>
            </button>
          </nav>
        </div>

        {/* Right: Action Triggers (Search ⌘K, Share, Hotkeys ?) */}
        <div className="flex items-center gap-2">
          {/* Global ⌘K Command Palette Trigger */}
          <button
            onClick={() => setIsCommandOpen(true)}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 rounded-xl text-xs text-slate-300 transition-all flex items-center gap-1.5 shadow-inner cursor-pointer"
            title="Search Symbol, Date, or Signal (⌘K)"
          >
            <Search className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden md:inline font-medium">Search</span>
            <kbd className="px-1.5 py-0.2 bg-slate-900 border border-slate-700 rounded text-[10px] font-mono text-slate-400">
              ⌘K
            </kbd>
          </button>

          {/* Social Share Card Generator */}
          <button
            onClick={() => setIsShareOpen(true)}
            className="px-2.5 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-indigo-500/50 rounded-xl text-xs text-slate-300 transition-all flex items-center gap-1.5 cursor-pointer"
            title="Generate Branded Social Share Card"
          >
            <Share2 className="w-3.5 h-3.5 text-indigo-400" />
            <span className="hidden md:inline">Share</span>
          </button>
        </div>
      </header>

      {/* Main Interactive View based on activeTab */}
      {activeTab === "sectors" ? (
        <SectorLeadershipView
          activeDate={activeView?.Date || maxDate}
          activeData={activeView}
          topSetups={activeTopSetups}
          allDates={sortedByDate.map((d) => d.Date)}
          onDateChange={(date) => setInspectedDate(date)}
          onOpenStockChart={(sym, sec, th, pct) =>
            setActiveStockChart({ symbol: sym, parentSector: sec, theme: th, pctChange: pct })
          }
        />
      ) : activeTab === "charts" ? (
        <ChartsView initialData={initialData} hideHeader={true} />
      ) : (
        <>
          {/* Controls & Filter Toolbar (2-Tier Layout Matching Mockup) */}
          <div className="relative z-30 bg-slate-900 border border-slate-800/90 p-3.5 px-4.5 rounded-2xl shadow-xl space-y-2.5">
            {/* ROW 1: Timeframe Pills, Year Selector, Date Inputs, Reset */}
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Timeframe Presets */}
              <div className="flex items-center bg-slate-950 p-0.5 rounded-xl border border-slate-800 text-xs">
                {(["1M", "3M", "6M", "YTD", "1Y", "3Y", "ALL"] as const).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => {
                      setActiveTimeframe(preset);
                      handleSetTimeframe(preset);
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      activeTimeframe === preset
                        ? "bg-blue-600/25 border border-cyan-500/60 text-cyan-300 shadow-sm"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-900"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>

              {/* Year Dropdown */}
              <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">YEAR:</span>
                <select
                  onChange={(e) => {
                    setActiveTimeframe("CUSTOM");
                    handleSelectYear(e.target.value);
                  }}
                  defaultValue="2026"
                  className="bg-transparent text-slate-200 text-xs font-mono font-bold focus:outline-none cursor-pointer"
                >
                  {availableYears.map((y) => (
                    <option key={y} value={y} className="bg-slate-900 text-slate-200">
                      {y}
                    </option>
                  ))}
                </select>
              </div>

              {/* Custom Date Pickers */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs font-mono">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <input
                  type="date"
                  value={startDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => {
                    setActiveTimeframe("CUSTOM");
                    setStartDate(e.target.value);
                  }}
                  onClick={(e) => e.currentTarget.showPicker()}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-24"
                />
                <span className="text-slate-600 text-xs">→</span>
                <input
                  type="date"
                  value={endDate}
                  min={minDate}
                  max={maxDate}
                  onChange={(e) => {
                    setActiveTimeframe("CUSTOM");
                    setEndDate(e.target.value);
                  }}
                  onClick={(e) => e.currentTarget.showPicker()}
                  className="bg-transparent text-xs text-slate-200 focus:outline-none cursor-pointer w-24"
                />
              </div>

              {/* Reset Button */}
              <button
                onClick={() => {
                  setActiveTimeframe("1M");
                  handleReset();
                }}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 text-slate-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Reset Date Range (R)"
              >
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                <span>Reset</span>
              </button>
            </div>

            {/* ROW 2: Signals Filter, % View Toggle, Columns Selector, Sessions Count */}
            <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-800/60">
              {/* Signal Screener Filter */}
              <div className="flex items-center gap-2 bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs">
                <span className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">SIGNALS:</span>
                <select
                  value={signalFilter}
                  onChange={(e) => setSignalFilter(e.target.value as any)}
                  className="bg-transparent text-cyan-300 text-xs font-semibold focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-slate-900 text-slate-200">All Days</option>
                  <option value="thrust" className="bg-slate-900 text-amber-300">⚡ Bullseye &amp; Thrusts</option>
                  <option value="panic" className="bg-slate-900 text-rose-400">🚨 90% Panic Capitulation</option>
                </select>
              </div>

              {/* % View Toggle */}
              <button
                onClick={handleTogglePercentages}
                className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1 cursor-pointer ${
                  showPercentages
                    ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                    : "bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800"
                }`}
                title="Toggle % View (Hotkey: P or T)"
              >
                % View
              </button>

              {/* Columns Selector Trigger */}
              <button
                onClick={() => setIsColumnMenuOpen(true)}
                className="px-3 py-1.5 bg-slate-950 hover:bg-slate-850 border border-slate-800 hover:border-slate-700 text-slate-300 text-xs font-medium rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                title="Customize Heatmap Columns (Hotkey: C)"
              >
                <Settings className="w-3.5 h-3.5 text-slate-400" />
                <span>Columns ({selectedMetrics.length})</span>
              </button>

              <div className="text-xs text-slate-400 font-mono pl-1">
                <strong className="text-cyan-400 font-bold">{filteredData.length}</strong> sessions
              </div>
            </div>
          </div>

          {/* Active Historical Inspection Banner */}
          {inspectedDate && (
            <div className="flex items-center justify-between bg-blue-950 border border-blue-800/80 px-4 py-2.5 rounded-xl text-xs text-blue-200 shadow-lg animate-fadeIn">
              <div className="flex items-center gap-2.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
                <span>
                  Inspecting historical view as of <strong>{inspectedDate}</strong> (Click any date row to switch)
                </span>
              </div>
              <button
                onClick={() => setInspectedDate(null)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg text-xs transition-colors shadow-sm"
              >
                ↺ Reset to Latest Date
              </button>
            </div>
          )}

          {/* ⚡ Live Multi-Timeframe Market Engine Cockpit (3 Discrete Institutional Cards) */}
          {activeView && (() => {
            const pct200 = ((activeView["No of stocks above 200 day SMA"] / (activeView.TotalTraded || 1)) * 100);
            const pct50 = ((activeView["No of stocks above 50 day SMA"] / (activeView.TotalTraded || 1)) * 100);
            const swingScore = activeView.Swing_Score ?? 50;
            const macroState = activeView.Regime_State ?? (pct200 >= 50 ? 3 : pct200 >= 35 ? 2 : pct200 >= 20 ? 1 : 0);

            // 4-Tier Macro Posture Mapping
            const isFullBull = macroState === 3;
            const isBullPullback = macroState === 2;
            const isTacticalRepair = macroState === 1;
            const isBear = macroState === 0;

            const macroPostureLabel = isFullBull
              ? "↗ Bull Expansion"
              : isBullPullback
              ? "→ Bull Pullback"
              : isTacticalRepair
              ? "→ Tactical Repair"
              : "↘ Bear Contraction";

            const macroPosturePillStyle = isFullBull
              ? "bg-emerald-950/80 border border-emerald-800/80 text-emerald-400"
              : isBullPullback
              ? "bg-amber-950/80 border border-amber-800/80 text-amber-300"
              : isTacticalRepair
              ? "bg-orange-950/80 border border-orange-800/80 text-orange-400"
              : "bg-rose-950/80 border border-rose-800/80 text-rose-400";

            const macroDotStyle = isFullBull
              ? "bg-emerald-400 animate-pulse"
              : isBullPullback
              ? "bg-amber-400"
              : isTacticalRepair
              ? "bg-orange-400"
              : "bg-rose-400 animate-pulse";

            const macroTextStyle = isFullBull
              ? "text-emerald-400"
              : isBullPullback
              ? "text-amber-300"
              : isTacticalRepair
              ? "text-orange-400"
              : "text-rose-400";

            const cleanMacroRegime = (
              activeView.Macro_Regime ||
              (macroState === 3
                ? "Full Macro Bull Expansion"
                : macroState === 2
                ? "Bull Consolidation / Pullback"
                : macroState === 1
                ? "Tactical Relief / Repair"
                : "Structural Bear Contraction")
            ).replace(/^[🟢🟡🟠🔴⚡🚨🛡️\s]+/, "");

            const cleanSwingRegime = (
              activeView.Swing_Regime ||
              (swingScore >= 70
                ? "High Follow-Through"
                : swingScore >= 45
                ? "Selective Momentum"
                : "High Failure Risk")
            ).replace(/^[🟢🟡🟠🔴⚡🚨🛡️\s]+/, "");

            return (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {/* CARD 1: Macro Trend (1–6M) */}
                <div className="bg-slate-900 border border-slate-800/90 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                      Macro Trend (1–6M)
                    </h3>
                    <div
                      className={`flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold ${macroPosturePillStyle}`}
                    >
                      <span>{macroPostureLabel}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-950/80 border border-slate-800/80 px-3 py-2 rounded-xl text-xs font-bold">
                    <div className={`flex items-center gap-2 ${macroTextStyle}`}>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${macroDotStyle}`} />
                      <span>{cleanMacroRegime}</span>
                    </div>
                    {activeView.Prob_Macro_Confidence !== undefined && (
                      <span className="text-[10px] font-mono text-slate-400 font-normal">
                        {(activeView.Prob_Macro_Confidence * 100).toFixed(0)}% Conf
                      </span>
                    )}
                  </div>

                  {/* Structural & Tactical Breadth Micro-Bars */}
                  <div className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Structural (200 SMA)</span>
                        <span className="font-mono font-bold text-slate-200">{pct200.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct200 >= 50 ? "bg-emerald-500" : pct200 >= 30 ? "bg-amber-400" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, pct200))}%` }}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400 font-medium">Tactical (50 SMA)</span>
                        <span className="font-mono font-bold text-slate-200">{pct50.toFixed(1)}%</span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full rounded-full transition-all ${
                            pct50 >= 50 ? "bg-emerald-500" : pct50 >= 30 ? "bg-amber-400" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, pct50))}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* CARD 2: Swing Momentum (3–10D) */}
                <div className="bg-slate-900 border border-slate-800/90 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                      Swing Momentum (3–10D)
                    </h3>
                    <span className="text-[11px] font-mono text-slate-400">
                      Score:{" "}
                      <strong
                        className={`font-bold ${
                          swingScore >= 70
                            ? "text-emerald-400"
                            : swingScore >= 45
                            ? "text-cyan-400"
                            : "text-rose-400"
                        }`}
                      >
                        {swingScore.toFixed(1)}/100
                      </strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-slate-950/80 border border-slate-800/80 px-3 py-2 rounded-xl text-xs font-bold">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        swingScore >= 70
                          ? "bg-emerald-400"
                          : swingScore >= 45
                          ? "bg-amber-400"
                          : "bg-rose-400"
                      }`}
                    />
                    <span
                      className={
                        swingScore >= 70
                          ? "text-emerald-400"
                          : swingScore >= 45
                          ? "text-amber-300"
                          : "text-rose-400"
                      }
                    >
                      {cleanSwingRegime}
                    </span>
                  </div>

                  {/* Swing Momentum Gauge Micro-Bar */}
                  <div className="space-y-2 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-slate-400">Momentum Flow:</span>
                        <span
                          className={`font-mono font-bold ${
                            swingScore >= 70
                              ? "text-emerald-400"
                              : swingScore >= 45
                              ? "text-amber-400"
                              : "text-rose-400"
                          }`}
                        >
                          {swingScore >= 70
                            ? "High Follow-Through"
                            : swingScore >= 45
                            ? "Selective Thrust"
                            : "High Trap Risk"}
                        </span>
                      </div>
                      <div className="w-full bg-slate-950 h-1.5 rounded-full overflow-hidden border border-slate-800 relative">
                        <div
                          className={`h-full rounded-full transition-all ${
                            swingScore >= 70
                              ? "bg-emerald-500"
                              : swingScore >= 45
                              ? "bg-amber-500"
                              : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(100, Math.max(0, swingScore))}%` }}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                      <span>Empirical Win Rate:</span>
                      <span
                        className={`font-bold font-mono ${
                          swingScore >= 70
                            ? "text-emerald-400"
                            : swingScore >= 45
                            ? "text-emerald-400"
                            : "text-rose-400"
                        }`}
                      >
                        {swingScore >= 70
                          ? "81.4% on A+ Breakouts"
                          : swingScore >= 45
                          ? "71.6% on A+ Leaders"
                          : "31.8% (68% Failures)"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* CARD 3: Capital Allocation Directives */}
                <div className="bg-slate-900 border border-slate-800/90 p-5 rounded-2xl shadow-xl flex flex-col justify-between gap-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">
                      Capital Allocation
                    </h3>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setIsMatcherOpen(true)}
                        className="px-2 py-0.5 bg-amber-950/70 hover:bg-amber-900/80 text-amber-300 hover:text-white rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1 border border-amber-700/60 cursor-pointer"
                        title="Find Closest Historical Breadth Analogues"
                      >
                        <History className="w-3 h-3 text-amber-400" />
                        <span>Analogues</span>
                      </button>

                      <button
                        onClick={() => setIsMatrixOpen(true)}
                        className="px-2 py-0.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-[10px] font-semibold transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
                        title="Open Full 12-Scenario Decision Matrix"
                      >
                        <Compass className="w-3 h-3 text-cyan-400" />
                        <span>Matrix</span>
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-medium">Max Exposure:</span>
                      <span
                        className={`font-mono font-bold text-[11px] ${
                          parseInt(directives.exposure) >= 80
                            ? "text-emerald-400"
                            : parseInt(directives.exposure) >= 40
                            ? "text-amber-400"
                            : "text-rose-400"
                        }`}
                      >
                        {directives.exposure}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Position Sizing:</span>
                      <strong className="text-emerald-400 font-mono text-[11px]">
                        {directives.positionSize}
                      </strong>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">Setup Focus:</span>
                      <span
                        className="text-cyan-300 text-[11px] font-semibold truncate max-w-[170px]"
                        title={directives.setupFilter}
                      >
                        {directives.setupFilter}
                      </span>
                    </div>
                  </div>

                  <div className="pt-1.5 border-t border-slate-800/80 text-[10px] text-slate-400 italic">
                    Style: <strong className="text-slate-300 not-italic font-medium">{directives.tacticalStyle}</strong>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* KPI Stats Grid with SVG Micro-Sparklines */}
          {activeView && (
            <section className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* 1. Stocks > 200 SMA % */}
              <KpiCard
                label="Stocks > 200 SMA"
                value={`${kpiAbove200Pct.toFixed(1)}%`}
                subValue={`(${activeView["No of stocks above 200 day SMA"]} / ${activeView["TotalTraded"] || "?"})`}
                delta={(kpiAbove200Pct - kpiAbove200PctPrev).toFixed(1) + "%"}
                isGood={true}
                sparkline={sparklines.sma200}
              />

              {/* 2. Advance / Decline Ratio */}
              <KpiCard
                label="Advance/Decline Ratio"
                value={activeView["Advance/Decline Ratio"].toFixed(2)}
                delta={(activeView["Advance/Decline Ratio"] - activePrevView["Advance/Decline Ratio"]).toFixed(2)}
                isGood={true}
                sparkline={sparklines.adRatio}
              />

              {/* 3. Net New 52W Highs % */}
              <KpiCard
                label="Net New Highs (as %)"
                value={
                  activeView && activeView.TotalTraded
                    ? `${((activeView["Net New Highs"] / activeView.TotalTraded) * 100).toFixed(2)}%`
                    : "0%"
                }
                subValue="Click to view 52W Highs / Lows ›"
                delta={
                  (
                    (activeView && activeView.TotalTraded ? (activeView["Net New Highs"] / activeView.TotalTraded) * 100 : 0) -
                    (activePrevView && activePrevView.TotalTraded ? (activePrevView["Net New Highs"] / activePrevView.TotalTraded) * 100 : 0)
                  ).toFixed(2) + "%"
                }
                isGood={true}
                sparkline={sparklines.nnh}
                onClick={() => openDrilldown(activeView.Date, "net_new_highs")}
              />
            </section>
          )}

          {/* Main Heatmap */}
          <section className="space-y-4">
            <Heatmap
              initialData={filteredData}
              selectedMetrics={selectedMetrics}
              showPercentages={showPercentages}
              onCellClick={openDrilldown}
              onDateClick={(d) => setInspectedDate((prev) => (prev === d ? null : d))}
              activeDate={inspectedDate}
            />
          </section>
        </>
      )}

      {/* Drilldown Modal with Dual-Layer Taxonomy & Chart Integration */}
      <DrilldownModal
        isOpen={drilldownState.isOpen}
        onClose={closeDrilldown}
        date={drilldownState.date}
        category={drilldownState.category}
        availableDates={allAvailableDates}
        onNavigateDate={handleDrilldownNavigateDate}
        data={currentDayData}
        isLoading={isDrilldownLoading}
      />

      {/* Strategy Decision Matrix Modal */}
      <StrategyMatrixModal
        isOpen={isMatrixOpen}
        onClose={() => setIsMatrixOpen(false)}
        currentMacroState={activeView?.Regime_State}
        currentSwingScore={activeView?.Swing_Score}
      />

      {/* Historical Signature Matcher Modal */}
      <HistoricalMatcherModal
        isOpen={isMatcherOpen}
        onClose={() => setIsMatcherOpen(false)}
        currentDate={activeView?.Date || maxDate}
        allData={initialData}
      />

      {/* Power-Trader Keyboard Shortcuts Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      {/* Global ⌘K Command Palette */}
      <CommandPaletteModal
        isOpen={isCommandOpen}
        onClose={() => setIsCommandOpen(false)}
        availableDates={allAvailableDates}
        onSelectDate={(d) => {
          setInspectedDate(d);
          setActiveTab("heatmap");
        }}
        onSelectSector={(sec) => {
          setActiveTab("sectors");
        }}
        onOpenCharts={() => setActiveTab("charts")}
        onOpenMatrix={() => setIsMatrixOpen(true)}
        onOpenMatcher={() => setIsMatcherOpen(true)}
        onOpenShareCard={() => setIsShareOpen(true)}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onTogglePercentages={handleTogglePercentages}
        onReset={handleReset}
      />

      {/* QuantBreadth Social Share Card Modal */}
      <ShareCardModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        activeDate={activeView?.Date || maxDate}
        activeData={activeView}
        macroRegime={activeView?.Macro_Regime || "🟡 Selective Regime"}
        swingScore={activeView?.Swing_Score ?? 50}
        swingRegime={activeView?.Swing_Regime || "Selective Momentum"}
        exposure={directives.exposure}
        tacticalStyle={directives.tacticalStyle}
        hotThemes={activeHotThemes}
      />

      {/* Standalone Stock Candlestick Chart Modal */}
      <StockChartModal
        isOpen={Boolean(activeStockChart)}
        onClose={() => setActiveStockChart(null)}
        symbol={activeStockChart?.symbol || ""}
        parentSector={activeStockChart?.parentSector}
        theme={activeStockChart?.theme}
        pctChange={activeStockChart?.pctChange}
      />

      {/* Column Customizer Modal (Decoupled from Toolbar Stacking Context) */}
      {isColumnMenuOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 overscroll-contain animate-in fade-in duration-150">
          <div className="bg-slate-900 border border-slate-700/90 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col relative z-10 transform-gpu">
            {/* Header */}
            <div className="flex items-center justify-between p-4 px-5 border-b border-slate-800 bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-950/80 border border-blue-800/80 text-blue-400">
                  <Settings className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-100">Customize Heatmap Columns</h3>
                  <p className="text-xs text-slate-400">
                    {selectedMetrics.length} of {allMetrics.length} columns active
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsColumnMenuOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Actions (No confusing presets) */}
            <div className="flex items-center justify-between px-5 py-2.5 bg-slate-950/30 border-b border-slate-800/60 text-xs">
              <span className="text-slate-400">Toggle individual metrics</span>
              <div className="flex items-center gap-2">
                {selectedMetrics.length === allMetrics.length ? (
                  <button
                    onClick={() => {
                      setSelectedMetrics([]);
                      try {
                        localStorage.setItem("qb_selected_columns", JSON.stringify([]));
                      } catch (e) {}
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-rose-950/60 hover:border-rose-700/60 hover:text-rose-300 text-slate-200 border border-slate-700/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Deselect All
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      setSelectedMetrics(allMetrics);
                      try {
                        localStorage.setItem("qb_selected_columns", JSON.stringify(allMetrics));
                      } catch (e) {}
                    }}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-blue-950/60 hover:border-blue-700/60 hover:text-blue-300 text-slate-200 border border-slate-700/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                  >
                    Select All ({allMetrics.length})
                  </button>
                )}
                <button
                  onClick={() => {
                    setSelectedMetrics(allMetrics);
                    try {
                      localStorage.setItem("qb_selected_columns", JSON.stringify(allMetrics));
                    } catch (e) {}
                  }}
                  className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
                >
                  Reset Default
                </button>
              </div>
            </div>

            {/* Checkbox Grid */}
            <div className="p-4 px-5 max-h-[60vh] overflow-y-auto space-y-1.5 overscroll-contain transform-gpu">
              {allMetrics.map((metric) => {
                const isSelected = selectedMetrics.includes(metric);
                const headerInfo = DISPLAY_HEADERS[metric];
                return (
                  <button
                    key={metric}
                    onClick={() => toggleMetric(metric)}
                    className={`w-full flex items-center justify-between p-2.5 rounded-xl border text-left text-xs transition-all cursor-pointer ${
                      isSelected
                        ? "bg-slate-800/80 border-blue-600/40 text-slate-100 shadow-sm"
                        : "bg-slate-950/40 border-slate-800/60 text-slate-400 hover:bg-slate-800/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? "bg-blue-600 border-blue-600" : "border-slate-600 bg-slate-900"
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                      <span className="font-medium text-[12px]">{metric}</span>
                    </div>
                    {headerInfo && (
                      <span className="text-[10px] font-mono text-slate-400 bg-slate-950 px-2 py-0.5 rounded border border-slate-800 shrink-0 ml-2">
                        {headerInfo.short} {headerInfo.sub ? `(${headerInfo.sub})` : ""}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Footer */}
            <div className="p-3 px-5 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
              <span className="text-[11px] text-slate-500 font-mono">Press Esc or click Done</span>
              <button
                onClick={() => setIsColumnMenuOpen(false)}
                className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl text-xs transition-all shadow-md shadow-blue-600/20 cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
          <div className="fixed inset-0" onClick={() => setIsColumnMenuOpen(false)} />
        </div>
      )}
    </div>
  );
}

// Sparkline & KPI Card Component
function KpiCard({
  label,
  value,
  subValue,
  delta,
  isGood,
  sparkline,
  onClick,
}: {
  label: string;
  value: string;
  subValue?: string;
  delta: string;
  isGood: boolean;
  sparkline?: number[];
  onClick?: () => void;
}) {
  const deltaNum = parseFloat(delta);
  let deltaColor = "text-slate-500";
  if (deltaNum > 0) deltaColor = isGood !== false ? "text-emerald-400" : "text-rose-400";
  else if (deltaNum < 0) deltaColor = isGood !== false ? "text-rose-400" : "text-emerald-400";

  const icon = deltaNum > 0 ? "↑" : deltaNum < 0 ? "↓" : "−";

  // Compute SVG Area Gradient Sparkline with glowing Endpoint Dot
  const sparklineDetails = useMemo(() => {
    if (!sparkline || sparkline.length < 2) return null;
    const min = Math.min(...sparkline);
    const max = Math.max(...sparkline);
    const range = max - min || 1;
    const width = 135;
    const height = 40;

    const coords = sparkline.map((val, idx) => {
      const x = (idx / (sparkline.length - 1)) * width;
      const y = height - ((val - min) / range) * (height - 10) - 5;
      return { x, y };
    });

    const polylinePoints = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");
    const areaPath = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)} ` +
      coords.slice(1).map((c) => `L ${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ") +
      ` L ${width},${height} L 0,${height} Z`;

    const lastPoint = coords[coords.length - 1];
    const isNetUp = sparkline[sparkline.length - 1] >= sparkline[0];

    return {
      polylinePoints,
      areaPath,
      lastPoint,
      isNetUp,
      width,
      height,
    };
  }, [sparkline]);

  const gradId = `spark-${label.replace(/[^a-zA-Z0-9]/g, "")}`;
  const strokeColor = sparklineDetails?.isNetUp ? "#10b981" : "#f43f5e";

  return (
    <div
      onClick={onClick}
      className={`bg-slate-900 border border-slate-800/90 rounded-2xl p-5 md:p-6 shadow-xl relative overflow-hidden ${
        onClick ? "cursor-pointer hover:border-slate-700 hover:bg-slate-850" : "hover:border-slate-700"
      }`}
    >
      {/* Top Header Row: Label on Left, 20D TREND Pill on Right */}
      <div className="flex items-center justify-between">
        <h3 className="text-slate-400 text-xs font-bold uppercase tracking-wider">{label}</h3>
        {sparklineDetails && (
          <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800/90 px-2 py-0.5 rounded-full text-[10px] font-mono text-slate-400">
            <span>20D TREND</span>
            <span className={`font-bold ${sparklineDetails.isNetUp ? "text-emerald-400" : "text-rose-400"}`}>
              {sparklineDetails.isNetUp ? "↗" : "↘"}
            </span>
          </div>
        )}
      </div>

      {/* Main Row: Value & Delta on Left, Sparkline Chart on Right */}
      <div className="mt-4 flex items-end justify-between gap-3">
        {/* Left Column: Number, Delta, Subtext */}
        <div className="space-y-1.5 min-w-0">
          <div className="flex items-baseline gap-2.5">
            <span className="text-3xl md:text-4xl font-extrabold font-mono text-slate-50 tabular-nums tracking-tight">
              {value}
            </span>
            <span className={`text-xs font-semibold ${deltaColor} flex items-center bg-slate-950 px-2 py-0.5 rounded-full border border-slate-800 tabular-nums font-mono shrink-0`}>
              {icon} {Math.abs(deltaNum) || deltaNum}
            </span>
          </div>

          {subValue && (
            <div className="text-xs text-slate-500 font-mono truncate">
              {subValue}
            </div>
          )}
        </div>

        {/* Right Column: Luminous Area Gradient Sparkline */}
        {sparklineDetails && (
          <div className="relative shrink-0 pb-1">
            <svg
              width={sparklineDetails.width}
              height={sparklineDetails.height}
              className="overflow-visible"
            >
              <defs>
                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={strokeColor} stopOpacity={0.45} />
                  <stop offset="100%" stopColor={strokeColor} stopOpacity={0.0} />
                </linearGradient>
              </defs>

              {/* Subtle Dotted Baseline */}
              <line
                x1="0"
                y1={sparklineDetails.height}
                x2={sparklineDetails.width}
                y2={sparklineDetails.height}
                stroke="#334155"
                strokeDasharray="2 2"
                strokeWidth="1"
                opacity="0.5"
              />

              {/* Area Gradient Fill */}
              <path d={sparklineDetails.areaPath} fill={`url(#${gradId})`} />

              {/* Glowing Line Stroke */}
              <polyline
                fill="none"
                stroke={strokeColor}
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={sparklineDetails.polylinePoints}
              />

              {/* Glowing Endpoint Dot */}
              <circle
                cx={sparklineDetails.lastPoint.x}
                cy={sparklineDetails.lastPoint.y}
                r="5.5"
                fill={strokeColor}
                fillOpacity="0.3"
              />
              <circle
                cx={sparklineDetails.lastPoint.x}
                cy={sparklineDetails.lastPoint.y}
                r="2.5"
                fill={strokeColor}
              />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
