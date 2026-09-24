"use client";

import React, { useState } from "react";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { forgetPassword } from "@/lib/auth/auth-client";
import { Mail, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Send } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await forgetPassword({
        email,
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (res.error) {
        setErrorMessage(res.error.message || "Failed to initiate password reset.");
        setIsLoading(false);
        return;
      }

      setIsSubmitted(true);
      setIsLoading(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Reset Password"
      subtitle="Enter your email to receive secure instructions to recover your terminal access"
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </Link>
      }
    >
      {isSubmitted ? (
        <div className="text-center py-4 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-cyan-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-100">
            Reset Link Dispatched
          </h3>
          <p className="text-xs text-slate-300 leading-relaxed">
            If an account exists for <strong className="text-white">{email}</strong>, we have sent password reset instructions via Resend.
          </p>
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 text-left space-y-1">
            <p>• The reset link is valid for 60 minutes.</p>
            <p>• Check your spam or quarantine folder if you do not see it shortly.</p>
          </div>
        </div>
      ) : (
        <>
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/70 rounded-xl flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Terminal Account Email
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="analyst@fund.com"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Send Reset Link</span>
                  <Send className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthCard>
  );
}
