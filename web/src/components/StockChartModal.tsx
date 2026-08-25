"use client";

import React, { useEffect, useRef, useState } from "react";
import { X, ExternalLink, TrendingUp, Layers, Compass, BarChart2 } from "lucide-react";

interface StockChartModalProps {
  isOpen: boolean;
  onClose: () => void;
  symbol: string;
  parentSector?: string;
  theme?: string;
  pctChange?: number;
}

export function StockChartModal({
  isOpen,
  onClose,
  symbol,
  parentSector,
  theme,
  pctChange,
}: StockChartModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [exchange, setExchange] = useState<"NSE" | "BSE">("NSE");

  const cleanSymbol = symbol ? symbol.trim().toUpperCase() : "";

  useEffect(() => {
    if (!isOpen || !cleanSymbol) return;

    const tvSymbol = `${exchange}:${cleanSymbol}`;

    // Clear previous widget
    if (containerRef.current) {
      containerRef.current.innerHTML = "";
    }

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: tvSymbol,
      interval: "D",
      timezone: "Asia/Kolkata",
      theme: "dark",
      style: "1", // 1 = Candlesticks
      locale: "en",
      enable_publishing: false,
      hide_side_toolbar: false,
      allow_symbol_change: true,
      calendar: false,
      studies: [
        "MASimple@tv-basicstudies", // 20 SMA / 50 SMA / 200 SMA
      ],
      support_host: "https://www.tradingview.com",
    });

    if (containerRef.current) {
      containerRef.current.appendChild(script);
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, cleanSymbol, exchange, onClose]);

  if (!isOpen || !cleanSymbol) return null;

  const tvUrl = `https://www.tradingview.com/chart/?symbol=${exchange}%3A${cleanSymbol}`;
  const chartinkUrl = `https://chartink.com/stocks/${cleanSymbol.toLowerCase()}.html`;
  const screenerUrl = `https://www.screener.in/company/${cleanSymbol}/consolidated/`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-black/90 overscroll-contain animate-fadeIn">
      <div
        className="w-full max-w-5xl h-[88vh] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col transform-gpu"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-slate-950 border-b border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold font-mono text-slate-100 tracking-tight">
                {cleanSymbol}
              </span>
              
              {/* Exchange Switcher */}
              <div className="flex items-center bg-slate-900 border border-slate-800 rounded-lg p-0.5 text-xs font-mono">
                <button
                  onClick={() => setExchange("NSE")}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    exchange === "NSE" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  NSE
                </button>
                <button
                  onClick={() => setExchange("BSE")}
                  className={`px-2 py-0.5 rounded font-bold transition-all cursor-pointer ${
                    exchange === "BSE" ? "bg-indigo-600 text-white" : "text-slate-400 hover:text-slate-200"
                  }`}
                >
                  BSE
                </button>
              </div>
            </div>

            {(parentSector || theme) && (
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 font-medium">
                <span>•</span>
                <span className="text-slate-300">{parentSector}</span>
                {theme && (
                  <>
                    <span>/</span>
                    <span className="text-cyan-400 font-semibold">{theme}</span>
                  </>
                )}
              </div>
            )}

            {pctChange !== undefined && (
              <span
                className={`text-xs font-mono font-bold px-2 py-0.5 rounded-full ${
                  pctChange >= 0
                    ? "bg-emerald-950 text-emerald-400 border border-emerald-800"
                    : "bg-rose-950 text-rose-400 border border-rose-800"
                }`}
              >
                {pctChange >= 0 ? `+${pctChange.toFixed(1)}%` : `${pctChange.toFixed(1)}%`}
              </span>
            )}
          </div>

          {/* Quick External Chart Launchers */}
          <div className="flex items-center gap-2">
            <a
              href={tvUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/30 cursor-pointer"
              title="Open full chart directly on TradingView"
            >
              <span>TradingView</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            <a
              href={chartinkUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
              title="Open chart on Chartink"
            >
              <span>Chartink</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <a
              href={screenerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg text-xs font-medium transition-colors flex items-center gap-1 border border-slate-700 cursor-pointer"
              title="Open financials on Screener.in"
            >
              <span>Screener</span>
              <ExternalLink className="w-3 h-3" />
            </a>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* TradingView Advanced Chart Container */}
        <div className="flex-1 w-full h-full bg-[#070b14] relative">
          <div ref={containerRef} className="tradingview-widget-container w-full h-full" style={{ height: "100%" }}>
            <div className="tradingview-widget-container__widget w-full h-full" style={{ height: "100%" }} />
          </div>
        </div>
      </div>
      <div className="fixed inset-0 -z-10" onClick={onClose} />
    </div>
  );
}

