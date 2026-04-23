/**
 * StrataHub — Demo Data Seed
 *
 * Creates 1 demo organisation with 3 buildings, floors, units,
 * building managers, reception staff, 10 owners + 10 tenants each.
 * Every account is a real Supabase Auth user — you can log in as any of them.
 *
 * Password for ALL seeded accounts: Demo1234!
 *
 * Email patterns:
 *   hv.manager@demo.test   hv.reception@demo.test
 *   hv.owner1@demo.test … hv.owner10@demo.test
 *   hv.tenant1@demo.test … hv.tenant10@demo.test
 *   (same with ps.* for Parkside, tm.* for The Meridian)
 *
 * Run:   npm run seed:demo
 * Wipe:  npm run seed:wipe
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// ── Bootstrap ────────────────────────────────────────────────────────────────

const DEMO_PASSWORD    = "Demo1234!";
const DEMO_SUFFIX      = "@demo.test";
const DEMO_ORG_NAME    = "Harbour View Strata Group";

const adapter  = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db       = new PrismaClient({ adapter });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

// ── Static Definitions ────────────────────────────────────────────────────────

const BUILDINGS = [
  {
    key:          "hv",
    name:         "Harbour View Apartments",
    address:      "12 Macquarie Street",
    suburb:       "Sydney",
    state:        "NSW" as const,
    postcode:     "2000",
    totalFloors:  10,
    totalUnits:   40,
    schemeNo:     "SP12345",
    manager:   { firstName: "Tom",   lastName: "Richards", email: "hv.manager"   },
    reception: { firstName: "Grace", lastName: "Liu",      email: "hv.reception" },
    owners: [
      { firstName: "James",       lastName: "Wilson"    },
      { firstName: "Sarah",       lastName: "Chen"      },
      { firstName: "Michael",     lastName: "Thompson"  },
      { firstName: "Emma",        lastName: "Davis"     },
      { firstName: "Robert",      lastName: "Johnson"   },
      { firstName: "Lisa",        lastName: "Anderson"  },
      { firstName: "David",       lastName: "Martinez"  },
      { firstName: "Jennifer",    lastName: "Taylor"    },
      { firstName: "Christopher", lastName: "Lee"       },
      { firstName: "Amanda",      lastName: "White"     },
    ],
    tenants: [
      { firstName: "Daniel",   lastName: "Brown"    },
      { firstName: "Sophie",   lastName: "Harris"   },
      { firstName: "Matthew",  lastName: "Clark"    },
      { firstName: "Olivia",   lastName: "Robinson" },
      { firstName: "Joshua",   lastName: "Lewis"    },
      { firstName: "Isabella", lastName: "Walker"   },
      { firstName: "Ethan",    lastName: "Hall"     },
      { firstName: "Charlotte",lastName: "Young"    },
      { firstName: "Benjamin", lastName: "King"     },
      { firstName: "Mia",      lastName: "Wright"   },
    ],
    commonAreas: [
      { name: "Rooftop Pool",  description: "Heated pool with city views",      capacity: 20, bookingRequired: true,  operatingHours: "7am – 10pm", floor: 10 },
      { name: "Gym",           description: "Fully equipped fitness centre",     capacity: 15, bookingRequired: false, operatingHours: "5am – 11pm", floor: 2  },
      { name: "BBQ Terrace",   description: "Outdoor BBQ and entertaining area", capacity: 30, bookingRequired: true,  operatingHours: "9am – 9pm",  floor: 1  },
      { name: "Meeting Room",  description: "Boardroom-style meeting room",      capacity: 10, bookingRequired: true,  operatingHours: "8am – 8pm",  floor: 1  },
    ],
  },
  {
    key:         "ps",
    name:        "Parkside Residences",
    address:     "45 Park Street",
    suburb:      "Melbourne",
    state:       "VIC" as const,
    postcode:    "3000",
    totalFloors: 8,
    totalUnits:  32,
    schemeNo:    "OC67890",
    manager:   { firstName: "Karen", lastName: "Stevens", email: "ps.manager"   },
    reception: { firstName: "Jack",  lastName: "OBrien",  email: "ps.reception" },
    owners: [
      { firstName: "Thomas",    lastName: "Baker"   },
      { firstName: "Rebecca",   lastName: "Evans"   },
      { firstName: "Andrew",    lastName: "Scott"   },
      { firstName: "Catherine", lastName: "Morris"  },
      { firstName: "Steven",    lastName: "Hughes"  },
      { firstName: "Nicole",    lastName: "Cooper"  },
      { firstName: "Mark",      lastName: "Reed"    },
      { firstName: "Patricia",  lastName: "Cox"     },
      { firstName: "Kevin",     lastName: "Ward"    },
      { firstName: "Laura",     lastName: "Torres"  },
    ],
    tenants: [
      { firstName: "Ryan",     lastName: "Phillips"  },
      { firstName: "Hannah",   lastName: "Campbell"  },
      { firstName: "Tyler",    lastName: "Parker"    },
      { firstName: "Zoe",      lastName: "Evans"     },
      { firstName: "Nathan",   lastName: "Edwards"   },
      { firstName: "Grace",    lastName: "Collins"   },
      { firstName: "Luke",     lastName: "Stewart"   },
      { firstName: "Chloe",    lastName: "Sanchez"   },
      { firstName: "Adam",     lastName: "Morris"    },
      { firstName: "Lily",     lastName: "Rogers"    },
    ],
    commonAreas: [
      { name: "Swimming Pool", description: "25m heated lap pool",           capacity: 25, bookingRequired: true,  operatingHours: "6am – 9pm",  floor: 1 },
      { name: "Gym",           description: "Cardio and free weights",       capacity: 12, bookingRequired: false, operatingHours: "5am – 11pm", floor: 1 },
      { name: "Function Room", description: "Private dining and event space",capacity: 40, bookingRequired: true,  operatingHours: "9am – 10pm", floor: 8 },
    ],
  },
  {
    key:         "tm",
    name:        "The Meridian",
    address:     "100 Queen Street",
    suburb:      "Brisbane",
    state:       "QLD" as const,
    postcode:    "4000",
    totalFloors: 6,
    totalUnits:  24,
    schemeNo:    "BUP100234",
    manager:   { firstName: "Paul",  lastName: "Murphy", email: "tm.manager"   },
    reception: { firstName: "Priya", lastName: "Sharma", email: "tm.reception" },
    owners: [
      { firstName: "Scott",    lastName: "Peterson" },
      { firstName: "Natalie",  lastName: "Gray"     },
      { firstName: "Brian",    lastName: "James"    },
      { firstName: "Stephanie",lastName: "Watson"   },
      { firstName: "Gary",     lastName: "Brooks"   },
      { firstName: "Melissa",  lastName: "Kelly"    },
      { firstName: "Craig",    lastName: "Sanders"  },
      { firstName: "Vanessa",  lastName: "Price"    },
      { firstName: "Brett",    lastName: "Bennett"  },
      { firstName: "Tamara",   lastName: "Wood"     },
    ],
    tenants: [
      { firstName: "Marcus",  lastName: "Foster"    },
      { firstName: "Jade",    lastName: "Griffin"   },
      { firstName: "Dylan",   lastName: "Hayes"     },
      { firstName: "Amber",   lastName: "Bryant"    },
      { firstName: "Jordan",  lastName: "Alexander" },
      { firstName: "Tara",    lastName: "Russell"   },
      { firstName: "Blake",   lastName: "Hunter"    },
      { firstName: "Kayla",   lastName: "Diaz"      },
      { firstName: "Travis",  lastName: "Barnes"    },
      { firstName: "Natasha", lastName: "Fisher"    },
    ],
    commonAreas: [
      { name: "Rooftop Garden", description: "Landscaped rooftop with seating", capacity: 20, bookingRequired: false, operatingHours: "7am – 9pm",  floor: 6 },
      { name: "Gym",            description: "Modern fitness centre",           capacity: 10, bookingRequired: false, operatingHours: "5am – 11pm", floor: 1 },
      { name: "Courtyard",      description: "Ground floor outdoor space",      capacity: 30, bookingRequired: false, operatingHours: "All hours",  floor: 1 },
    ],
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function pastDate(daysAgo: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d;
}

function futureDate(daysFromNow: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d;
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function phone(): string {
  return `04${String(Math.floor(Math.random() * 90_000_000) + 10_000_000)}`;
}

// Pre-fetched map of existing Supabase @demo.test users. Populated once in main().
const existingAuthMap = new Map<string, string>(); // email → supabaseAuthId

async function getOrCreateSupabaseUser(emailPrefix: string): Promise<string> {
  const fullEmail = `${emailPrefix}${DEMO_SUFFIX}`;
  if (existingAuthMap.has(fullEmail)) return existingAuthMap.get(fullEmail)!;

  const { data, error } = await supabase.auth.admin.createUser({
    email:         fullEmail,
    password:      DEMO_PASSWORD,
    email_confirm: true,
  });

  if (error) {
    throw new Error(`Supabase createUser failed for ${fullEmail}: ${error.message}`);
  }

  existingAuthMap.set(fullEmail, data.user.id);
  return data.user.id;
}

async function getOrCreatePrismaUser(
  supabaseAuthId: string,
  emailPrefix: string,
  firstName: string,
  lastName: string,
) {
  const email = `${emailPrefix}${DEMO_SUFFIX}`;
  return db.user.upsert({
    where:  { supabaseAuthId },
    update: { email, firstName, lastName },
    create: { supabaseAuthId, email, firstName, lastName, phone: phone() },
  });
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱  StrataHub demo seed starting…\n");

  // Pre-fetch existing @demo.test Supabase users so re-runs skip re-creation
  console.log("→ Pre-fetching existing demo auth accounts…");
  const { data: existing } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  for (const u of existing?.users ?? []) {
    if (u.email?.endsWith(DEMO_SUFFIX)) existingAuthMap.set(u.email, u.id);
  }
  console.log(`  ✓ Found ${existingAuthMap.size} existing demo accounts\n`);

  // ── Organisation ─────────────────────────────────────────────────────────
  let org = await db.organisation.findFirst({ where: { name: DEMO_ORG_NAME } });
  if (!org) {
    org = await db.organisation.create({
      data: { name: DEMO_ORG_NAME, state: "NSW", abn: "12 345 678 901" },
    });
    console.log(`✓ Organisation created: ${org.name}`);
  } else {
    console.log(`✓ Organisation already exists: ${org.name}`);
  }

  // Give the existing super-admin membership in the demo org
  const superAdmin = await db.user.findFirst({ where: { email: "admin@stratahub.com.au" } });
  if (superAdmin) {
    await db.organisationMembership.upsert({
      where:  { userId_organisationId: { userId: superAdmin.id, organisationId: org.id } },
      update: {},
      create: { userId: superAdmin.id, organisationId: org.id, role: "SUPER_ADMIN" },
    });
  }

  // ── Buildings ─────────────────────────────────────────────────────────────
  for (const bDef of BUILDINGS) {
    console.log(`\n${"─".repeat(60)}`);
    console.log(`Building: ${bDef.name}`);
    console.log("─".repeat(60));

    // Building
    let building = await db.building.findFirst({
      where: { name: bDef.name, organisationId: org.id },
    });
    if (!building) {
      building = await db.building.create({
        data: {
          organisationId: org.id,
          name:           bDef.name,
          address:        bDef.address,
          suburb:         bDef.suburb,
          state:          bDef.state,
          postcode:       bDef.postcode,
          totalFloors:    bDef.totalFloors,
          totalUnits:     bDef.totalUnits,
          strataSchemeNo: bDef.schemeNo,
        },
      });
    }
    console.log(`  ✓ Building (${building.id})`);

    // Floors
    const floorIdByNumber: Record<number, string> = {};
    for (let f = 1; f <= bDef.totalFloors; f++) {
      const floor = await db.floor.upsert({
        where:  { buildingId_number: { buildingId: building.id, number: f } },
        update: {},
        create: { buildingId: building.id, number: f, label: `Level ${f}` },
      });
      floorIdByNumber[f] = floor.id;
    }
    console.log(`  ✓ ${bDef.totalFloors} floors`);

    // Units — 4 per floor, numbered <floor>0<slot> e.g. 101–104, 201–204
    const unitIds: string[] = [];
    for (let f = 1; f <= bDef.totalFloors; f++) {
      for (let slot = 1; slot <= 4; slot++) {
        const unitNumber = `${f}0${slot}`;
        const topFloor   = f === bDef.totalFloors;
        const unitType   = topFloor && slot <= 2 ? "PENTHOUSE" : slot === 4 ? "STUDIO" : "APARTMENT";
        const bedrooms   = unitType === "PENTHOUSE" ? 3 : unitType === "STUDIO" ? 1 : 2;
        const sqm        = unitType === "PENTHOUSE" ? 180 : unitType === "STUDIO" ? 45 : 85;

        const existing = await db.unit.findUnique({
          where: { buildingId_unitNumber: { buildingId: building.id, unitNumber } },
        });
        const unit = existing ?? await db.unit.create({
          data: {
            buildingId:    building.id,
            floorId:       floorIdByNumber[f],
            unitNumber,
            unitType,
            bedrooms,
            bathrooms:     unitType === "PENTHOUSE" ? 2 : 1,
            parkingSpaces: unitType === "PENTHOUSE" ? 2 : 1,
            storageSpaces: 1,
            squareMetres:  sqm,
          },
        });
        unitIds.push(unit.id);
      }
    }
    console.log(`  ✓ ${unitIds.length} units`);

    // StrataInfo
    const strataInfo = await db.strataInfo.upsert({
      where:  { buildingId: building.id },
      update: {},
      create: {
        buildingId:          building.id,
        strataPlanNumber:    bDef.schemeNo,
        strataManagerName:   `${bDef.manager.firstName} ${bDef.manager.lastName}`,
        strataManagerEmail:  `${bDef.manager.email}${DEMO_SUFFIX}`,
        adminFundBalance:    12_500_000,  // $125,000 in cents
        capitalWorksBalance: 48_000_000,  // $480,000 in cents
        nextAgmDate:         futureDate(90),
      },
    });

    // Strata bylaws
    const bylawData = [
      { bylawNumber: 1, title: "Noise and Nuisance",       content: "Residents must not create noise that unreasonably interferes with others' enjoyment of their lot between 10pm and 7am on weekdays, or 10pm and 8am on weekends.", effectiveDate: pastDate(365) },
      { bylawNumber: 2, title: "Parking",                  content: "Residents may only park in their designated parking spaces. Visitor parking is limited to 4 hours and must not obstruct other vehicles.",                         effectiveDate: pastDate(365) },
      { bylawNumber: 3, title: "Pets",                     content: "Residents wishing to keep a pet must obtain prior written approval from the owners corporation. Approval may be subject to conditions.",                          effectiveDate: pastDate(180) },
      { bylawNumber: 4, title: "Use of Common Property",   content: "Common areas must be kept clean and tidy. Residents are responsible for cleaning up after use of BBQ facilities and common rooms.",                              effectiveDate: pastDate(365) },
      { bylawNumber: 5, title: "Renovations and Alterations", content: "Any structural alterations to a lot require prior written approval. Residents must provide plans and ensure work complies with all relevant legislation.",   effectiveDate: pastDate(365) },
    ];
    for (const bylaw of bylawData) {
      const existing = await db.strataBylaw.findFirst({
        where: { strataInfoId: strataInfo.id, bylawNumber: bylaw.bylawNumber },
      });
      if (!existing) {
        await db.strataBylaw.create({
          data: { strataInfoId: strataInfo.id, ...bylaw },
        });
      }
    }

    // Common areas
    for (const ca of bDef.commonAreas) {
      const existing = await db.commonArea.findFirst({
        where: { buildingId: building.id, name: ca.name },
      });
      if (!existing) {
        await db.commonArea.create({ data: { buildingId: building.id, ...ca } });
      }
    }
    console.log(`  ✓ ${bDef.commonAreas.length} common areas + strata info`);

    // ── Building Manager ────────────────────────────────────────────────────
    process.stdout.write(`  → Manager (${bDef.manager.firstName} ${bDef.manager.lastName})… `);
    const mgrAuthId = await getOrCreateSupabaseUser(bDef.manager.email);
    const mgrUser   = await getOrCreatePrismaUser(mgrAuthId, bDef.manager.email, bDef.manager.firstName, bDef.manager.lastName);
    await db.organisationMembership.upsert({
      where:  { userId_organisationId: { userId: mgrUser.id, organisationId: org.id } },
      update: {},
      create: { userId: mgrUser.id, organisationId: org.id, role: "BUILDING_MANAGER" },
    });
    const mgrBa = await db.buildingAssignment.findFirst({
      where: { userId: mgrUser.id, buildingId: building.id, role: "BUILDING_MANAGER" },
    });
    if (!mgrBa) {
      await db.buildingAssignment.create({
        data: { userId: mgrUser.id, buildingId: building.id, role: "BUILDING_MANAGER" },
      });
    }
    console.log("✓");

    // ── Reception ───────────────────────────────────────────────────────────
    process.stdout.write(`  → Reception (${bDef.reception.firstName} ${bDef.reception.lastName})… `);
    const recAuthId = await getOrCreateSupabaseUser(bDef.reception.email);
    const recUser   = await getOrCreatePrismaUser(recAuthId, bDef.reception.email, bDef.reception.firstName, bDef.reception.lastName);
    await db.organisationMembership.upsert({
      where:  { userId_organisationId: { userId: recUser.id, organisationId: org.id } },
      update: {},
      create: { userId: recUser.id, organisationId: org.id, role: "RECEPTION" },
    });
    const recBa = await db.buildingAssignment.findFirst({
      where: { userId: recUser.id, buildingId: building.id, role: "RECEPTION" },
    });
    if (!recBa) {
      await db.buildingAssignment.create({
        data: { userId: recUser.id, buildingId: building.id, role: "RECEPTION" },
      });
    }
    console.log("✓");

    // ── Owners (units 0–9) ───────────────────────────────────────────────────
    console.log(`  → Creating ${bDef.owners.length} owners…`);
    const ownerUsers = [];
    for (let i = 0; i < bDef.owners.length; i++) {
      const o           = bDef.owners[i]!;
      const emailPrefix = `${bDef.key}.owner${i + 1}`;
      const authId      = await getOrCreateSupabaseUser(emailPrefix);
      const user        = await getOrCreatePrismaUser(authId, emailPrefix, o.firstName, o.lastName);

      await db.organisationMembership.upsert({
        where:  { userId_organisationId: { userId: user.id, organisationId: org.id } },
        update: {},
        create: { userId: user.id, organisationId: org.id, role: "OWNER" },
      });
      const ba = await db.buildingAssignment.findFirst({
        where: { userId: user.id, buildingId: building.id, role: "OWNER" },
      });
      if (!ba) {
        await db.buildingAssignment.create({
          data: { userId: user.id, buildingId: building.id, role: "OWNER" },
        });
      }

      const unitId = unitIds[i]!;
      await db.ownership.upsert({
        where:  { userId_unitId: { userId: user.id, unitId } },
        update: {},
        create: {
          userId: user.id,
          unitId,
          purchaseDate: pastDate(Math.floor(Math.random() * 1000) + 365),
          isActive:     true,
        },
      });
      await db.unit.update({ where: { id: unitId }, data: { isOccupied: true } });

      // Strata levy for this owner's unit
      const existingLevy = await db.strataLevy.findFirst({
        where: { strataInfoId: strataInfo.id, unitId },
      });
      if (!existingLevy) {
        await db.strataLevy.create({
          data: {
            strataInfoId: strataInfo.id,
            unitId,
            levyType:     pick(["ADMIN_FUND", "CAPITAL_WORKS"] as const),
            amountCents:  pick([85_000, 120_000, 150_000, 180_000]),
            quarterStart: pastDate(30),
            dueDate:      futureDate(60),
            status:       pick(["PENDING", "PAID", "OVERDUE"] as const),
          },
        });
      }

      ownerUsers.push(user);
      process.stdout.write(".");
    }
    console.log(` ✓`);

    // ── Tenants ───────────────────────────────────────────────────────────────
    //
    // Unit layout:
    //   unitIds[0–4]   → owner-occupied   (Ownership only, no tenant)
    //   unitIds[5–9]   → investor-owned   (Ownership + Tenancy on same unit)
    //   unitIds[10–14] → tenant-only      (Tenancy only, no owner in system)
    //   unitIds[15+]   → vacant
    //
    // Tenants 0–4 share the unit with owners 5–9 (investor scenario).
    // Tenants 5–9 occupy units 10–14 (no associated owner).
    console.log(`  → Creating ${bDef.tenants.length} tenants…`);
    const tenantUsers = [];
    for (let i = 0; i < bDef.tenants.length; i++) {
      const t           = bDef.tenants[i]!;
      const emailPrefix = `${bDef.key}.tenant${i + 1}`;
      const authId      = await getOrCreateSupabaseUser(emailPrefix);
      const user        = await getOrCreatePrismaUser(authId, emailPrefix, t.firstName, t.lastName);

      await db.organisationMembership.upsert({
        where:  { userId_organisationId: { userId: user.id, organisationId: org.id } },
        update: {},
        create: { userId: user.id, organisationId: org.id, role: "TENANT" },
      });
      const ba = await db.buildingAssignment.findFirst({
        where: { userId: user.id, buildingId: building.id, role: "TENANT" },
      });
      if (!ba) {
        await db.buildingAssignment.create({
          data: { userId: user.id, buildingId: building.id, role: "TENANT" },
        });
      }

      const unitId       = unitIds[5 + i]!;  // 0–4: shared with owner; 5–9: tenant-only unit
      const leaseStart   = pastDate(Math.floor(Math.random() * 365) + 30);
      const leaseEnd     = futureDate(Math.floor(Math.random() * 365) + 180);
      const rentCents    = pick([180_000, 220_000, 250_000, 280_000, 320_000]);

      const existingTenancy = await db.tenancy.findFirst({ where: { userId: user.id, unitId } });
      if (!existingTenancy) {
        await db.tenancy.create({
          data: {
            userId: user.id,
            unitId,
            leaseStartDate:  leaseStart,
            leaseEndDate:    leaseEnd,
            rentAmountCents: rentCents,
            rentFrequency:   "MONTHLY",
            bondAmountCents: rentCents * 4,
            moveInDate:      leaseStart,
            isActive:        true,
          },
        });
        await db.unit.update({ where: { id: unitId }, data: { isOccupied: true } });
      }

      tenantUsers.push(user);
      process.stdout.write(".");
    }
    console.log(` ✓`);

    // ── Activity Data ─────────────────────────────────────────────────────────

    // Maintenance requests
    const maintenanceItems = [
      { title: "Leaking tap in bathroom",       category: "PLUMBING"     as const, priority: "MEDIUM" as const, status: "IN_PROGRESS"  as const },
      { title: "Air conditioning not working",  category: "HVAC"         as const, priority: "HIGH"   as const, status: "SUBMITTED"    as const },
      { title: "Light flickering in hallway",   category: "ELECTRICAL"   as const, priority: "LOW"    as const, status: "COMPLETED"    as const },
      { title: "Pest control required",         category: "PEST_CONTROL" as const, priority: "HIGH"   as const, status: "ACKNOWLEDGED" as const },
      { title: "Broken window latch",           category: "STRUCTURAL"   as const, priority: "MEDIUM" as const, status: "SUBMITTED"    as const },
      { title: "Garage door not responding",    category: "SECURITY"     as const, priority: "URGENT" as const, status: "IN_PROGRESS"  as const },
    ];
    for (let i = 0; i < maintenanceItems.length; i++) {
      const m        = maintenanceItems[i]!;
      const unitId   = unitIds[i % unitIds.length]!;
      const reporter = pick([...ownerUsers, ...tenantUsers]);
      const existing = await db.maintenanceRequest.findFirst({
        where: { unitId, title: m.title },
      });
      if (!existing) {
        await db.maintenanceRequest.create({
          data: {
            unitId,
            requestedById: reporter.id,
            title:         m.title,
            description:   "Issue reported by resident. Requires prompt attention.",
            category:      m.category,
            priority:      m.priority,
            status:        m.status,
            completedDate: m.status === "COMPLETED" ? pastDate(5) : null,
          },
        });
      }
    }

    // Parcels
    const parcelItems = [
      { name: `${bDef.owners[0]!.firstName} ${bDef.owners[0]!.lastName}`, carrier: "Australia Post", status: "RECEIVED"  as const, unitNum: `101` },
      { name: `${bDef.tenants[0]!.firstName} ${bDef.tenants[0]!.lastName}`, carrier: "DHL",          status: "NOTIFIED"  as const, unitNum: `201` },
      { name: `${bDef.owners[1]!.firstName} ${bDef.owners[1]!.lastName}`, carrier: "FedEx",          status: "COLLECTED" as const, unitNum: `102` },
      { name: `${bDef.tenants[1]!.firstName} ${bDef.tenants[1]!.lastName}`, carrier: "Toll",         status: "RECEIVED"  as const, unitNum: `202` },
      { name: `${bDef.owners[2]!.firstName} ${bDef.owners[2]!.lastName}`, carrier: "StarTrack",      status: "NOTIFIED"  as const, unitNum: `103` },
    ];
    for (const p of parcelItems) {
      const existing = await db.parcel.findFirst({
        where: { buildingId: building.id, recipientName: p.name },
      });
      if (!existing) {
        await db.parcel.create({
          data: {
            buildingId:    building.id,
            unitNumber:    p.unitNum,
            loggedById:    recUser.id,
            recipientName: p.name,
            carrier:       p.carrier,
            status:        p.status,
            loggedAt:      pastDate(Math.floor(Math.random() * 14) + 1),
            collectedAt:   p.status === "COLLECTED" ? pastDate(1) : null,
            collectedBy:   p.status === "COLLECTED" ? p.name : null,
          },
        });
      }
    }

    // Announcements
    const announcementItems = [
      {
        title:   "Welcome to the Building",
        content: "We're excited to welcome all new and existing residents. Please review the building rules in the Documents section, and don't hesitate to contact reception if you need assistance.",
        priority: "MEDIUM" as const,
        daysAgo: 20,
      },
      {
        title:   "Scheduled Maintenance — Lift",
        content: "The building lift will undergo scheduled maintenance this Saturday from 8am to 2pm. Please use the stairwell during this period. We apologise for any inconvenience.",
        priority: "HIGH" as const,
        daysAgo: 7,
      },
      {
        title:   "Annual General Meeting Notice",
        content: "The Annual General Meeting is scheduled for next month. All owners are encouraged to attend. A formal agenda will be distributed via email 21 days prior to the meeting.",
        priority: "MEDIUM" as const,
        daysAgo: 3,
      },
    ];
    for (const a of announcementItems) {
      const existing = await db.announcement.findFirst({
        where: { buildingId: building.id, title: a.title },
      });
      if (!existing) {
        await db.announcement.create({
          data: {
            buildingId:  building.id,
            authorId:    mgrUser.id,
            title:       a.title,
            content:     a.content,
            priority:    a.priority,
            scope:       "BUILDING",
            publishedAt: pastDate(a.daysAgo),
            expiresAt:   futureDate(60 - a.daysAgo),
          },
        });
      }
    }

    console.log(`  ✓ Activity data (maintenance, parcels, announcements, levies)`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────
  const line = "═".repeat(58);
  console.log(`
╔${line}╗
║${"  Demo seed complete! 🎉".padEnd(58)}║
╠${line}╣
║${"  Password for ALL accounts: Demo1234!".padEnd(58)}║
╠${line}╣
║${"  Building 1 — Harbour View Apartments (Sydney)".padEnd(58)}║
║${"    Manager:   hv.manager@demo.test".padEnd(58)}║
║${"    Reception: hv.reception@demo.test".padEnd(58)}║
║${"    Owners:    hv.owner1–10@demo.test".padEnd(58)}║
║${"    Tenants:   hv.tenant1–10@demo.test".padEnd(58)}║
╠${line}╣
║${"  Building 2 — Parkside Residences (Melbourne)".padEnd(58)}║
║${"    Manager:   ps.manager@demo.test".padEnd(58)}║
║${"    Reception: ps.reception@demo.test".padEnd(58)}║
║${"    Owners:    ps.owner1–10@demo.test".padEnd(58)}║
║${"    Tenants:   ps.tenant1–10@demo.test".padEnd(58)}║
╠${line}╣
║${"  Building 3 — The Meridian (Brisbane)".padEnd(58)}║
║${"    Manager:   tm.manager@demo.test".padEnd(58)}║
║${"    Reception: tm.reception@demo.test".padEnd(58)}║
║${"    Owners:    tm.owner1–10@demo.test".padEnd(58)}║
║${"    Tenants:   tm.tenant1–10@demo.test".padEnd(58)}║
╚${line}╝`);
}

main()
  .catch((e) => { console.error("\n❌ Demo seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
