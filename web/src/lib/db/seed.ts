import { auth } from "../auth/auth";
import { db, client } from "./index";
import { user } from "./schema";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Seeding QuantBreadth™ database...");

  const accounts = [
    {
      name: "Terminal Administrator",
      email: "admin@quantbreadth.com",
      password: process.env.SEED_ADMIN_PASSWORD || "Admin1234!",
      role: "admin",
      plan: "INSTITUTIONAL",
    },
    {
      name: "Demo Institutional Analyst",
      email: "demo@quantbreadth.com",
      password: process.env.SEED_DEMO_PASSWORD || "Demo1234!",
      role: "demo",
      plan: "PRO",
    },
    {
      name: "Standard Trader",
      email: "user@quantbreadth.com",
      password: process.env.SEED_USER_PASSWORD || "User1234!",
      role: "user",
      plan: "FREE",
    },
  ];

  for (const acc of accounts) {
    try {
      // Check if user already exists
      const existing = await db.query.user.findFirst({
        where: eq(user.email, acc.email),
      });

      if (existing) {
        console.log(`ℹ️  User ${acc.email} already exists. Updating role and plan...`);
        await db
          .update(user)
          .set({
            role: acc.role,
            plan: acc.plan,
            emailVerified: true,
          })
          .where(eq(user.id, existing.id));
      } else {
        console.log(`➕ Creating user: ${acc.email} (${acc.role}, ${acc.plan})...`);
        const result = await auth.api.signUpEmail({
          body: {
            name: acc.name,
            email: acc.email,
            password: acc.password,
          },
        });

        if (result && result.user) {
          // Update role, plan, and verify email for seeded users
          await db
            .update(user)
            .set({
              role: acc.role,
              plan: acc.plan,
              emailVerified: true,
            })
            .where(eq(user.id, result.user.id));
        }
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.warn(`⚠️ Error seeding ${acc.email}:`, errorMsg);
    }
  }

  console.log("✅ Seeding completed.");
  await client.end();
  process.exit(0);
}

seed().catch(async (err: unknown) => {
  console.error("❌ Seeding failed:", err);
  await client.end().catch(() => {});
  process.exit(1);
});
