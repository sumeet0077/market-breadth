"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { GoogleOAuthButton } from "@/components/auth/GoogleOAuthButton";
import { signIn, useSession } from "@/lib/auth/auth-client";
import { Mail, Lock, Loader2, AlertCircle, ArrowRight, Sparkles } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";
  const verified = searchParams.get("verified");
  const urlError = searchParams.get("error");
  const [email, setEmail] = useState(
    (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
      searchParams.get("demo") === "true" ||
      (typeof window !== "undefined" && window.location.hostname.startsWith("demo.")))
      ? "demo@quantbreadth.com"
      : ""
  );
  const [password, setPassword] = useState(
    (process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
      searchParams.get("demo") === "true" ||
      (typeof window !== "undefined" && window.location.hostname.startsWith("demo.")))
      ? "Demo1234!"
      : ""
  );
  const [isLoading, setIsLoading] = useState(false);

  const isDemoMode =
    process.env.NEXT_PUBLIC_DEMO_MODE === "true" ||
    searchParams.get("demo") === "true" ||
    (typeof window !== "undefined" && window.location.hostname.startsWith("demo."));

  const initialErrorMessage = urlError
    ? urlError === "session_expired"
      ? "Your terminal session has expired. Please sign in again."
      : (urlError === "OAuthCallbackError" || urlError.toLowerCase().includes("oauth"))
      ? "Google authentication was unsuccessful or canceled. Please try again."
      : urlError
    : null;

  const [errorMessage, setErrorMessage] = useState<string | null>(initialErrorMessage);

  // Safe client-side session checking: if already verified as authenticated, redirect
  const { data: session, isPending: sessionPending } = useSession();

  useEffect(() => {
    if (session?.user && !sessionPending) {
      router.push(callbackUrl);
    }
  }, [session, sessionPending, callbackUrl, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setIsLoading(true);

    try {
      const res = await signIn.email({
        email,
        password,
        callbackURL: callbackUrl,
      });

      if (res.error) {
        const isRateLimit =
          res.error.status === 429 ||
          res.error.message?.toLowerCase().includes("too many requests") ||
          res.error.message?.toLowerCase().includes("try again later");
        if (isRateLimit) {
          setErrorMessage("Too many login attempts. Please wait a moment and try again.");
        } else if (res.error.status === 401 || res.error.message?.toLowerCase().includes("credential")) {
          setErrorMessage("Invalid institutional credentials. Please verify your email and password.");
        } else if (res.error.message?.toLowerCase().includes("verify")) {
          setErrorMessage("Email not verified. Please check your inbox for the activation link.");
        } else {
          setErrorMessage(res.error.message || "Authentication failed. Please try again.");
        }
        setIsLoading(false);
        return;
      }

      // Success
      router.push(callbackUrl);
      router.refresh();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "An unexpected error occurred during sign in.";
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  const handleDemoFill = () => {
    setEmail("demo@quantbreadth.com");
    setPassword("Demo1234!");
    setErrorMessage(null);
  };

  return (
    <AuthCard
      title="Sign in to QuantBreadth™"
      subtitle="Access real-time breadth analytics, sector regime matrices, and stock scanners"
      footer={
        <div className="space-y-2">
          <div>
            Don&apos;t have an account?{" "}
            <Link
              href={`/signup?callbackUrl=${encodeURIComponent(callbackUrl)}`}
              className="text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              Request Access
            </Link>
          </div>
          <div>
            <Link
              href="/forgot-password"
              className="text-slate-500 hover:text-slate-400 text-xs"
            >
              Forgot your password?
            </Link>
          </div>
        </div>
      }
    >
      {/* Demo Mode Quick Access Banner */}
      {isDemoMode && (
        <div className="p-3 bg-indigo-950/40 border border-indigo-800/60 rounded-xl flex items-center justify-between text-xs text-indigo-300">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400 flex-shrink-0" />
            <span>Demo Mode Active</span>
          </div>
          <button
            type="button"
            onClick={handleDemoFill}
            className="text-[11px] px-2 py-1 bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-700 rounded-md font-bold text-cyan-200 transition-colors"
          >
            Auto-fill
          </button>
        </div>
      )}

      {/* Email verification success notification */}
      {verified && (
        <div className="p-3 bg-emerald-950/40 border border-emerald-800/60 rounded-xl text-xs text-emerald-300 flex items-center gap-2">
          <span>Your email has been verified successfully. Please sign in below.</span>
        </div>
      )}

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

      {/* Email / Password Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-slate-300 mb-1.5">
            Work Email
          </label>
          <div className="relative">
            <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="trader@fund.com"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
            />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-xs font-semibold text-slate-300">
              Password
            </label>
            <Link
              href="/forgot-password"
              className="text-[11px] text-cyan-400 hover:text-cyan-300"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
            />
          </div>
        </div>

        {/* Quick Demo Access Helper */}
        <div className="flex items-center justify-between text-[11px] px-0.5">
          <button
            type="button"
            onClick={handleDemoFill}
            className="text-slate-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Fill Demo Credentials</span>
          </button>
          <span className="font-mono text-[10px] text-slate-500">Demo1234!</span>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full mt-2 py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <>
              <span>Sign In to Terminal</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </>
          )}
        </button>
      </form>
    </AuthCard>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
