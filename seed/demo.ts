/**
 * StrataHub — Full Demo Seed
 *
 * Creates a realistic dataset for local development and demos.
 *
 * Workflow rules enforced:
 *   1. Every unit MUST have an owner at creation time.
 *   2. A unit can be vacant (owner owns it, nobody living there) — isOccupied = false.
 *   3. If a tenant is assigned, isOccupied = true and all tenancy fields
 *      (rent, bond, leaseStart, leaseEnd) must be present.
 *
 * Unit scenarios seeded:
 *   101, 102, 103  — owner-occupied  (owner lives in their own unit)
 *   201, 202       — vacant          (owner owns but nobody living there)
 *   203, 301–303, 401 — tenanted     (owner rents out to a tenant)
 *   All other units — vacant         (owned, no current occupant)
 *
 * Accounts (all passwords: Demo1234!):
 *   manager@demo.com        — BUILDING_MANAGER
 *   reception@demo.com      — RECEPTION
 *   owner1–5@demo.com       — OWNER (units 101–103, 201, 202  — owner-occupied or vacant)
 *   owner6–10@demo.com      — OWNER (units 203, 301–303, 401  — renting to tenants)
 *   owner11–17@demo.com     — OWNER (remaining 20 units on floors 4–10, all vacant investment)
 *   tenant1–5@demo.com      — TENANT (units 203, 301–303, 401)
 *
 * Run:  npm run db:seed:demo
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ── Config ────────────────────────────────────────────────────────────────────

const PASSWORD = "Demo1234!";

const USERS = [
  // Staff
  { email: "manager@demo.com",   firstName: "Sarah",    lastName: "Mitchell", role: "BUILDING_MANAGER" as const },
  { email: "reception@demo.com", firstName: "James",    lastName: "Torres",   role: "RECEPTION" as const },
  // Owner-occupied units (101, 102, 103)
  { email: "owner1@demo.com",    firstName: "Emily",    lastName: "Chen",     role: "OWNER" as const },
  { email: "owner2@demo.com",    firstName: "Michael",  lastName: "Patel",    role: "OWNER" as const },
  { email: "owner3@demo.com",    firstName: "Sophie",   lastName: "Williams", role: "OWNER" as const },
  // Vacant investment units (201, 202)
  { email: "owner4@demo.com",    firstName: "Liam",     lastName: "Johnson",  role: "OWNER" as const },
  { email: "owner5@demo.com",    firstName: "Olivia",   lastName: "Brown",    role: "OWNER" as const },
  // Landlords who rent out to tenants (203, 301, 302, 303, 401)
  { email: "owner6@demo.com",    firstName: "Marcus",   lastName: "Reid",     role: "OWNER" as const },
  { email: "owner7@demo.com",    firstName: "Priya",    lastName: "Sharma",   role: "OWNER" as const },
  { email: "owner8@demo.com",    firstName: "Connor",   lastName: "Walsh",    role: "OWNER" as const },
  { email: "owner9@demo.com",    firstName: "Zoe",      lastName: "Nguyen",   role: "OWNER" as const },
  { email: "owner10@demo.com",   firstName: "Adrian",   lastName: "Fletcher", role: "OWNER" as const },
  // Investors — own floors 4–10 remaining units (all vacant)
  { email: "owner11@demo.com",   firstName: "Helena",   lastName: "Cross",    role: "OWNER" as const },  // 402, 403
  { email: "owner12@demo.com",   firstName: "Daniel",   lastName: "Park",     role: "OWNER" as const },  // 501, 502, 503
  { email: "owner13@demo.com",   firstName: "Lucia",    lastName: "Santos",   role: "OWNER" as const },  // 601, 602, 603
  { email: "owner14@demo.com",   firstName: "James",    lastName: "Okafor",   role: "OWNER" as const },  // 701, 702, 703
  { email: "owner15@demo.com",   firstName: "Nina",     lastName: "Kovacs",   role: "OWNER" as const },  // 801, 802, 803
  { email: "owner16@demo.com",   firstName: "Samuel",   lastName: "Yuen",     role: "OWNER" as const },  // 901, 902, 903
  { email: "owner17@demo.com",   firstName: "Rachel",   lastName: "Brennan",  role: "OWNER" as const },  // 1001, 1002, 1003
  // Tenants
  { email: "tenant1@demo.com",   firstName: "Noah",     lastName: "Davis",    role: "TENANT" as const },
  { email: "tenant2@demo.com",   firstName: "Ava",      lastName: "Wilson",   role: "TENANT" as const },
  { email: "tenant3@demo.com",   firstName: "Ethan",    lastName: "Moore",    role: "TENANT" as const },
  { email: "tenant4@demo.com",   firstName: "Isabella", lastName: "Taylor",   role: "TENANT" as const },
  { email: "tenant5@demo.com",   firstName: "Mason",    lastName: "Anderson", role: "TENANT" as const },
];

// ── Clients ───────────────────────────────────────────────────────────────────

const adapter  = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db       = new PrismaClient({ adapter });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Helpers ───────────────────────────────────────────────────────────────────

async function upsertAuthUser(email: string, firstName: string, lastName: string) {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { firstName, lastName },
  });
  if (error) throw new Error(`Auth error for ${email}: ${error.message}`);
  return data.user.id;
}

async function upsertDbUser(supabaseAuthId: string, email: string, firstName: string, lastName: string) {
  return db.user.upsert({
    where: { supabaseAuthId },
    update: { email, firstName, lastName },
    create: { supabaseAuthId, email, firstName, lastName },
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  Starting demo seed...\n");

  // ── 1. Organisation ───────────────────────────────────────────────────────
  console.log("→ Organisation...");
  let org = await db.organisation.findFirst({ where: { name: "Harbour Strata Pty Ltd" } });
  if (!org) {
    org = await db.organisation.create({
      data: { name: "Harbour Strata Pty Ltd", state: "NSW" },
    });
  }
  console.log(`  ✓ ${org.name}`);

  // ── 2. Building ───────────────────────────────────────────────────────────
  console.log("→ Building...");
  let building = await db.building.findFirst({
    where: { name: "Harbour View Apartments", organisationId: org.id },
  });
  if (!building) {
    building = await db.building.create({
      data: {
        organisationId: org.id,
        name: "Harbour View Apartments",
        address: "1 Macquarie Street",
        suburb: "Sydney",
        state: "NSW",
        postcode: "2000",
        totalFloors: 10,
        totalUnits: 30,
        strataSchemeNo: "SP12345",
      },
    });
  }
  console.log(`  ✓ ${building.name}`);

  // ── 3. Floors ─────────────────────────────────────────────────────────────
  console.log("→ Floors (1–10)...");
  const floors: Record<number, string> = {};
  for (let n = 1; n <= 10; n++) {
    let floor = await db.floor.findFirst({ where: { buildingId: building.id, number: n } });
    if (!floor) {
      floor = await db.floor.create({
        data: { buildingId: building.id, number: n, label: `Level ${n}` },
      });
    }
    floors[n] = floor.id;
  }
  console.log("  ✓ 10 floors");

  // ── 4. Units (3 per floor = 30 total) ────────────────────────────────────
  // All units start as isOccupied = false. isOccupied is only set to true
  // explicitly after an owner-occupancy or a tenancy is created below.
  console.log("→ Units...");
  const units: Record<string, string> = {};
  for (let floor = 1; floor <= 10; floor++) {
    for (let pos = 1; pos <= 3; pos++) {
      const unitNumber = `${floor}0${pos}`;
      let unit = await db.unit.findFirst({ where: { buildingId: building.id, unitNumber } });
      if (!unit) {
        unit = await db.unit.create({
          data: {
            buildingId: building.id,
            floorId: floors[floor],
            unitNumber,
            unitType: "APARTMENT",
            bedrooms: pos === 3 ? 3 : pos,
            bathrooms: pos,
            squareMetres: 55 + pos * 20,
            isOccupied: false, // always start false — set true below after assignment
          },
        });
      }
      units[unitNumber] = unit.id;
    }
  }
  console.log("  ✓ 30 units across 10 floors (all start vacant)");

  // ── 5. Auth + DB users ────────────────────────────────────────────────────
  console.log("→ Creating auth + DB users...");
  const dbUsers: Record<string, string> = {};
  for (const u of USERS) {
    const authId = await upsertAuthUser(u.email, u.firstName, u.lastName);
    const dbUser = await upsertDbUser(authId, u.email, u.firstName, u.lastName);
    dbUsers[u.email] = dbUser.id;
    process.stdout.write(`  ✓ ${u.firstName} ${u.lastName} (${u.email})\n`);
  }

  // ── 6. Org memberships + building assignments (staff) ────────────────────
  console.log("→ Building assignments (staff)...");
  for (const u of USERS.filter((u) => u.role === "BUILDING_MANAGER" || u.role === "RECEPTION")) {
    const userId = dbUsers[u.email];
    const existing = await db.buildingAssignment.findFirst({
      where: { userId, buildingId: building.id, role: u.role },
    });
    if (!existing) {
      await db.buildingAssignment.create({
        data: { userId, buildingId: building.id, role: u.role, isActive: true },
      });
    }
    await db.organisationMembership.upsert({
      where: { userId_organisationId: { userId, organisationId: org.id } },
      update: { role: u.role },
      create: { userId, organisationId: org.id, role: u.role },
    });
  }
  console.log("  ✓ Manager + reception assigned");

  // ── 7. Ownerships ─────────────────────────────────────────────────────────
  // owner1–3 → units 101–103  (owner-occupied: they live in their own unit)
  // owner4–5 → units 201–202  (vacant investment: owner owns but nobody living there)
  // owner6–10 → units 203, 301–303, 401  (landlords who rent to tenants)
  console.log("→ Ownerships...");

  const ownershipMap: Array<{ email: string; unitNumber: string; ownerOccupied: boolean }> = [
    { email: "owner1@demo.com",  unitNumber: "101", ownerOccupied: true  },
    { email: "owner2@demo.com",  unitNumber: "102", ownerOccupied: true  },
    { email: "owner3@demo.com",  unitNumber: "103", ownerOccupied: true  },
    { email: "owner4@demo.com",  unitNumber: "201", ownerOccupied: false }, // vacant investment
    { email: "owner5@demo.com",  unitNumber: "202", ownerOccupied: false }, // vacant investment
    { email: "owner6@demo.com",  unitNumber: "203", ownerOccupied: false }, // rents to tenant1
    { email: "owner7@demo.com",  unitNumber: "301", ownerOccupied: false }, // rents to tenant2
    { email: "owner8@demo.com",  unitNumber: "302", ownerOccupied: false }, // rents to tenant3
    { email: "owner9@demo.com",  unitNumber: "303", ownerOccupied: false }, // rents to tenant4
    { email: "owner10@demo.com", unitNumber: "401", ownerOccupied: false }, // rents to tenant5
    // Investors — floors 4–10 remaining units (all vacant)
    { email: "owner11@demo.com", unitNumber: "402", ownerOccupied: false },
    { email: "owner11@demo.com", unitNumber: "403", ownerOccupied: false },
    { email: "owner12@demo.com", unitNumber: "501", ownerOccupied: false },
    { email: "owner12@demo.com", unitNumber: "502", ownerOccupied: false },
    { email: "owner12@demo.com", unitNumber: "503", ownerOccupied: false },
    { email: "owner13@demo.com", unitNumber: "601", ownerOccupied: false },
    { email: "owner13@demo.com", unitNumber: "602", ownerOccupied: false },
    { email: "owner13@demo.com", unitNumber: "603", ownerOccupied: false },
    { email: "owner14@demo.com", unitNumber: "701", ownerOccupied: false },
    { email: "owner14@demo.com", unitNumber: "702", ownerOccupied: false },
    { email: "owner14@demo.com", unitNumber: "703", ownerOccupied: false },
    { email: "owner15@demo.com", unitNumber: "801", ownerOccupied: false },
    { email: "owner15@demo.com", unitNumber: "802", ownerOccupied: false },
    { email: "owner15@demo.com", unitNumber: "803", ownerOccupied: false },
    { email: "owner16@demo.com", unitNumber: "901", ownerOccupied: false },
    { email: "owner16@demo.com", unitNumber: "902", ownerOccupied: false },
    { email: "owner16@demo.com", unitNumber: "903", ownerOccupied: false },
    { email: "owner17@demo.com", unitNumber: "1001", ownerOccupied: false },
    { email: "owner17@demo.com", unitNumber: "1002", ownerOccupied: false },
    { email: "owner17@demo.com", unitNumber: "1003", ownerOccupied: false },
  ];

  for (const entry of ownershipMap) {
    const userId = dbUsers[entry.email];
    const unitId = units[entry.unitNumber];

    // Org membership
    await db.organisationMembership.upsert({
      where: { userId_organisationId: { userId, organisationId: org.id } },
      update: {},
      create: { userId, organisationId: org.id, role: "OWNER" },
    });

    // Building assignment
    await db.buildingAssignment.upsert({
      where: { userId_buildingId_role: { userId, buildingId: building.id, role: "OWNER" } },
      update: {},
      create: { userId, buildingId: building.id, role: "OWNER", isActive: true },
    });

    // Ownership record
    const existing = await db.ownership.findFirst({ where: { userId, unitId } });
    if (!existing) {
      await db.ownership.create({
        data: {
          userId,
          unitId,
          purchaseDate: new Date("2021-06-01"),
          isActive: true,
          isPrimary: true,
          ownershipPct: 100,
        },
      });
    }

    // Only set isOccupied = true if the owner lives in their own unit
    if (entry.ownerOccupied) {
      await db.unit.update({
        where: { id: unitId },
        data: { isOccupied: true },
      });
    }
    // Vacant investment units stay isOccupied = false — that is correct and expected
  }
  console.log("  ✓ 30 ownerships created (all units now have an owner)");
  console.log("  ✓ Units 101–103: owner-occupied (isOccupied = true)");
  console.log("  ✓ Units 201–202: vacant investment (isOccupied = false)");
  console.log("  ✓ Units 203, 301–303, 401: owned by landlords (awaiting tenants)");
  console.log("  ✓ Units 402–1003: vacant investment (owner11–17, multi-unit investors)");

  // ── 8. Tenancies ──────────────────────────────────────────────────────────
  // Workflow rule: tenant must have complete data — rent, bond, leaseStart, leaseEnd.
  // After each tenancy, isOccupied = true on the unit.
  console.log("→ Tenancies...");

  const tenancyMap: Array<{
    tenantEmail: string;
    unitNumber: string;
    leaseStartDate: Date;
    leaseEndDate: Date;
    rentAmountCents: number;
    bondAmountCents: number;
    moveInDate: Date;
  }> = [
    {
      tenantEmail: "tenant1@demo.com", unitNumber: "203",
      leaseStartDate: new Date("2024-01-15"), leaseEndDate: new Date("2025-01-14"),
      rentAmountCents: 250000, bondAmountCents: 500000,
      moveInDate: new Date("2024-01-15"),
    },
    {
      tenantEmail: "tenant2@demo.com", unitNumber: "301",
      leaseStartDate: new Date("2024-03-01"), leaseEndDate: new Date("2025-02-28"),
      rentAmountCents: 275000, bondAmountCents: 550000,
      moveInDate: new Date("2024-03-01"),
    },
    {
      tenantEmail: "tenant3@demo.com", unitNumber: "302",
      leaseStartDate: new Date("2024-02-01"), leaseEndDate: new Date("2025-01-31"),
      rentAmountCents: 300000, bondAmountCents: 600000,
      moveInDate: new Date("2024-02-01"),
    },
    {
      tenantEmail: "tenant4@demo.com", unitNumber: "303",
      leaseStartDate: new Date("2024-04-01"), leaseEndDate: new Date("2025-03-31"),
      rentAmountCents: 325000, bondAmountCents: 650000,
      moveInDate: new Date("2024-04-01"),
    },
    {
      tenantEmail: "tenant5@demo.com", unitNumber: "401",
      leaseStartDate: new Date("2024-05-01"), leaseEndDate: new Date("2025-04-30"),
      rentAmountCents: 350000, bondAmountCents: 700000,
      moveInDate: new Date("2024-05-01"),
    },
  ];

  for (const entry of tenancyMap) {
    const userId = dbUsers[entry.tenantEmail];
    const unitId = units[entry.unitNumber];

    // Org membership
    await db.organisationMembership.upsert({
      where: { userId_organisationId: { userId, organisationId: org.id } },
      update: {},
      create: { userId, organisationId: org.id, role: "TENANT" },
    });

    // Building assignment
    await db.buildingAssignment.upsert({
      where: { userId_buildingId_role: { userId, buildingId: building.id, role: "TENANT" } },
      update: {},
      create: { userId, buildingId: building.id, role: "TENANT", isActive: true },
    });

    // Tenancy record + payment schedule
    const existing = await db.tenancy.findFirst({ where: { userId, unitId, isActive: true } });
    if (!existing) {
      await db.$transaction(async (tx) => {
        const tenancy = await tx.tenancy.create({
          data: {
            userId, unitId,
            leaseStartDate: entry.leaseStartDate,
            leaseEndDate: entry.leaseEndDate,
            rentAmountCents: entry.rentAmountCents,
            rentFrequency: "MONTHLY",
            bondAmountCents: entry.bondAmountCents,
            bondStatus: "LODGED",
            moveInDate: entry.moveInDate,
            isActive: true,
          },
        });

        // Generate 12-month payment schedule from lease start
        const payments = [];
        for (let i = 0; i < 12; i++) {
          const dueDate = new Date(entry.leaseStartDate);
          dueDate.setMonth(dueDate.getMonth() + i);
          payments.push({ tenancyId: tenancy.id, amountCents: entry.rentAmountCents, dueDate, status: "PENDING" as const });
        }
        await tx.rentPayment.createMany({ data: payments });
      });
    }

    // Tenant is now living in the unit — mark as occupied
    await db.unit.update({ where: { id: unitId }, data: { isOccupied: true } });
  }
  console.log("  ✓ 5 tenancies created with 12-month payment schedules (units 203, 301–303, 401 → isOccupied = true)");

  // ── 9. Strata info ────────────────────────────────────────────────────────
  console.log("→ Strata info...");
  const existingStrata = await db.strataInfo.findUnique({ where: { buildingId: building.id } });
  if (!existingStrata) {
    await db.strataInfo.create({
      data: {
        buildingId: building.id,
        strataPlanNumber: "SP12345",
        strataManagerName: "City Strata Management",
        strataManagerEmail: "strata@citystrata.com.au",
        strataManagerPhone: "02 9000 1234",
        adminFundBalance: 12500000,
        capitalWorksBalance: 45000000,
        insurancePolicyNo: "POL-2024-98765",
        insuranceExpiry: new Date("2025-06-30"),
        nextAgmDate: new Date("2025-09-15"),
      },
    });
  }
  console.log("  ✓ Strata info set");

  // ── 10. Common areas ──────────────────────────────────────────────────────
  console.log("→ Common areas...");
  const commonAreas = [
    { name: "Rooftop BBQ Area", description: "Rooftop entertaining area with BBQ facilities", capacity: 30, bookingRequired: true, operatingHours: "7am–10pm", floor: 10 },
    { name: "Gym", description: "Fully equipped gymnasium", capacity: 15, bookingRequired: false, operatingHours: "5am–11pm", floor: 1 },
    { name: "Pool & Spa", description: "Heated indoor pool and spa", capacity: 20, bookingRequired: true, operatingHours: "6am–9pm", floor: 1 },
    { name: "Meeting Room", description: "Private meeting room for residents", capacity: 10, bookingRequired: true, operatingHours: "8am–8pm", floor: 2 },
  ];
  for (const area of commonAreas) {
    const existing = await db.commonArea.findFirst({ where: { buildingId: building.id, name: area.name } });
    if (!existing) {
      await db.commonArea.create({ data: { buildingId: building.id, ...area } });
    }
  }
  console.log("  ✓ 4 common areas");

  // ── 11. Announcements ─────────────────────────────────────────────────────
  console.log("→ Announcements...");
  const managerId = dbUsers["manager@demo.com"];
  const announcements = [
    {
      title: "Water Outage — Level 3 to 6",
      content: "Scheduled maintenance on the water supply for levels 3–6. Water will be off between 9am–12pm this Saturday. We apologise for any inconvenience.",
      priority: "HIGH" as const,
      publishedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
    },
    {
      title: "New Gym Equipment Installed",
      content: "We've upgraded the gym with new cardio equipment including two treadmills, a rowing machine, and a full cable system. Come check it out!",
      priority: "LOW" as const,
      publishedAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    },
    {
      title: "AGM Reminder — 15 September",
      content: "The Annual General Meeting is scheduled for 15 September at 7pm in the Meeting Room (Level 2). All owners are encouraged to attend. Agenda available on request.",
      priority: "MEDIUM" as const,
      publishedAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
    },
  ];
  for (const ann of announcements) {
    const existing = await db.announcement.findFirst({ where: { buildingId: building.id, title: ann.title } });
    if (!existing) {
      await db.announcement.create({
        data: { buildingId: building.id, authorId: managerId, scope: "BUILDING", ...ann },
      });
    }
  }
  console.log("  ✓ 3 announcements");

  // ── 12. Maintenance requests ──────────────────────────────────────────────
  console.log("→ Maintenance requests...");
  const maintenanceRequests = [
    {
      unitId: units["101"], requestedById: dbUsers["owner1@demo.com"],
      title: "Kitchen tap dripping",
      description: "The kitchen tap has been dripping constantly for 3 days. Wasting a lot of water.",
      category: "PLUMBING" as const, priority: "MEDIUM" as const, status: "IN_PROGRESS" as const,
    },
    {
      unitId: units["203"], requestedById: dbUsers["tenant1@demo.com"],
      title: "Bathroom exhaust fan not working",
      description: "The exhaust fan in the main bathroom stopped working. Getting mould on the ceiling.",
      category: "ELECTRICAL" as const, priority: "HIGH" as const, status: "SUBMITTED" as const,
    },
    {
      unitId: units["102"], requestedById: dbUsers["owner2@demo.com"],
      title: "Air con not cooling",
      description: "The air conditioner runs but does not cool the room. Temperature barely drops even on full power.",
      category: "HVAC" as const, priority: "URGENT" as const, status: "ACKNOWLEDGED" as const,
    },
    {
      unitId: units["301"], requestedById: dbUsers["tenant2@demo.com"],
      title: "Front door lock stiff",
      description: "The front door deadlock is very stiff and hard to turn. Getting worse each week.",
      category: "SECURITY" as const, priority: "MEDIUM" as const, status: "COMPLETED" as const,
      completedDate: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
    },
  ];
  for (const req of maintenanceRequests) {
    const existing = await db.maintenanceRequest.findFirst({
      where: { unitId: req.unitId, title: req.title },
    });
    if (!existing) {
      await db.maintenanceRequest.create({ data: req });
    }
  }
  console.log("  ✓ 4 maintenance requests");

  // ── 13. Parcels ───────────────────────────────────────────────────────────
  console.log("→ Parcels...");
  const receptionId = dbUsers["reception@demo.com"];
  const parcels = [
    { unitNumber: "101", recipientName: "Emily Chen",     carrier: "Australia Post", trackingNumber: "AP123456789AU", status: "NOTIFIED" as const },
    { unitNumber: "203", recipientName: "Noah Davis",     carrier: "DHL",            trackingNumber: "DHL987654321",  status: "RECEIVED" as const },
    { unitNumber: "103", recipientName: "Sophie Williams",carrier: "FedEx",          status: "COLLECTED" as const, collectedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), collectedBy: "Sophie Williams" },
  ];
  for (const parcel of parcels) {
    const existing = await db.parcel.findFirst({ where: { buildingId: building.id, trackingNumber: parcel.trackingNumber ?? null } });
    if (!existing) {
      await db.parcel.create({ data: { buildingId: building.id, loggedById: receptionId, ...parcel } });
    }
  }
  console.log("  ✓ 3 parcels");

  // ── Done ──────────────────────────────────────────────────────────────────
  console.log(`
╔══════════════════════════════════════════════════════════════════════╗
║                    Demo seed complete! 🎉                            ║
╠══════════════════════════════════════════════════════════════════════╣
║  URL:       http://localhost:3000                                     ║
║  Password:  Demo1234!  (all accounts)                                ║
╠══════════════════════════════════════════════════════════════════════╣
║  manager@demo.com       → Building Manager                           ║
║  reception@demo.com     → Reception                                  ║
╠══════════════════════════════════════════════════════════════════════╣
║  OWNER-OCCUPIED units (owner lives in their unit)                    ║
║  owner1@demo.com  → Unit 101  (Emily Chen)                           ║
║  owner2@demo.com  → Unit 102  (Michael Patel)                        ║
║  owner3@demo.com  → Unit 103  (Sophie Williams)                      ║
╠══════════════════════════════════════════════════════════════════════╣
║  VACANT units (owner owns, nobody living there)                      ║
║  owner4@demo.com  → Unit 201  (Liam Johnson)                         ║
║  owner5@demo.com  → Unit 202  (Olivia Brown)                         ║
╠══════════════════════════════════════════════════════════════════════╣
║  TENANTED units (owner rents to tenant)                              ║
║  owner6@demo.com  → Unit 203  ← tenant1@demo.com (Noah Davis)        ║
║  owner7@demo.com  → Unit 301  ← tenant2@demo.com (Ava Wilson)        ║
║  owner8@demo.com  → Unit 302  ← tenant3@demo.com (Ethan Moore)       ║
║  owner9@demo.com  → Unit 303  ← tenant4@demo.com (Isabella Taylor)   ║
║  owner10@demo.com → Unit 401  ← tenant5@demo.com (Mason Anderson)    ║
╠══════════════════════════════════════════════════════════════════════╣
║  VACANT INVESTMENT (multi-unit owners, floors 4–10)                  ║
║  owner11@demo.com → Units 402, 403        (Helena Cross)             ║
║  owner12@demo.com → Units 501, 502, 503   (Daniel Park)              ║
║  owner13@demo.com → Units 601, 602, 603   (Lucia Santos)             ║
║  owner14@demo.com → Units 701, 702, 703   (James Okafor)             ║
║  owner15@demo.com → Units 801, 802, 803   (Nina Kovacs)              ║
║  owner16@demo.com → Units 901, 902, 903   (Samuel Yuen)              ║
║  owner17@demo.com → Units 1001, 1002, 1003 (Rachel Brennan)          ║
╚══════════════════════════════════════════════════════════════════════╝
  `);
}

main()
  .catch((e) => { console.error("❌ Demo seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
