"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { signUp } from "@/lib/auth/auth-client";
import { Mail, Lock, User, Loader2, AlertCircle, ArrowRight, CheckCircle2 } from "lucide-react";

function SignupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (password.length < 8) {
      setErrorMessage("Password must be at least 8 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await signUp.email({
        email,
        password,
        name,
        callbackURL: callbackUrl,
      });

      if (res.error) {
        setErrorMessage(res.error.message || "Failed to create account. Please try again.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsLoading(false);
      // Wait a moment then redirect or let user view confirmation
      setTimeout(() => {
        router.push(callbackUrl);
        router.refresh();
      }, 1200);
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred during signup.";
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create Terminal Account"
      subtitle="Request access to QuantBreadth™ institutional analytics and market data"
      footer={
        <div>
          Already have an account?{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-cyan-400 hover:text-cyan-300 font-semibold"
          >
            Sign In
          </Link>
        </div>
      }
    >
      {isSuccess ? (
        <div className="text-center py-6 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto animate-bounce" />
          <h3 className="text-base font-bold text-slate-100">
            Account Created Successfully!
          </h3>
          <p className="text-xs text-slate-400">
            Redirecting to terminal workspace...
          </p>
        </div>
      ) : (
        <>
          {/* Error Alert */}
          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/70 rounded-xl flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Google OAuth */}
          <GoogleOAuthButton
            callbackUrl={callbackUrl}
            onError={(err) => setErrorMessage(err)}
          />

          {/* Divider */}
          <div className="relative flex items-center justify-center">
            <div className="border-t border-slate-800 w-full" />
            <span className="bg-slate-900 px-3 text-[11px] font-mono text-slate-500 uppercase tracking-wider absolute">
              or credentials
            </span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Full Name
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alexander Hamilton"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Work Email
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

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimum 8 characters"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-3 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Create Account</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthCard>
  );
}

export default function SignupPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      }
    >
      <SignupForm />
    </Suspense>
  );
}
