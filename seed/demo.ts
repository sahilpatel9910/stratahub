/**
 * StrataHub — Full Demo Seed (v2, production-readiness rebuild)
 *
 * Goal: every number that lands on a dashboard is accurate, internally
 * consistent, and CURRENT relative to "now" (dates are offsets from `NOW`,
 * never hard-coded years — so the demo never goes stale).
 *
 * See docs/production-readiness.md §3 for the canonical data model.
 *
 * Highlights:
 *   • 1 org (Harbour Strata Pty Ltd) managing 2 buildings (B1 30 units, B2 18 units).
 *   • ~80% occupancy per building (owner-occupied + tenanted + a few vacant).
 *   • Unit entitlements sum to 1000 per building → levies apportioned by entitlement.
 *   • Mixed rent frequencies (weekly/fortnightly/monthly); NSW bond = 4 weeks + BondRecord.
 *   • Realistic rent schedule: past PAID, current/future PENDING, a few OVERDUE
 *     (collection ≈ 94%); "rent collected this month" is a real figure.
 *   • Quarterly strata levies (4 quarters) by entitlement; financial ledger (12 months);
 *     custom bills, bond records, inspections, visitors, keys, documents, bookings.
 *   • Only documented demo accounts get Supabase Auth logins; all other residents are
 *     DB-only users (supabaseAuthId = null) so the data is realistic without dozens of logins.
 *
 * Run:  npm run db:seed:demo   (after npm run db:seed:wipe)
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  BOND_LODGEMENT_AUTHORITIES,
  BOND_LODGEMENT_DEADLINES_DAYS,
} from "../src/lib/constants";

// ── Clients ─────────────────────────────────────────────────────────────────
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const PASSWORD = "Demo1234!";
const SUPER_ADMIN_EMAIL = "admin@stratahub.com.au";
const NOW = new Date();

// ── Date helpers (all data is relative to NOW) ───────────────────────────────
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const addMonths = (d: Date, n: number) => { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; };
const monthsAgo = (n: number) => addMonths(NOW, -n);
const daysAgo = (n: number) => addDays(NOW, -n);
function addBusinessDays(d: Date, n: number) {
  const x = new Date(d);
  let added = 0;
  while (added < n) {
    x.setDate(x.getDate() + 1);
    const day = x.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return x;
}
function startOfQuarter(d: Date) {
  const q = Math.floor(d.getMonth() / 3);
  return new Date(d.getFullYear(), q * 3, 1);
}
const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);

// ── Money helpers (cents) ────────────────────────────────────────────────────
const dollars = (n: number) => Math.round(n * 100);
type Freq = "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
/** Convert a weekly rent (cents) into the amount charged each period. */
function rentForFrequency(weeklyCents: number, freq: Freq): number {
  if (freq === "WEEKLY") return weeklyCents;
  if (freq === "FORTNIGHTLY") return weeklyCents * 2;
  return Math.round((weeklyCents * 52) / 12); // MONTHLY
}
/** NSW bond = 4 weeks rent. */
const bondCents = (weeklyCents: number) => weeklyCents * 4;

// ── Deterministic "people" pool (DB-only residents) ──────────────────────────
const FIRST = ["Olivia","Liam","Charlotte","Noah","Amelia","Jack","Mia","William","Ava","Henry","Grace","Oliver","Isla","Thomas","Chloe","Lucas","Sophia","Ethan","Ruby","Mason","Zoe","Leo","Ella","Hugo","Ivy","Max","Lily","Felix","Alice","Sam","Hannah","Toby","Maya","Jasper","Ada","Cooper","Nina","Riley","Eve","Dylan"];
const LAST = ["Nguyen","Smith","Patel","Kim","Brown","Wong","Singh","Taylor","Chen","Walsh","Reid","Sharma","Park","Santos","Okafor","Kovacs","Yuen","Brennan","Murphy","Lopez","Tran","Clarke","Ahmed","Rossi","Ivanov","Hughes","Costa","Fischer","Mehta","Doyle","Bauer","Lim","Novak","Frost","Beck","Cruz","Dunn","Ford","Gill","Hale"];
let poolIdx = 0;
function nextPerson(): { firstName: string; lastName: string; email: string } {
  const first = FIRST[poolIdx % FIRST.length];
  const last = LAST[(poolIdx * 7 + 3) % LAST.length];
  const email = `${first}.${last}.${poolIdx}@residents.demo`.toLowerCase();
  poolIdx++;
  return { firstName: first, lastName: last, email };
}

// ── Auth + DB user helpers ────────────────────────────────────────────────────
async function upsertAuthUser(email: string, firstName: string, lastName: string) {
  const { data: list } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;
  const { data, error } = await supabase.auth.admin.createUser({
    email, password: PASSWORD, email_confirm: true, user_metadata: { firstName, lastName },
  });
  if (error) throw new Error(`Auth error for ${email}: ${error.message}`);
  return data.user.id;
}
async function createAuthUser(email: string, firstName: string, lastName: string) {
  const authId = await upsertAuthUser(email, firstName, lastName);
  return db.user.upsert({
    where: { supabaseAuthId: authId },
    update: { email, firstName, lastName },
    create: { supabaseAuthId: authId, email, firstName, lastName },
  });
}
async function createDbUser(p: { firstName: string; lastName: string; email: string; phone?: string }) {
  return db.user.upsert({
    where: { email: p.email },
    update: { firstName: p.firstName, lastName: p.lastName },
    create: { email: p.email, firstName: p.firstName, lastName: p.lastName, phone: p.phone ?? null },
  });
}

// ── Building blueprint ────────────────────────────────────────────────────────
// Per floor: pos1 = 1-bed, pos2 = 2-bed, pos3 = 3-bed.
type BedType = 1 | 2 | 3;
const ENTITLEMENT: Record<BedType, number> = { 1: 25, 2: 35, 3: 40 }; // sums to 100/floor
const WEEKLY_RENT: Record<BedType, number> = { 1: dollars(720), 2: dollars(920), 3: dollars(1250) };
const SQM: Record<BedType, number> = { 1: 58, 2: 82, 3: 110 };
const FREQS: Freq[] = ["WEEKLY", "FORTNIGHTLY", "MONTHLY"];

const BUILDINGS = [
  { key: "B1", name: "Harbour View Apartments", address: "1 Macquarie Street", suburb: "Sydney", state: "NSW" as const, postcode: "2000", floors: 10, scheme: "SP12345",
    strataManager: { name: "City Strata Management", email: "manage@citystrata.com.au", phone: "02 9000 1234" },
    occOwner: 10, occTenant: 14 /* rest vacant of 30 */ },
  { key: "B2", name: "Parkline Residences", address: "88 Walker Street", suburb: "North Sydney", state: "NSW" as const, postcode: "2060", floors: 6, scheme: "SP67890",
    strataManager: { name: "Northside Strata Co", email: "hello@northsidestrata.com.au", phone: "02 9955 4321" },
    occOwner: 6, occTenant: 8 /* rest vacant of 18 */ },
];

const RENT_METHODS = ["Bank Transfer", "Stripe", "BPAY", "Direct Debit"];

async function main() {
  console.log("🌱  StrataHub demo seed v2 — anchor date", NOW.toISOString().slice(0, 10), "\n");

  // ── 1. Organisation ─────────────────────────────────────────────────────────
  const org =
    (await db.organisation.findFirst({ where: { name: "Harbour Strata Pty Ltd" } })) ??
    (await db.organisation.create({ data: { name: "Harbour Strata Pty Ltd", abn: "51 824 753 556", state: "NSW" } }));
  console.log("✓ Organisation:", org.name);

  // ── 2. Staff (auth logins) ────────────────────────────────────────────────────
  const manager = await createAuthUser("manager@demo.com", "Sarah", "Mitchell");
  const reception = await createAuthUser("reception@demo.com", "James", "Torres");

  // Link super-admin (created by `npm run db:seed`) to this org + buildings, if present.
  const superAdmin = await db.user.findUnique({ where: { email: SUPER_ADMIN_EMAIL } });
  if (superAdmin) {
    await db.user.update({ where: { id: superAdmin.id }, data: { isSuperAdmin: true } });
    await db.organisationMembership.upsert({
      where: { userId_organisationId: { userId: superAdmin.id, organisationId: org.id } },
      update: { role: "SUPER_ADMIN" }, create: { userId: superAdmin.id, organisationId: org.id, role: "SUPER_ADMIN" },
    });
  } else {
    console.log("  ℹ️  super-admin not found — run `npm run db:seed` first for full SA access.");
  }

  // Demo owner/tenant auth accounts (owner1–5, tenant1–5) — assigned to B1 below.
  const demoOwnerNames = [["Emily","Chen"],["Michael","Patel"],["Sophie","Williams"],["Liam","Johnson"],["Olivia","Brown"]];
  const demoTenantNames = [["Noah","Davis"],["Ava","Wilson"],["Ethan","Moore"],["Isabella","Taylor"],["Mason","Anderson"]];
  const demoOwners = [];
  for (let i = 0; i < 5; i++) demoOwners.push(await createAuthUser(`owner${i + 1}@demo.com`, demoOwnerNames[i][0], demoOwnerNames[i][1]));
  const demoTenants = [];
  for (let i = 0; i < 5; i++) demoTenants.push(await createAuthUser(`tenant${i + 1}@demo.com`, demoTenantNames[i][0], demoTenantNames[i][1]));
  console.log("✓ Auth users: manager, reception, owner1–5, tenant1–5");

  // Org membership + (manager → both buildings, reception → B1) added after buildings exist.

  // ── 3. Per-building build ─────────────────────────────────────────────────────
  // Accumulators for cross-building items (notifications etc.)
  const buildingIds: string[] = [];
  let tenantSeq = 0;     // global tenant counter (controls frequency + late-payer)
  const allLeaseDocs: { tenancyId: string; uploadedById: string; buildingId: string; title: string }[] = [];

  for (const B of BUILDINGS) {
    console.log(`\n=== ${B.name} ===`);
    const building = await db.building.create({
      data: {
        organisationId: org.id, name: B.name, address: B.address, suburb: B.suburb,
        state: B.state, postcode: B.postcode, totalFloors: B.floors, totalUnits: B.floors * 3, strataSchemeNo: B.scheme,
      },
    });
    buildingIds.push(building.id);

    // Staff assignments: manager → every building; reception → B1 only.
    await db.buildingAssignment.create({ data: { userId: manager.id, buildingId: building.id, role: "BUILDING_MANAGER" } });
    if (B.key === "B1") await db.buildingAssignment.create({ data: { userId: reception.id, buildingId: building.id, role: "RECEPTION" } });
    if (superAdmin) await db.buildingAssignment.create({ data: { userId: superAdmin.id, buildingId: building.id, role: "SUPER_ADMIN" } });

    // Floors + units (entitlements sum to 100/floor → 1000 (B1) etc.)
    const floors: Record<number, string> = {};
    type UnitRec = { id: string; unitNumber: string; bed: BedType; floor: number };
    const unitList: UnitRec[] = [];
    for (let f = 1; f <= B.floors; f++) {
      const floor = await db.floor.create({ data: { buildingId: building.id, number: f, label: `Level ${f}` } });
      floors[f] = floor.id;
      for (let pos = 1; pos <= 3; pos++) {
        const bed = pos as BedType;
        const unitNumber = `${f}0${pos}`;
        const u = await db.unit.create({
          data: {
            buildingId: building.id, floorId: floor.id, unitNumber, unitType: "APARTMENT",
            bedrooms: bed, bathrooms: bed === 3 ? 2 : 1, squareMetres: SQM[bed],
            parkingSpaces: bed >= 2 ? 1 : 0, storageSpaces: bed === 3 ? 1 : 0,
            lotNumber: String(unitList.length + 1), unitEntitlement: ENTITLEMENT[bed], isOccupied: false,
          },
        });
        unitList.push({ id: u.id, unitNumber, bed, floor: f });
      }
    }
    const totalEntitlement = unitList.reduce((s, u) => s + ENTITLEMENT[u.bed], 0);
    console.log(`  ✓ ${unitList.length} units (entitlement total ${totalEntitlement})`);

    // Allocation: first occOwner = owner-occupied, next occTenant = tenanted, rest vacant.
    const ownerOccupied = unitList.slice(0, B.occOwner);
    const tenanted = unitList.slice(B.occOwner, B.occOwner + B.occTenant);
    // vacant = the remainder (still owned by an investor)

    // Helper to attach a unit to an owner (creates membership/assignment/ownership).
    async function attachOwner(userId: string, unitId: string) {
      await db.organisationMembership.upsert({
        where: { userId_organisationId: { userId, organisationId: org.id } }, update: {},
        create: { userId, organisationId: org.id, role: "OWNER" },
      });
      await db.buildingAssignment.upsert({
        where: { userId_buildingId_role: { userId, buildingId: building.id, role: "OWNER" } }, update: {},
        create: { userId, buildingId: building.id, role: "OWNER", isActive: true },
      });
      await db.ownership.create({
        data: { userId, unitId, purchaseDate: monthsAgo(18 + (poolIdx % 24)), isActive: true, isPrimary: true, ownershipPct: 100 },
      });
    }

    // 3a. Owner-occupied units — each has a distinct resident owner.
    for (let i = 0; i < ownerOccupied.length; i++) {
      const u = ownerOccupied[i];
      // demo owner1–3 occupy the first three B1 owner-occupied units
      const owner = B.key === "B1" && i < 3 ? demoOwners[i] : await createDbUser(nextPerson());
      await attachOwner(owner.id, u.id);
      await db.unit.update({ where: { id: u.id }, data: { isOccupied: true } });
    }

    // 3b. Tenanted units — a landlord owner + a tenant in residence.
    // Landlords: reuse a small pool (investors own several). demo owner4,5 landlord first two B1.
    const landlordPool: string[] = [];
    for (let i = 0; i < Math.ceil(tenanted.length / 2); i++) landlordPool.push((await createDbUser(nextPerson())).id);
    for (let i = 0; i < tenanted.length; i++) {
      const u = tenanted[i];
      const landlordId = B.key === "B1" && i < 2 ? demoOwners[3 + i].id : landlordPool[i % landlordPool.length];
      await attachOwner(landlordId, u.id);

      // Tenant
      const tenant = B.key === "B1" && i < 5 ? demoTenants[i] : await createDbUser(nextPerson());
      await db.organisationMembership.upsert({
        where: { userId_organisationId: { userId: tenant.id, organisationId: org.id } }, update: {},
        create: { userId: tenant.id, organisationId: org.id, role: "TENANT" },
      });
      await db.buildingAssignment.upsert({
        where: { userId_buildingId_role: { userId: tenant.id, buildingId: building.id, role: "TENANT" } }, update: {},
        create: { userId: tenant.id, buildingId: building.id, role: "TENANT", isActive: true },
      });

      // Lease terms (staggered, all spanning now; some near expiry)
      const freq = FREQS[tenantSeq % 3];
      const weekly = WEEKLY_RENT[u.bed];
      const rentAmt = rentForFrequency(weekly, freq);
      const bond = bondCents(weekly);
      const leaseStart = monthsAgo(4 + (tenantSeq % 8));    // 4–11 months ago (always has paid history)
      leaseStart.setHours(0, 0, 0, 0);                       // anchor to midnight so no due-date lands exactly on "now"
      const leaseEnd = addMonths(leaseStart, 12);            // 1–8 months in future (incl. one near-expiry)
      const isLatePayer = tenantSeq % 7 === 3;               // ~1 in 7 has arrears (never the first demo tenant)

      const tenancy = await db.tenancy.create({
        data: {
          userId: tenant.id, unitId: u.id, leaseStartDate: leaseStart, leaseEndDate: leaseEnd,
          rentAmountCents: rentAmt, rentFrequency: freq, bondAmountCents: bond, bondStatus: "LODGED",
          bondReference: `RB-${B.key}-${String(tenantSeq + 1).padStart(4, "0")}`,
          moveInDate: leaseStart, isActive: true,
        },
      });
      await db.unit.update({ where: { id: u.id }, data: { isOccupied: true } });

      // Bond record (state rules from constants)
      await db.bondRecord.create({
        data: {
          tenancyId: tenancy.id, amountCents: bond, lodgementDate: addBusinessDays(leaseStart, 3),
          lodgementAuthority: BOND_LODGEMENT_AUTHORITIES[B.state], referenceNumber: tenancy.bondReference,
          status: "LODGED", state: B.state,
          lodgementDeadline: addBusinessDays(leaseStart, BOND_LODGEMENT_DEADLINES_DAYS[B.state]),
          notes: "Lodged with the bond authority via Rental Bonds Online.",
        },
      });

      // Rent schedule with realistic statuses
      const step = freq === "WEEKLY" ? 7 : freq === "FORTNIGHTLY" ? 14 : 0; // 0 = monthly handled by addMonths
      const payments: { tenancyId: string; amountCents: number; dueDate: Date; paidDate: Date | null; status: "PAID" | "PENDING" | "OVERDUE"; paymentMethod: string | null }[] = [];
      let i2 = 0;
      while (true) {
        const due = step ? addDays(leaseStart, i2 * step) : addMonths(leaseStart, i2);
        if (due >= leaseEnd) break;
        i2++;
        let status: "PAID" | "PENDING" | "OVERDUE";
        let paidDate: Date | null = null;
        let method: string | null = null;
        if (due >= NOW) {
          status = "PENDING";
        } else if (isLatePayer && due >= daysAgo(35)) {
          status = "OVERDUE"; // recent unpaid arrears
        } else {
          status = "PAID";
          paidDate = addDays(due, tenantSeq % 3);          // paid on/around due date
          if (paidDate > NOW) paidDate = due;
          method = RENT_METHODS[(tenantSeq + i2) % RENT_METHODS.length];
        }
        payments.push({ tenancyId: tenancy.id, amountCents: rentAmt, dueDate: due, paidDate, status, paymentMethod: method });
        if (i2 > 60) break; // safety
      }
      await db.rentPayment.createMany({ data: payments });

      // A lease-agreement document per tenancy (storage path is a placeholder)
      allLeaseDocs.push({ tenancyId: tenancy.id, uploadedById: manager.id, buildingId: building.id, title: `Lease Agreement — Unit ${u.unitNumber}` });

      tenantSeq++;
    }

    // 3c. Vacant units — investor owners (reuse a couple of multi-unit investors).
    const vacant = unitList.slice(B.occOwner + B.occTenant);
    let investorId: string | null = null;
    for (let i = 0; i < vacant.length; i++) {
      if (i % 2 === 0) investorId = (await createDbUser(nextPerson())).id; // each investor owns ~2
      await attachOwner(investorId!, vacant[i].id);
    }
    const occupiedCount = ownerOccupied.length + tenanted.length;
    console.log(`  ✓ occupancy ${occupiedCount}/${unitList.length} (${Math.round((occupiedCount / unitList.length) * 100)}%)`);

    // Parking + storage records to match unit counts (occupied units only, to bound volume)
    for (const u of [...ownerOccupied, ...tenanted]) {
      if (u.bed >= 2) await db.parkingSpot.create({ data: { unitId: u.id, label: `P-${u.unitNumber}`, level: "B1" } });
      if (u.bed === 3) await db.storageUnit.create({ data: { unitId: u.id, label: `S-${u.unitNumber}` } });
    }

    // ── Strata info + quarterly levies (by entitlement) + bylaws + meetings ─────
    const strata = await db.strataInfo.create({
      data: {
        buildingId: building.id, strataPlanNumber: B.scheme,
        strataManagerName: B.strataManager.name, strataManagerEmail: B.strataManager.email, strataManagerPhone: B.strataManager.phone,
        adminFundBalance: dollars(185000), capitalWorksBalance: dollars(520000),
        insurancePolicyNo: `POL-${B.scheme}-${NOW.getFullYear()}`, insuranceExpiry: addMonths(NOW, 8), nextAgmDate: addMonths(NOW, 3),
      },
    });

    // Annual budget: admin $200k + capital works $120k → quarterly by entitlement/total.
    const Q_ADMIN = dollars(200000) / 4;
    const Q_CW = dollars(120000) / 4;
    const quarters = [3, 2, 1, 0].map((q) => addMonths(startOfQuarter(NOW), -3 * q)); // last 3 + current
    const levyRows: { strataInfoId: string; unitId: string; levyType: "ADMIN_FUND" | "CAPITAL_WORKS" | "SPECIAL_LEVY"; amountCents: number; quarterStart: Date; dueDate: Date; paidDate: Date | null; status: "PAID" | "PENDING" | "OVERDUE" }[] = [];
    for (let qi = 0; qi < quarters.length; qi++) {
      const qStart = quarters[qi];
      const due = addDays(qStart, 30);
      const isCurrent = qi === quarters.length - 1;
      for (let ui = 0; ui < unitList.length; ui++) {
        const u = unitList[ui];
        const share = ENTITLEMENT[u.bed] / totalEntitlement;
        const mkStatus = (): { status: "PAID" | "PENDING" | "OVERDUE"; paidDate: Date | null } => {
          if (!isCurrent) return { status: "PAID", paidDate: addDays(due, -2) };
          // current quarter: most paid, some pending, occasional overdue if due already passed
          if (ui % 4 === 0) return due < NOW ? { status: "OVERDUE", paidDate: null } : { status: "PENDING", paidDate: null };
          return due < NOW ? { status: "PAID", paidDate: addDays(due, -1) } : { status: "PENDING", paidDate: null };
        };
        const a = mkStatus();
        levyRows.push({ strataInfoId: strata.id, unitId: u.id, levyType: "ADMIN_FUND", amountCents: Math.round(Q_ADMIN * share), quarterStart: qStart, dueDate: due, paidDate: a.paidDate, status: a.status });
        const c = mkStatus();
        levyRows.push({ strataInfoId: strata.id, unitId: u.id, levyType: "CAPITAL_WORKS", amountCents: Math.round(Q_CW * share), quarterStart: qStart, dueDate: due, paidDate: c.paidDate, status: c.status });
      }
    }
    // One special levy (façade repairs) last full quarter — apportioned by entitlement.
    const specialQ = quarters[quarters.length - 2];
    for (const u of unitList) {
      const share = ENTITLEMENT[u.bed] / totalEntitlement;
      levyRows.push({ strataInfoId: strata.id, unitId: u.id, levyType: "SPECIAL_LEVY", amountCents: Math.round(dollars(60000) * share), quarterStart: specialQ, dueDate: addDays(specialQ, 45), paidDate: addDays(specialQ, 40), status: "PAID" });
    }
    await db.strataLevy.createMany({ data: levyRows });
    console.log(`  ✓ ${levyRows.length} strata levies (by entitlement)`);

    const bylaws = [
      ["Pets", "Owners and tenants must obtain written approval from the owners corporation before keeping an animal on the lot. Approval will not be unreasonably withheld."],
      ["Noise", "Occupants must not create noise likely to interfere with the peaceful enjoyment of other residents, particularly between 10pm and 7am."],
      ["Parking", "Visitor parking is for visitors only and limited to 24 hours. Residents must use their allocated space."],
      ["Renovations", "Major renovations affecting common property or waterproofing require owners corporation approval and a licensed contractor."],
      ["Common Property", "Residents must not obstruct common property areas, foyers, fire stairs or corridors with personal items."],
    ];
    for (let i = 0; i < bylaws.length; i++) {
      await db.strataBylaw.create({ data: { strataInfoId: strata.id, title: bylaws[i][0], content: bylaws[i][1], bylawNumber: i + 1, effectiveDate: monthsAgo(24) } });
    }
    await db.strataMeeting.createMany({
      data: [
        { strataInfoId: strata.id, title: "Annual General Meeting", meetingDate: monthsAgo(9), location: "Meeting Room (Level 2)", notes: "Adopted annual budget and elected committee." },
        { strataInfoId: strata.id, title: "Committee Meeting — Q1", meetingDate: monthsAgo(3), location: "Meeting Room (Level 2)", notes: "Reviewed capital works program and façade tender." },
        { strataInfoId: strata.id, title: "Annual General Meeting", meetingDate: addMonths(NOW, 3), location: "Meeting Room (Level 2)", notes: "Upcoming AGM — agenda to be circulated." },
      ],
    });

    // ── Financial ledger: 12 months income + expenses ──────────────────────────
    const finRows: { buildingId: string; type: "INCOME" | "EXPENSE"; category: string; description: string; amountCents: number; date: Date }[] = [];
    const sizeFactor = unitList.length / 30; // scale B2 down
    for (let m = 11; m >= 0; m--) {
      const date = startOfMonth(monthsAgo(m));
      finRows.push({ buildingId: building.id, type: "INCOME", category: "Levy Income", description: "Quarterly levy receipts", amountCents: Math.round(dollars(26500) * sizeFactor), date });
      if (m % 3 === 0) finRows.push({ buildingId: building.id, type: "INCOME", category: "Interest", description: "Investment account interest", amountCents: Math.round(dollars(640) * sizeFactor), date });
      finRows.push({ buildingId: building.id, type: "EXPENSE", category: "Cleaning", description: "Common area cleaning", amountCents: Math.round(dollars(2200) * sizeFactor), date });
      finRows.push({ buildingId: building.id, type: "EXPENSE", category: "Gardening", description: "Landscaping & grounds", amountCents: Math.round(dollars(950) * sizeFactor), date });
      finRows.push({ buildingId: building.id, type: "EXPENSE", category: "Utilities", description: "Common area electricity & water", amountCents: Math.round(dollars(3100) * sizeFactor), date });
      finRows.push({ buildingId: building.id, type: "EXPENSE", category: "Lift Servicing", description: "Lift maintenance contract", amountCents: Math.round(dollars(1450) * sizeFactor), date });
      finRows.push({ buildingId: building.id, type: "EXPENSE", category: "Management Fee", description: "Strata management fee", amountCents: Math.round(dollars(1800) * sizeFactor), date });
      if (m % 4 === 0) finRows.push({ buildingId: building.id, type: "EXPENSE", category: "Insurance", description: "Building insurance premium", amountCents: Math.round(dollars(7400) * sizeFactor), date });
      if (m % 5 === 0) finRows.push({ buildingId: building.id, type: "EXPENSE", category: "Repairs", description: "Ad-hoc repairs & maintenance", amountCents: Math.round(dollars(2600) * sizeFactor), date });
    }
    await db.financialRecord.createMany({ data: finRows });
    console.log(`  ✓ ${finRows.length} financial records (12 months)`);

    // ── Common areas + a few bookings ───────────────────────────────────────────
    const areaDefs = B.key === "B1"
      ? [
          { name: "Rooftop BBQ Area", description: "Rooftop entertaining area with BBQ facilities", capacity: 30, bookingRequired: true, operatingHours: "7am–10pm", floor: B.floors },
          { name: "Gym", description: "Fully equipped gymnasium", capacity: 15, bookingRequired: false, operatingHours: "5am–11pm", floor: 1 },
          { name: "Pool & Spa", description: "Heated indoor pool and spa", capacity: 20, bookingRequired: true, operatingHours: "6am–9pm", floor: 1 },
          { name: "Meeting Room", description: "Private meeting room for residents", capacity: 10, bookingRequired: true, operatingHours: "8am–8pm", floor: 2 },
        ]
      : [
          { name: "Residents Lounge", description: "Shared lounge and co-working space", capacity: 12, bookingRequired: true, operatingHours: "7am–10pm", floor: 1 },
          { name: "Gym", description: "Cardio and weights studio", capacity: 10, bookingRequired: false, operatingHours: "5am–11pm", floor: 1 },
        ];
    const areas = [];
    for (const a of areaDefs) areas.push(await db.commonArea.create({ data: { buildingId: building.id, ...a } }));
    // Bookings by a couple of residents in this building
    const someResidents = [...ownerOccupied, ...tenanted].slice(0, 3);
    const residentUserIds = await Promise.all(
      someResidents.map(async (u) => (await db.ownership.findFirst({ where: { unitId: u.id }, select: { userId: true } }))?.userId)
    );
    const bookableAreas = areas.filter((a) => a.bookingRequired);
    for (let i = 0; i < bookableAreas.length && i < residentUserIds.length; i++) {
      const uid = residentUserIds[i];
      if (!uid) continue;
      const start = addDays(NOW, i === 0 ? -3 : i + 2); start.setHours(18, 0, 0, 0);
      const end = new Date(start); end.setHours(21, 0, 0, 0);
      await db.commonAreaBooking.create({ data: { commonAreaId: bookableAreas[i].id, userId: uid, startTime: start, endTime: end, notes: "Private function", status: "CONFIRMED" } });
    }

    // ── Maintenance (varied statuses, costs, dates) ─────────────────────────────
    const occUnits = [...ownerOccupied, ...tenanted];
    const maint = [
      { unit: occUnits[0], title: "Kitchen tap dripping", description: "Constant drip from the kitchen mixer for several days.", category: "PLUMBING" as const, priority: "MEDIUM" as const, status: "IN_PROGRESS" as const, est: dollars(180), assigned: "AquaFix Plumbing", sched: addDays(NOW, 2), created: daysAgo(6) },
      { unit: occUnits[1], title: "Air-con not cooling", description: "Split system runs but barely cools even on full power.", category: "HVAC" as const, priority: "HIGH" as const, status: "ACKNOWLEDGED" as const, est: dollars(450), created: daysAgo(3) },
      { unit: occUnits[2], title: "Bathroom exhaust fan failed", description: "Exhaust fan stopped; condensation building up.", category: "ELECTRICAL" as const, priority: "MEDIUM" as const, status: "SCHEDULED" as const, est: dollars(220), assigned: "BrightSpark Electrical", sched: addDays(NOW, 5), created: daysAgo(8) },
      { unit: occUnits[3], title: "Front door deadlock stiff", description: "Deadlock very stiff and hard to turn.", category: "SECURITY" as const, priority: "LOW" as const, status: "COMPLETED" as const, est: dollars(150), actual: dollars(135), assigned: "SecureLock", completed: daysAgo(10), created: daysAgo(20) },
      { unit: occUnits[4], title: "Lift intermittent fault", description: "Lift occasionally skips the requested floor.", category: "LIFT" as const, priority: "URGENT" as const, status: "AWAITING_PARTS" as const, est: dollars(1200), assigned: "Otis Service", created: daysAgo(4) },
    ];
    for (const m of maint) {
      if (!m.unit) continue;
      const requester = (await db.tenancy.findFirst({ where: { unitId: m.unit.id, isActive: true }, select: { userId: true } }))?.userId
        ?? (await db.ownership.findFirst({ where: { unitId: m.unit.id }, select: { userId: true } }))?.userId;
      if (!requester) continue;
      await db.maintenanceRequest.create({
        data: {
          unitId: m.unit.id, requestedById: requester, title: m.title, description: m.description, category: m.category, priority: m.priority, status: m.status,
          assignedTo: ("assigned" in m ? m.assigned : null) ?? null, scheduledDate: ("sched" in m ? m.sched : null) ?? null,
          completedDate: ("completed" in m ? m.completed : null) ?? null, estimatedCost: m.est, actualCost: ("actual" in m ? m.actual : null) ?? null,
          createdAt: m.created,
        },
      });
    }

    // ── Inspections (per first 2 tenanted units): completed entry + upcoming routine ─
    for (let i = 0; i < Math.min(2, tenanted.length); i++) {
      const u = tenanted[i];
      const done = await db.inspection.create({
        data: { unitId: u.id, type: "ENTRY", status: "COMPLETED", scheduledAt: monthsAgo(2), completedAt: monthsAgo(2), inspectedById: manager.id, notes: "Entry condition report completed at move-in." },
      });
      const room = await db.inspectionRoom.create({ data: { inspectionId: done.id, name: "Kitchen", order: 0 } });
      await db.inspectionItem.createMany({ data: [
        { roomId: room.id, label: "Walls & ceiling", status: "PASS" },
        { roomId: room.id, label: "Flooring", status: "PASS" },
        { roomId: room.id, label: "Appliances", status: "FAIL", note: "Oven door seal worn — noted for repair." },
      ] });
      await db.inspection.create({ data: { unitId: u.id, type: "ROUTINE", status: "SCHEDULED", scheduledAt: addDays(NOW, 21), inspectedById: manager.id, notes: "Routine periodic inspection." } });
    }

    // ── Visitors (recent, reception's primary page) ─────────────────────────────
    const visitorDefs = [
      { visitorName: "Amazon Courier", purpose: "DELIVERY" as const, company: "Amazon", unit: occUnits[0]?.unitNumber, plate: "ABC123", daysBack: 0, dur: 1 },
      { visitorName: "Daniel Reeves", purpose: "PERSONAL" as const, unit: occUnits[1]?.unitNumber, daysBack: 1, dur: 3 },
      { visitorName: "CoolFlow HVAC", purpose: "TRADESPERSON" as const, company: "CoolFlow", unit: occUnits[1]?.unitNumber, plate: "TRD889", daysBack: 1, dur: 2 },
      { visitorName: "Ray White Agent", purpose: "REAL_ESTATE" as const, company: "Ray White", unit: occUnits[3]?.unitNumber, daysBack: 4, dur: 1 },
      { visitorName: "Australia Post", purpose: "DELIVERY" as const, company: "Australia Post", unit: occUnits[2]?.unitNumber, daysBack: 6, dur: 1 },
    ];
    for (const v of visitorDefs) {
      const arrival = addDays(NOW, -v.daysBack); arrival.setHours(10 + (poolIdx % 6), 0, 0, 0);
      const departure = new Date(arrival); departure.setHours(arrival.getHours() + v.dur);
      await db.visitorEntry.create({
        data: { buildingId: building.id, registeredById: B.key === "B1" ? reception.id : manager.id,
          visitorName: v.visitorName, visitorCompany: ("company" in v ? v.company : null) ?? null, purpose: v.purpose, unitToVisit: v.unit ?? null,
          vehiclePlate: ("plate" in v ? v.plate : null) ?? null, arrivalTime: arrival, departureTime: v.daysBack === 0 ? null : departure, preApproved: v.purpose === "DELIVERY" },
      });
    }

    // ── Keys (with logs); 1 due for rotation soon ───────────────────────────────
    const keyDefs = [
      { unit: occUnits[0], keyType: "FOB" as const, identifier: `FOB-${B.key}-001`, rotation: addDays(NOW, 6) },
      { unit: occUnits[1], keyType: "PHYSICAL_KEY" as const, identifier: `KEY-${B.key}-002` },
      { unit: occUnits[2], keyType: "SWIPE_CARD" as const, identifier: `CARD-${B.key}-003` },
      { unit: occUnits[3], keyType: "ACCESS_CODE" as const, identifier: `CODE-${B.key}-004` },
    ];
    for (const k of keyDefs) {
      if (!k.unit) continue;
      const holder = (await db.ownership.findFirst({ where: { unitId: k.unit.id }, include: { user: true } }))?.user;
      const rec = await db.keyRecord.create({
        data: { buildingId: building.id, unitId: k.unit.id, keyType: k.keyType, identifier: k.identifier,
          issuedTo: holder ? `${holder.firstName} ${holder.lastName}` : null, issuedDate: monthsAgo(6), isActive: true,
          rotationDue: ("rotation" in k ? k.rotation : null) ?? null },
      });
      await db.keyLog.create({ data: { keyRecordId: rec.id, action: "ISSUED", performedById: manager.id, timestamp: monthsAgo(6), notes: "Issued at move-in." } });
    }

    // ── Documents (building-level) ──────────────────────────────────────────────
    const docDefs = [
      { title: "Strata Plan & By-laws", category: "BUILDING_RULES" as const, mime: "application/pdf", size: 482_000 },
      { title: "Annual Financial Report", category: "FINANCIAL_REPORT" as const, mime: "application/pdf", size: 901_000 },
      { title: "Certificate of Currency (Insurance)", category: "INSURANCE" as const, mime: "application/pdf", size: 233_000 },
      { title: "Last AGM Minutes", category: "STRATA_MINUTES" as const, mime: "application/pdf", size: 156_000 },
    ];
    for (const d of docDefs) {
      await db.document.create({ data: { buildingId: building.id, uploadedById: manager.id, title: d.title, category: d.category, fileUrl: `demo/${B.key}/${d.title.replace(/\W+/g, "_")}.pdf`, storagePath: `demo/${B.key}/${d.title.replace(/\W+/g, "_")}.pdf`, fileSize: d.size, mimeType: d.mime, isPublic: true } });
    }

    // ── Announcements ───────────────────────────────────────────────────────────
    await db.announcement.createMany({ data: [
      { buildingId: building.id, authorId: manager.id, scope: "BUILDING", title: "Quarterly levies now due", content: "Q levy notices have been issued. Please ensure payment by the due date to avoid interest.", priority: "MEDIUM", publishedAt: daysAgo(2) },
      { buildingId: building.id, authorId: manager.id, scope: "BUILDING", title: "Upcoming AGM", content: `The Annual General Meeting will be held in approximately three months. Agenda and financials will be circulated beforehand.`, priority: "MEDIUM", publishedAt: daysAgo(9) },
      { buildingId: building.id, authorId: manager.id, scope: "BUILDING", title: "Lift maintenance this week", content: "Scheduled lift servicing may cause brief outages. We apologise for any inconvenience.", priority: "LOW", publishedAt: daysAgo(5) },
    ] });

    // ── Parcels ─────────────────────────────────────────────────────────────────
    const loggedBy = B.key === "B1" ? reception.id : manager.id;
    for (let i = 0; i < 4 && i < occUnits.length; i++) {
      const u = occUnits[i];
      const holder = (await db.ownership.findFirst({ where: { unitId: u.id }, include: { user: true } }))?.user
        ?? (await db.tenancy.findFirst({ where: { unitId: u.id, isActive: true }, include: { user: true } }))?.user;
      const statuses = ["RECEIVED", "NOTIFIED", "COLLECTED", "RECEIVED"] as const;
      await db.parcel.create({
        data: { buildingId: building.id, unitNumber: u.unitNumber, recipientName: holder ? `${holder.firstName} ${holder.lastName}` : "Resident",
          carrier: ["Australia Post", "DHL", "FedEx", "Aramex"][i % 4], trackingNumber: `${B.key}TRK${1000 + i}`, loggedById: loggedBy,
          status: statuses[i], collectedAt: statuses[i] === "COLLECTED" ? daysAgo(1) : null, collectedBy: statuses[i] === "COLLECTED" && holder ? `${holder.firstName} ${holder.lastName}` : null,
          loggedAt: daysAgo(i) },
      });
    }
  }

  // ── 4. Lease-agreement documents (now that tenancies exist) ─────────────────
  for (const d of allLeaseDocs) {
    await db.document.create({ data: { buildingId: d.buildingId, uploadedById: d.uploadedById, tenancyId: d.tenancyId, title: d.title, category: "LEASE_AGREEMENT", fileUrl: `demo/leases/${d.tenancyId}.pdf`, storagePath: `demo/leases/${d.tenancyId}.pdf`, fileSize: 318_000, mimeType: "application/pdf", isPublic: false } });
  }

  // ── 5. Custom bills (mixed recipients / statuses / modes) ───────────────────
  const b1 = buildingIds[0];
  const someTenancy = await db.tenancy.findFirst({ where: { unit: { buildingId: b1 }, isActive: true }, include: { unit: true } });
  const someOwnership = await db.ownership.findFirst({ where: { unit: { buildingId: b1 } }, include: { unit: true } });
  if (someTenancy && someOwnership) {
    await db.customBill.createMany({ data: [
      { buildingId: b1, unitId: someTenancy.unitId, recipientType: "TENANT", recipientId: someTenancy.userId, title: "Water usage — quarter", description: "Metered water usage for the quarter.", category: "WATER_USAGE", amountCents: dollars(118.4), dueDate: addDays(NOW, 10), status: "PENDING", paymentMode: "ONLINE", createdById: manager.id },
      { buildingId: b1, unitId: someTenancy.unitId, recipientType: "TENANT", recipientId: someTenancy.userId, title: "Replacement fob", description: "Lost access fob replacement.", category: "KEY_REPLACEMENT", amountCents: dollars(55), dueDate: daysAgo(5), status: "OVERDUE", paymentMode: "MANUAL", createdById: manager.id },
      { buildingId: b1, unitId: someOwnership.unitId, recipientType: "OWNER", recipientId: someOwnership.userId, title: "Move-in fee", description: "Administration fee for new tenancy move-in.", category: "MOVE_IN_FEE", amountCents: dollars(150), dueDate: daysAgo(20), paidDate: daysAgo(18), status: "PAID", paymentMode: "ONLINE", createdById: manager.id },
      { buildingId: b1, unitId: someOwnership.unitId, recipientType: "OWNER", recipientId: someOwnership.userId, title: "Common property damage", description: "Repair to foyer wall — contractor invoice.", category: "DAMAGE", amountCents: dollars(420), dueDate: addDays(NOW, 14), status: "PENDING", paymentMode: "MANUAL", createdById: manager.id },
    ] });
  }

  // ── 6. Emergency contacts (demo tenants) ────────────────────────────────────
  for (const t of demoTenants) {
    await db.emergencyContact.create({ data: { userId: t.id, name: "Pat Doyle", relationship: "Sibling", phone: "0412 345 678", email: "pat.doyle@example.com" } });
  }

  // ── 7. Messages (a couple of threads manager ↔ residents) ───────────────────
  const t1 = demoTenants[0];
  await db.message.createMany({ data: [
    { senderId: t1.id, recipientId: manager.id, subject: "Parking spot query", content: "Hi, can you confirm which parking space is allocated to my unit?", threadId: `thread-${t1.id}` , isRead: true },
    { senderId: manager.id, recipientId: t1.id, subject: "Re: Parking spot query", content: "Hi Noah — your unit has space P-101 on level B1. Let me know if you need a remote.", threadId: `thread-${t1.id}`, isRead: false },
  ] });

  // ── 8. Notifications for manager (recent, event-shaped) ─────────────────────
  const notifSeed = [
    ["MAINTENANCE_CREATED", "New maintenance request", "Lift intermittent fault reported (URGENT)."],
    ["MAINTENANCE_STATUS_UPDATED", "Maintenance updated", "Front door deadlock marked completed."],
    ["PARCEL_RECEIVED", "Parcel logged", "A parcel was logged at reception."],
    ["MESSAGE_RECEIVED", "New message", "You have a new message from a resident."],
    ["LEVY_CREATED", "Levies issued", "Quarterly levies have been issued to all lots."],
    ["CUSTOM_BILL_CREATED", "Custom bill created", "A water usage bill was issued."],
    ["ANNOUNCEMENT_PUBLISHED", "Announcement published", "Upcoming AGM announcement published."],
    ["INVITE_SENT", "Invite sent", "A resident invite was sent."],
  ] as const;
  const notifs = Array.from({ length: 24 }, (_, i) => {
    const [type, title, body] = notifSeed[i % notifSeed.length];
    return { userId: manager.id, type, title, body, isRead: i % 3 !== 0, createdAt: new Date(NOW.getTime() - i * 3 * 3600_000) };
  });
  await db.notification.createMany({ data: notifs });

  console.log("\n✅  Demo seed v2 complete.\n   Logins (Demo1234!): manager@demo.com, reception@demo.com, owner1–5@demo.com, tenant1–5@demo.com");
}

main()
  .catch((e) => { console.error("❌ Demo seed failed:", e); process.exit(1); })
  .finally(() => db.$disconnect());
