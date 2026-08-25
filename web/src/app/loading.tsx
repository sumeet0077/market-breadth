import React from "react";

export default function Loading() {
  return (
    <main className="min-h-screen p-3 md:p-6 space-y-6 max-w-[1880px] mx-auto animate-pulse">
      {/* Top Header Skeleton */}
      <div className="h-16 bg-slate-900/90 border border-slate-800 rounded-2xl w-full" />

      {/* KPI Cards Skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="h-44 bg-slate-900/80 border border-slate-800 rounded-2xl" />
        <div className="h-44 bg-slate-900/80 border border-slate-800 rounded-2xl" />
        <div className="h-44 bg-slate-900/80 border border-slate-800 rounded-2xl" />
      </div>

      {/* Main Heatmap Skeleton */}
      <div className="h-[600px] bg-slate-900/60 border border-slate-800 rounded-2xl w-full" />
    </main>
  );
}
