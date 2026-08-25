"use client";

import React, { useEffect } from "react";
import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("QuantBreadth Application Error:", error);
  }, [error]);

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-[#070b14] text-slate-100 font-sans">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 md:p-8 shadow-2xl space-y-5 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto text-rose-400">
          <AlertTriangle className="w-6 h-6" />
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-100">Terminal Error Detected</h2>
          <p className="text-xs text-slate-400 leading-relaxed">
            An unexpected error occurred while rendering the breadth workspace. Your data and settings remain safe.
          </p>
        </div>

        {error.message && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-rose-300 break-words text-left">
            {error.message}
          </div>
        )}

        <div className="flex items-center justify-center gap-3 pt-2">
          <button
            onClick={() => reset()}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/30 flex items-center gap-2 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload Terminal</span>
          </button>

          <Link
            href="/"
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <Home className="w-3.5 h-3.5" />
            <span>Home</span>
          </Link>
        </div>
      </div>
    </main>
  );
}
