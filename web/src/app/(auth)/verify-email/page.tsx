"use client";

import React, { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard } from "@/components/auth/AuthCard";
import { MailCheck, ArrowLeft, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email");

  return (
    <AuthCard
      title="Verify Your Email"
      subtitle="Complete email verification to finalize your QuantBreadth™ terminal access"
      footer={
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 text-xs text-cyan-400 hover:text-cyan-300"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Proceed to Sign In</span>
        </Link>
      }
    >
      <div className="text-center py-4 space-y-3">
        <MailCheck className="w-12 h-12 text-cyan-400 mx-auto" />
        <h3 className="text-base font-bold text-slate-100">
          Verification Link Dispatched
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          We have dispatched an email confirmation link to{" "}
          {email ? <strong className="text-white">{email}</strong> : "your inbox"}.
        </p>
        <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl text-[11px] text-slate-400 text-left space-y-1 mt-4">
          <p>• Click the link in the message to activate your session.</p>
          <p>• If you don&apos;t see the message, verify your spam folder.</p>
        </div>
      </div>
    </AuthCard>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-cyan-400" />
        </div>
      }
    >
      <VerifyEmailContent />
    </Suspense>
  );
}
