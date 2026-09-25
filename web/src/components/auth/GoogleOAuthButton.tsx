"use client";

import React, { useState } from "react";
import { signIn } from "@/lib/auth/auth-client";
import { Loader2 } from "lucide-react";

interface GoogleOAuthButtonProps {
  callbackUrl?: string;
  onError?: (err: string) => void;
}

export function GoogleOAuthButton({ callbackUrl = "/", onError }: GoogleOAuthButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const res = await signIn.social({
        provider: "google",
        callbackURL: callbackUrl,
      });

      if (res?.error) {
        setIsLoading(false);
        const errText = res.error.message?.toLowerCase() || "";
        const msg =
          errText.includes("provider") || errText.includes("not found") || errText.includes("disabled")
            ? "Google Sign-In is not configured on this server yet. Please use institutional email credentials."
            : res.error.status === 429 || errText.includes("too many requests")
            ? "Too many sign-in attempts. Please wait a moment and try again."
            : res.error.message ||
              "Google authentication failed. Please verify Google OAuth credentials.";
        if (onError) onError(msg);
      }
    } catch (err: unknown) {
      setIsLoading(false);
      const errText = err instanceof Error ? err.message.toLowerCase() : "";
      const msg =
        errText.includes("too many requests")
          ? "Too many sign-in attempts. Please wait a moment and try again."
          : err instanceof Error
          ? err.message
          : "Google authentication failed. Check configuration.";
      if (onError) onError(msg);
    }
  };

  return (
    <button
      type="button"
      onClick={handleGoogleSignIn}
      disabled={isLoading}
      className="w-full flex items-center justify-center gap-3 py-2.5 px-4 bg-slate-950 hover:bg-slate-800 border border-slate-700/80 hover:border-slate-600 rounded-xl text-xs font-semibold text-slate-200 transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
      ) : (
        <svg className="w-4 h-4" viewBox="0 0 24 24">
          <path
            fill="#EA4335"
            d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.9C6.2 7.4 8.8 5 12 5z"
          />
          <path
            fill="#4285F4"
            d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.6h6.5c-.3 1.5-1.1 2.8-2.4 3.7l3.7 2.9c2.2-2 3.7-5 3.7-8.9z"
          />
          <path
            fill="#FBBC05"
            d="M5.3 14.7c-.2-.7-.4-1.6-.4-2.7 0-1.1.2-1.9.4-2.7L1.6 6.4C.6 8.3 0 10.1 0 12s.6 3.7 1.6 5.6l3.7-2.9z"
          />
          <path
            fill="#34A853"
            d="M12 23c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.2 0-5.8-2.4-6.7-5.3L1.6 15.9C3.5 19.7 7.4 23 12 23z"
          />
        </svg>
      )}
      <span>Continue with Google</span>
    </button>
  );
}
