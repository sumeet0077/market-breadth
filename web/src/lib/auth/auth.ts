import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "../db";
import * as schema from "../db/schema";
import { sendEmailVerification, sendPasswordResetEmail } from "../email/resend";

const baseURL =
  process.env.BETTER_AUTH_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

// Social providers configuration (only enabled if credentials are provided)
const googleProvider =
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
    ? {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }
    : undefined;

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  baseURL,
  secret:
    process.env.BETTER_AUTH_SECRET ||
    "fallback_secret_must_be_overridden_in_production_min_32_chars",
  trustedOrigins: [
    baseURL,
    "http://localhost:3000",
    "https://quantbreadth.com",
    "https://*.quantbreadth.com",
    "https://*.vercel.app",
  ],
  rateLimit: {
    enabled:
      process.env.NODE_ENV === "production" &&
      process.env.BETTER_AUTH_DISABLE_RATE_LIMIT !== "true",
    window: 60,
    max: 120,
    customRules: {
      "/sign-in/*": {
        window: 60,
        max: 30,
      },
      "/sign-up/*": {
        window: 60,
        max: 20,
      },
      "/forget-password": {
        window: 60,
        max: 10,
      },
      "/change-password": {
        window: 60,
        max: 10,
      },
    },
  },
  advanced: {
    ipAddress: {
      ipAddressHeaders: ["x-real-ip", "cf-connecting-ip", "x-forwarded-for"],
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes signed cookie cache (zero DB queries on page reload)
    },
  },
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
    async sendResetPassword({ user, url }) {
      await sendPasswordResetEmail({
        email: user.email,
        url,
      });
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    async sendVerificationEmail({ user, url }) {
      await sendEmailVerification({
        email: user.email,
        name: user.name,
        url,
      });
    },
  },
  socialProviders: {
    ...(googleProvider ? { google: googleProvider } : {}),
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        defaultValue: "user",
      },
      plan: {
        type: "string",
        defaultValue: "FREE",
      },
    },
  },
});
