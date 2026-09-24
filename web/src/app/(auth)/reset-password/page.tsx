"use client";

import React, { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { resetPassword } from "@/lib/auth/auth-client";
import { Lock, Loader2, AlertCircle, CheckCircle2, ArrowRight } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!token) {
      setErrorMessage("Reset token is missing or invalid. Please request a new link.");
      return;
    }

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
      const res = await resetPassword({
        newPassword: password,
        token,
      });

      if (res.error) {
        setErrorMessage(res.error.message || "Failed to reset password. The link may have expired.");
        setIsLoading(false);
        return;
      }

      setIsSuccess(true);
      setIsLoading(false);
      setTimeout(() => {
        router.push("/login");
      }, 2000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      setErrorMessage(msg);
      setIsLoading(false);
    }
  };

  return (
    <AuthCard
      title="Create New Password"
      subtitle="Set a secure password to restore access to your QuantBreadth™ account"
      footer={
        <Link
          href="/login"
          className="text-xs text-slate-400 hover:text-slate-200 transition-colors"
        >
          Return to Sign In
        </Link>
      }
    >
      {isSuccess ? (
        <div className="text-center py-4 space-y-3">
          <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
          <h3 className="text-base font-bold text-slate-100">
            Password Reset Successful!
          </h3>
          <p className="text-xs text-slate-400">
            Your credentials have been updated. Redirecting to login...
          </p>
        </div>
      ) : (
        <>
          {!token && (
            <div className="p-3 bg-amber-950/50 border border-amber-800/70 rounded-xl text-xs text-amber-300">
              No reset token detected in URL. Please use the link sent to your email.
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-950/50 border border-rose-800/70 rounded-xl flex items-start gap-2 text-xs text-rose-300">
              <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                New Password
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
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  required
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password"
                  className="w-full bg-slate-950 border border-slate-800 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-200 placeholder-slate-600 focus:outline-none transition-all"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading || !token}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <span>Save New Password</span>
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

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      }
    >
      <ResetPasswordForm />
    </Suspense>
  );
}
