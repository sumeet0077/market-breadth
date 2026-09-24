import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  baseURL:
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
});

export const signIn = authClient.signIn;
export const signUp = authClient.signUp;
export const signOut = authClient.signOut;
export const useSession = authClient.useSession;

export interface PasswordResetResponse {
  data?: unknown;
  error?: {
    status?: number;
    message?: string;
  } | null;
}

interface ExtendedAuthClient {
  forgetPassword: (options: {
    email: string;
    redirectTo?: string;
  }) => Promise<PasswordResetResponse>;
  resetPassword: (options: {
    newPassword: string;
    token: string;
  }) => Promise<PasswordResetResponse>;
}

export const forgetPassword = (authClient as unknown as ExtendedAuthClient).forgetPassword;

export const resetPassword = (authClient as unknown as ExtendedAuthClient).resetPassword;
