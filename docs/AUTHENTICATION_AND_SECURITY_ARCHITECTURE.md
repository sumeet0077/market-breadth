# QuantBreadth™ Production Authentication & Security Architecture Guide

This document provides a comprehensive, production-grade guide to the authentication, authorization, database, and infrastructure security model powering the **QuantBreadth™ Institutional Market Breadth Terminal**.

---

## 1. System Architecture

```
                                 [ Users / Institutional Clients ]
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │      Cloudflare       │
                                    │ (DNS, SSL, WAF, DDoS) │
                                    └───────────┬───────────┘
                                                │
                                                ▼
                                    ┌───────────────────────┐
                                    │     Vercel Edge       │
                                    │  (Next.js 16 Host)    │
                                    └───────────┬───────────┘
                                                │
                          ┌─────────────────────┴─────────────────────┐
                          ▼                                           ▼
               ┌───────────────────────┐                 ┌─────────────────────────┐
               │    Next.js 16 Proxy   │                 │     Static Terminal     │
               │   (`src/proxy.ts`)    │                 │   Assets (JS/CSS/Fonts) │
               └──────────┬────────────┘                 └─────────────────────────┘
                          │
     ┌────────────────────┴────────────────────┐
     ▼                                         ▼
┌─────────────────────────┐       ┌─────────────────────────┐
│  Public Routes & APIs   │       │   Protected Terminal    │
│  - /login, /signup      │       │   - / (Heatmap Engine)  │
│  - /forgot-password     │       │   - /charts (Studio)    │
│  - /reset-password      │       │   - /dashboard          │
│  - /verify-email        │       │   - /api/market-data/*  │
│  - /api/auth/*          │       │   - /api/user/me        │
│  - /api/health          │       │   - /market_breadth.json│
└─────────────────────────┘       │   - /drilldowns/*.json  │
                                  └────────────┬────────────┘
                                               │
                                               ▼
                                  ┌─────────────────────────┐
                                  │   Better Auth Engine    │
                                  │    (`lib/auth/auth.ts`) │
                                  └──────┬───────────┬──────┘
                                         │           │
                    ┌────────────────────┘           └────────────────────┐
                    ▼                                                     ▼
        ┌───────────────────────┐                             ┌───────────────────────┐
        │  Supabase PostgreSQL  │                             │        Resend         │
        │  (Drizzle ORM Pooled) │                             │ (Transactional Email) │
        │  - Users & Sessions   │                             │  - Email Verification │
        │  - Watchlists/Alerts  │                             │  - Password Resets    │
        │  - Entitlements       │                             └───────────────────────┘
        └───────────────────────┘
```

### Market Data Separation
* **Market Data Processing**: The high-frequency / daily market-breadth data processing engine (DuckDB, Python calculation pipelines, pre-rendered JSON matrix cache) is **strictly decoupled** from the user authentication database.
* **Supabase PostgreSQL**: Used exclusively for application state: users, sessions, accounts, verifications, subscriptions, preferences, watchlists, saved scanners, and alerts.
* **No Database Contamination**: High-frequency tick data is never pushed to Supabase, guaranteeing low latency and free-tier compatibility.

---

## 2. Local Setup & Prerequisites

* **Node.js**: 20.x or later
* **Package Manager**: `npm`
* **Local Postgres** (or a remote Supabase Postgres instance)

### Installation
```bash
cd web
npm install
```

### Running Tests
To run the automated security, entitlement, and proxy tests:
```bash
npm test
```

### Running Development Server
```bash
npm run dev
```
Navigate to `http://localhost:3000`. Unauthenticated requests will automatically redirect to `/login`.

---

## 3. Environment Variables

Create `.env.local` inside the `web` directory. Use `.env.example` as your template:

| Variable | Description | Example / Default |
| :--- | :--- | :--- |
| `DATABASE_URL` | Supabase pooled connection string (PgBouncer/Supavisor port 6543) | `postgresql://postgres.[REF]:[PW]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `BETTER_AUTH_SECRET` | 32+ character random secret for signing tokens/cookies | `openssl rand -base64 32` |
| `BETTER_AUTH_URL` | Canonical origin URL of the server | `http://localhost:3000` (Local) / `https://quantbreadth.com` (Prod) |
| `NEXT_PUBLIC_BETTER_AUTH_URL` | Client-accessible origin URL | `http://localhost:3000` |
| `GOOGLE_CLIENT_ID` | Google Cloud OAuth 2.0 Client ID | `xxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google Cloud OAuth 2.0 Client Secret | `GOCSPX-xxx` |
| `RESEND_API_KEY` | Resend transactional email API key | `re_123456...` |
| `RESEND_FROM_EMAIL` | Sender email address | `QuantBreadth <security@quantbreadth.com>` |
| `NEXT_PUBLIC_DEMO_MODE` | Enables demo banner & auto-fill credentials | `false` (Prod) / `true` (Demo) |

---

## 4. Supabase PostgreSQL Configuration

### Connection Pooling for Vercel Serverless Functions
Supabase provides two database connection modes:
1. **Direct Connection (Port 5432)**: For running schema migrations (`npm run db:migrate` or `npm run db:push`).
2. **Transaction Pooler (Port 6543 with PgBouncer / Supavisor)**: **Mandatory for Vercel production deployment**.

In `src/lib/db/index.ts`, connection options are configured specifically for serverless Postgres:
```typescript
const isLocalhost =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("host.docker.internal");

const client = globalThis._pgClient || postgres(connectionString, {
  prepare: false, // Required for PgBouncer transaction mode
  max: 1,         // Ensures serverless lambdas don't exhaust pool limits
  idle_timeout: 20,
  connect_timeout: 10,
  ssl: isLocalhost ? false : "require", // Supabase requires SSL even in local development
});
```

---

## 5. Better Auth Implementation

Better Auth handles email/password signup, Google OAuth, session cookies, and password reset flows with Drizzle ORM.

### Key Files
* `src/lib/auth/auth.ts`: Server-side Better Auth initialization with Drizzle adapter and Resend transactional email hooks.
* `src/lib/auth/auth-client.ts`: Client-side React hooks (`signIn`, `signUp`, `signOut`, `useSession`, `forgetPassword`, `resetPassword`).
* `src/app/api/auth/[...all]/route.ts`: Wildcard Route Handler delegating requests to Better Auth.

### Cookie Security
* HTTP-only session cookies: `better-auth.session_token` (HTTP) or `__Secure-better-auth.session_token` (HTTPS in production).
* `SameSite=Lax` prevents CSRF attacks.

---

## 6. Google OAuth 2.0 Setup

1. Open the [Google Cloud Console](https://console.cloud.google.com/).
2. Navigate to **APIs & Services > Credentials** and create an **OAuth 2.0 Client ID** (Web application).
3. Set **Authorized JavaScript origins**:
   * `http://localhost:3000`
   * `https://quantbreadth.com`
   * `https://demo.quantbreadth.com`
4. Set **Authorized redirect URIs**:
   * `http://localhost:3000/api/auth/callback/google`
   * `https://quantbreadth.com/api/auth/callback/google`
   * `https://demo.quantbreadth.com/api/auth/callback/google`
5. Copy Client ID and Secret to `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

---

## 7. Resend Transactional Email Setup

1. Sign up at [Resend](https://resend.com) and verify your domain (`quantbreadth.com`).
2. Obtain an API key and assign to `RESEND_API_KEY`.
3. In development, if `RESEND_API_KEY` is omitted, the email service operates in **Mock Mode**:
   * Verification and password reset URLs are logged directly to the server terminal.
   * Authentication workflows complete without crashing.

---

## 8. Database Migrations & Seeding

### Commands
* Generate migrations from schema changes:
  ```bash
  npm run db:generate
  ```
* Push schema directly to database:
  ```bash
  npm run db:push
  ```
* Seed default administrator and demo accounts:
  ```bash
  npm run db:seed
  ```

### Default Seeded Accounts
| Role | Email | Default Password | Plan |
| :--- | :--- | :--- | :--- |
| **Admin** | `admin@quantbreadth.com` | `Admin1234!` | `INSTITUTIONAL` |
| **Demo** | `demo@quantbreadth.com` | `Demo1234!` | `PRO` |
| **User** | `user@quantbreadth.com` | `User1234!` | `FREE` |

*(Change passwords immediately after initial deployment using `SEED_ADMIN_PASSWORD`)*.

---

## 9. Next.js 16 Proxy Route Protection (`src/proxy.ts`)

Next.js 16 standardizes edge proxying via `src/proxy.ts`.

### Security Rules
1. **Public Routes Bypass**: `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/api/auth/*`, `/api/health`.
2. **Infinite Loop Prevention**: Stale or expired session cookies visiting `/login` or `/signup` pass through to the login form without infinite redirection. Valid authenticated sessions are verified client-side via `useSession()`.
3. **Protected Market Datasets**: Direct access to `/market_breadth.json` and `/drilldowns/*` is strictly blocked:
   - Unauthenticated callers receive `401 Unauthorized`.
   - Authenticated callers receive `403 Forbidden` to enforce routing requests through authenticated, metered API endpoints (`/api/market-data/*`) rather than raw static downloads.
4. **Protected Pages**: Unauthenticated requests to `/`, `/charts`, `/dashboard` redirect to `/login?callbackUrl=...`.
5. **Protected APIs**: Unauthenticated requests to `/api/market-data/*` and `/api/user/*` return `401 Unauthorized`.

---

## 10. Vercel Deployment

1. Import the repository into Vercel.
2. In Project Settings > General, set **Root Directory** to `web`.
3. Configure the environment variables listed in Section 3 for **Production** and **Preview**.
4. Deploy! Next.js 16 standalone webpack builds execute automatically.

---

## 11. Cloudflare Configuration

Cloudflare acts as the edge perimeter (DNS, DDoS, SSL termination, and rate limiting).
* **SSL/TLS**: Set to **Full (Strict)**.
* **Web Application Firewall (WAF)**:
  * Enable **Bot Fight Mode**.
  * Add a Rate Limiting Rule: Limit requests to `/api/auth/*` to 10 requests per minute per IP to prevent credential stuffing.
* **DNS**: Set CNAME records for `quantbreadth.com` and `demo.quantbreadth.com` pointing to `cname.vercel-dns.com` with Cloudflare proxy enabled (Orange Cloud).

---

## 12. Demo Environment Setup

To run a private demo on `demo.quantbreadth.com`:
1. Point `demo.quantbreadth.com` to Vercel via Cloudflare.
2. Set `NEXT_PUBLIC_DEMO_MODE="true"` in Vercel for the demo branch/domain.
3. The demo host triggers:
   * Header `x-is-demo: true` added by `src/proxy.ts`.
   * An interactive banner with an **Auto-fill** button populating `demo@quantbreadth.com` credentials.
   * Full terminal access with role `demo` and plan `PRO`.

---

## 13. Subscription Plans & Entitlements

Feature gating is centralized in `src/lib/auth/entitlements.ts`. Never hardcode subscription checks across components.

### Usage Example
```typescript
import { hasEntitlement } from "@/lib/auth/entitlements";

// Inside a React Server Component or API Route
if (!hasEntitlement(session.user, "intraday_breadth")) {
  return <UpgradePlanModal requiredPlan="INSTITUTIONAL" />;
}
```

### Plan Hierarchy
* `FREE`: Baseline heatmap, sector tables, chart studio, historical drilldowns.
* `PRO`: Custom watchlists, historical pattern matcher, CSV/Excel data export.
* `INSTITUTIONAL`: Intraday breadth scans, advanced custom scanner rules, real-time webhook alerts.

---

## 14. Protecting a New API Endpoint

When creating a new route handler in `src/app/api/...`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth/auth";
import { hasEntitlement } from "@/lib/auth/entitlements";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  // 1. Session check
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session || !session.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Entitlement check
  if (!hasEntitlement(session.user, "custom_watchlists")) {
    return NextResponse.json({ error: "Forbidden", message: "Plan upgrade required" }, { status: 403 });
  }

  // 3. Serve protected data
  return NextResponse.json({ data: "Sensitive institutional data" });
}
```
Defense-in-depth: Both `src/proxy.ts` and the route handler enforce session checks independently.
