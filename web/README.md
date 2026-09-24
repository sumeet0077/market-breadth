# QuantBreadth™ Web Terminal

Production-grade Quantitative Market Breadth, Macro Regimes, and Theme Leadership Intelligence web terminal built with **Next.js 16**, **Better Auth**, **Supabase PostgreSQL**, **Drizzle ORM**, and **Tailwind CSS**.

---

## Architecture Highlights

* **Application Framework**: Next.js 16 (App Router with Webpack build optimization).
* **Authentication**: Better Auth with email/password and Google OAuth 2.0.
* **Edge Proxy Protection**: Next.js 16 `src/proxy.ts` guarding all terminal routes, APIs, and static datasets.
* **Database & ORM**: Supabase PostgreSQL with PgBouncer connection pooling and Drizzle ORM.
* **Transactional Email**: Resend with mock fallback for local development.
* **Feature Gating**: Role & Plan-based entitlement system (`FREE`, `PRO`, `INSTITUTIONAL`).
* **Demo Environment**: Domain-aware demo mode (`demo.quantbreadth.com`) with one-click test credentials.

---

## Quick Start

### 1. Environment Setup
Copy the example environment configuration:
```bash
cp .env.example .env.local
```
Configure your credentials in `.env.local`.

### 2. Install Dependencies
```bash
npm install
```

### 3. Run Automated Tests
Execute the comprehensive test suite (Proxy route protection, API security, input validation, and entitlements):
```bash
npm test
```

### 4. Database Schema & Seeding
```bash
# Push schema to database
npm run db:push

# Seed initial admin and demo accounts
npm run db:seed
```

### 5. Launch Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

| Script | Description |
| :--- | :--- |
| `npm run dev` | Start Next.js development server |
| `npm run build` | Compile optimized production build |
| `npm start` | Start Next.js production server |
| `npm test` | Run all automated test suites |
| `npm run db:generate` | Generate Drizzle migrations |
| `npm run db:migrate` | Execute Drizzle migrations |
| `npm run db:push` | Push schema changes directly to PostgreSQL |
| `npm run db:seed` | Seed default terminal accounts |
| `npm run db:studio` | Launch Drizzle Studio database viewer |

---

## Documentation

For full architecture diagrams, Vercel/Cloudflare deployment guides, Supabase connection pooling configuration, and API security protocols, refer to:
👉 [docs/AUTHENTICATION_AND_SECURITY_ARCHITECTURE.md](../docs/AUTHENTICATION_AND_SECURITY_ARCHITECTURE.md)
