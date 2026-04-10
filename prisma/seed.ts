/**
 * StrataHub seed script
 * Creates a super-admin user in both Supabase Auth and the Prisma DB,
 * plus a demo organisation and building so the dashboard works immediately.
 *
 * Run:  npm run db:seed
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ── config ─────────────────────────────────────────────────────────────────
const ADMIN_EMAIL    = "admin@stratahub.com.au";
const ADMIN_PASSWORD = "Admin1234!";
const ADMIN_FIRST    = "Admin";
const ADMIN_LAST     = "User";

const ORG_NAME  = "StrataHub Demo Org";
const ORG_STATE = "NSW" as const;

const BUILDING = {
  name:        "Harbour View Apartments",
  address:     "1 Macquarie Street",
  suburb:      "Sydney",
  state:       "NSW" as const,
  postcode:    "2000",
  totalFloors: 10,
  totalUnits:  24,
};
// ───────────────────────────────────────────────────────────────────────────

const adapter   = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db        = new PrismaClient({ adapter });
const supabase  = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  console.log("🌱  Starting seed...\n");

  // ── 1. Supabase auth user ────────────────────────────────────────────────
  console.log(`→ Creating Supabase auth user (${ADMIN_EMAIL})...`);
  const { data: authData, error: authError } =
    await supabase.auth.admin.createUser({
      email:          ADMIN_EMAIL,
      password:       ADMIN_PASSWORD,
      email_confirm:  true,   // skip email verification
    });

  if (authError) {
    if (authError.message.includes("already been registered")) {
      console.log("  ℹ️  Auth user already exists — fetching existing user.");
      const { data: list } = await supabase.auth.admin.listUsers();
      const existing = list?.users.find((u) => u.email === ADMIN_EMAIL);
      if (!existing) throw new Error("Could not find existing Supabase user.");
      authData!.user = existing;
    } else {
      throw new Error(`Supabase auth error: ${authError.message}`);
    }
  }

  const supabaseAuthId = authData!.user.id;
  console.log(`  ✓ Auth user id: ${supabaseAuthId}`);

  // ── 2. Organisation ───────────────────────────────────────────────────────
  console.log("\n→ Creating organisation...");
  const org = await db.organisation.upsert({
    where:  { name: ORG_NAME } as never,   // name isn't unique in schema, so we use findFirst below
    update: {},
    create: { name: ORG_NAME, state: ORG_STATE },
  }).catch(async () => {
    // upsert by name isn't clean — fall back to findFirst + create
    const existing = await db.organisation.findFirst({ where: { name: ORG_NAME } });
    if (existing) return existing;
    return db.organisation.create({ data: { name: ORG_NAME, state: ORG_STATE } });
  });
  console.log(`  ✓ Organisation: ${org.name} (${org.id})`);

  // ── 3. Building ───────────────────────────────────────────────────────────
  console.log("\n→ Creating building...");
  const existingBuilding = await db.building.findFirst({
    where: { name: BUILDING.name, organisationId: org.id },
  });
  const building = existingBuilding ?? await db.building.create({
    data: { organisationId: org.id, ...BUILDING },
  });
  console.log(`  ✓ Building: ${building.name} (${building.id})`);

  // ── 4. Prisma user record ─────────────────────────────────────────────────
  console.log("\n→ Creating app user record...");
  const user = await db.user.upsert({
    where:  { supabaseAuthId },
    update: { email: ADMIN_EMAIL, firstName: ADMIN_FIRST, lastName: ADMIN_LAST },
    create: {
      supabaseAuthId,
      email:     ADMIN_EMAIL,
      firstName: ADMIN_FIRST,
      lastName:  ADMIN_LAST,
    },
  });
  console.log(`  ✓ User: ${user.firstName} ${user.lastName} (${user.id})`);

  // ── 5. Org membership ────────────────────────────────────────────────────
  console.log("\n→ Assigning SUPER_ADMIN org membership...");
  await db.organisationMembership.upsert({
    where:  { userId_organisationId: { userId: user.id, organisationId: org.id } },
    update: { role: "SUPER_ADMIN" },
    create: { userId: user.id, organisationId: org.id, role: "SUPER_ADMIN" },
  });
  console.log("  ✓ OrganisationMembership created");

  // ── 6. Building assignment ────────────────────────────────────────────────
  console.log("\n→ Assigning SUPER_ADMIN building access...");
  // BuildingAssignment unique key is [userId, buildingId, role]
  const ba = await db.buildingAssignment.findFirst({
    where: { userId: user.id, buildingId: building.id, role: "SUPER_ADMIN" },
  });
  if (!ba) {
    await db.buildingAssignment.create({
      data: { userId: user.id, buildingId: building.id, role: "SUPER_ADMIN" },
    });
  }
  console.log("  ✓ BuildingAssignment created");

  // ── Done ─────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════╗
║               Seed complete! 🎉              ║
╠══════════════════════════════════════════════╣
║  URL:      http://localhost:3000             ║
║  Email:    ${ADMIN_EMAIL.padEnd(34)}║
║  Password: ${ADMIN_PASSWORD.padEnd(34)}║
╚══════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
