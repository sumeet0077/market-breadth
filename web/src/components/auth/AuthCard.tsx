import React from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <div className="min-h-screen w-full flex flex-col items-center justify-center p-4 sm:p-6 bg-[#070b14] relative overflow-hidden selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* Background ambient lighting effects */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[550px] h-[350px] bg-gradient-to-tr from-indigo-600/15 via-cyan-500/10 to-transparent blur-[120px] pointer-events-none rounded-full" />
      <div className="absolute bottom-10 right-10 w-[300px] h-[300px] bg-blue-600/10 blur-[100px] pointer-events-none rounded-full" />

      {/* Center Auth Card */}
      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-cyan-500 to-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-cyan-500/25 font-mono group-hover:scale-105 transition-transform">
              QB
            </div>
            <div className="flex items-center gap-1.5 text-left">
              <span className="text-xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent">
                QuantBreadth<span className="text-cyan-400">™</span>
              </span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-indigo-950/90 text-indigo-300 border border-indigo-800/80 font-bold">
                PRO
              </span>
            </div>
          </Link>
          <h1 className="text-lg sm:text-xl font-bold text-slate-100 mt-2">
            {title}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto">
            {subtitle}
          </p>
        </div>

        {/* Form Container Panel */}
        <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-800/90 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          {children}
        </div>

        {/* Footer */}
        {footer && <div className="text-center text-xs text-slate-400">{footer}</div>}

        {/* Institutional Trust Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 font-mono">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
          <span>Encrypted Institutional Terminal Session</span>
        </div>
      </div>
    </div>
  );
}
