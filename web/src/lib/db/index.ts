import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// Determine database URL from environment
const connectionString =
  process.env.DATABASE_URL || "postgresql://postgres:postgres@localhost:5432/postgres";

// Production connection pool configuration tailored for Vercel Serverless Functions
// and Supabase Supavisor / PgBouncer connection poolers.
// IMPORTANT: `prepare: false` is required when using PgBouncer transaction mode (port 6543)
// `max: 1` ensures each serverless container does not exhaust pool limits.
declare global {
  var _pgClient: postgres.Sql | undefined;
}

// Supabase and cloud PostgreSQL instances always require SSL (even from local dev).
// Localhost / 127.0.0.1 does not use SSL.
const isLocalhost =
  connectionString.includes("localhost") ||
  connectionString.includes("127.0.0.1") ||
  connectionString.includes("host.docker.internal");

const client =
  globalThis._pgClient ||
  postgres(connectionString, {
    prepare: false,
    max: 1,
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: isLocalhost ? false : "require",
  });

if (process.env.NODE_ENV !== "production") {
  globalThis._pgClient = client;
}

export const db = drizzle(client, { schema });
export { client };
