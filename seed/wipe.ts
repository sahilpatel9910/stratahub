/**
 * StrataHub — Demo Data Wipe
 *
 * Removes everything created by seed/demo.ts:
 *   1. All Supabase Auth accounts with @demo.test emails
 *   2. All Prisma users with @demo.test emails (cascade removes assignments, bookings, etc.)
 *   3. The "Harbour View Strata Group" organisation (cascade removes buildings, units, floors, etc.)
 *
 * Run:  npm run seed:wipe
 *
 * WARNING: This is destructive and irreversible. Do not run against real data.
 * The script pauses 5 seconds before proceeding — Ctrl+C to abort.
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const DEMO_SUFFIX   = "@demo.test";
const DEMO_ORG_NAME = "Harbour View Strata Group";

const adapter  = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db       = new PrismaClient({ adapter });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("🗑️   StrataHub demo data wipe\n");
  console.log("WARNING: This deletes ALL demo data. Ctrl+C to cancel.");
  console.log("Proceeding in 5 seconds…");
  await new Promise((r) => setTimeout(r, 5000));
  console.log();

  // ── 1. Supabase Auth accounts ─────────────────────────────────────────────
  console.log("→ Fetching @demo.test Supabase auth accounts…");
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const demoAuthUsers  = (list?.users ?? []).filter((u) => u.email?.endsWith(DEMO_SUFFIX));
  console.log(`  Found ${demoAuthUsers.length} accounts to delete`);

  let deleted = 0;
  for (const u of demoAuthUsers) {
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) {
      console.warn(`  ⚠️  Could not delete ${u.email}: ${error.message}`);
    } else {
      deleted++;
      process.stdout.write(".");
    }
  }
  console.log(`\n  ✓ ${deleted} Supabase auth accounts deleted`);

  // ── 2. Demo organisation first (cascade removes buildings → announcements,
  //        maintenance, parcels, visitor entries, etc. that reference users) ──
  console.log("\n→ Deleting demo organisation…");
  const org = await db.organisation.findFirst({ where: { name: DEMO_ORG_NAME } });
  if (org) {
    await db.organisation.delete({ where: { id: org.id } });
    console.log(`  ✓ Organisation "${DEMO_ORG_NAME}" deleted (buildings, units, floors, common areas cascade-removed)`);
  } else {
    console.log(`  ℹ️  Demo organisation not found — nothing to delete`);
  }

  // ── 3. Prisma users — safe now that all referencing records are gone ───────
  console.log("\n→ Deleting Prisma user records…");
  const { count: userCount } = await db.user.deleteMany({
    where: { email: { endsWith: DEMO_SUFFIX } },
  });
  console.log(`  ✓ ${userCount} users deleted (assignments, bookings, ownerships, tenancies cascade-removed)`);

  console.log("\n✅  Wipe complete. Run npm run seed:demo to re-seed.\n");
}

main()
  .catch((e) => { console.error("\n❌ Wipe failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
