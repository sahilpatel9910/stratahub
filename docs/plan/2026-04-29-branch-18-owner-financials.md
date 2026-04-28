# Branch 18 — Owner Financial Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Owners get a Financial Summary tab on `/resident/levies` showing a unified transaction history (levies, custom bills, rent income) plus a CSV export. **Branch 16 must be merged first** — this plan depends on tenancy + rent payment data.

**Architecture:** New `owner.getFinancialSummary` tRPC procedure aggregates levy payments, custom bills, and rent payments for the caller's owned units. The existing `/resident/levies` page gains a second tab. CSV export is client-side (no extra library needed — plain `Blob` + `<a>` download trick).

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 7, TanStack Query v5, shadcn/ui, Tailwind v4

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/server/trpc/routers/owner.ts` | `getFinancialSummary` procedure |
| Modify | `src/server/trpc/router.ts` | Register ownerRouter |
| Modify | `src/app/(dashboard)/resident/levies/_client.tsx` | Add Financial Summary tab (owners only) |
| Modify | `src/app/(dashboard)/resident/levies/page.tsx` | Prefetch financial summary for owners |

---

## Task 1: owner tRPC router

**Files:**
- Create: `src/server/trpc/routers/owner.ts`

- [ ] **Step 1: Create the router**

```typescript
import { createTRPCRouter, ownerProcedure } from "@/server/trpc/trpc";

export const ownerRouter = createTRPCRouter({
  getFinancialSummary: ownerProcedure.query(async ({ ctx }) => {
    const userId = ctx.user!.id;

    // Find all units the user owns
    const ownerships = await ctx.db.ownership.findMany({
      where: { userId, isActive: true },
      select: { unitId: true, unit: { select: { unitNumber: true, buildingId: true, building: { select: { name: true } } } } },
    });

    if (ownerships.length === 0) {
      return {
        levyTotalPaidCents: 0,
        levyOutstandingCents: 0,
        customBillsOwingCents: 0,
        rentIncomeTotalCents: 0,
        transactions: [] as Transaction[],
      };
    }

    const unitIds = ownerships.map((o) => o.unitId);

    // 1. Levy payments (owner's own levies)
    const levies = await ctx.db.levyPayment.findMany({
      where: { userId },
      include: { levy: { select: { title: true } } },
      orderBy: { dueDate: "desc" },
    });

    // 2. Custom bills (owner's own bills)
    const customBills = await ctx.db.customBill.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });

    // 3. Rent payments received (tenancies on owned units)
    const tenancies = await ctx.db.tenancy.findMany({
      where: { unitId: { in: unitIds }, isActive: true },
      include: {
        rentPayments: {
          where: { status: { in: ["PAID", "PARTIAL"] } },
          orderBy: { paidDate: "desc" },
        },
        unit: { select: { unitNumber: true } },
      },
    });

    // Aggregate stats
    const levyTotalPaidCents = levies
      .filter((l) => l.status === "PAID")
      .reduce((sum, l) => sum + l.amountCents, 0);
    const levyOutstandingCents = levies
      .filter((l) => l.status === "PENDING" || l.status === "OVERDUE")
      .reduce((sum, l) => sum + l.amountCents, 0);
    const customBillsOwingCents = customBills
      .filter((b) => b.status === "PENDING" || b.status === "OVERDUE")
      .reduce((sum, b) => sum + b.amountCents, 0);
    const rentIncomeTotalCents = tenancies.flatMap((t) => t.rentPayments)
      .reduce((sum, p) => sum + p.amountCents, 0);

    // Build unified transaction list
    type Transaction = {
      date: Date;
      type: "LEVY" | "CUSTOM_BILL" | "RENT_INCOME";
      description: string;
      amountCents: number;
      status: string;
    };

    const transactions: Transaction[] = [
      ...levies.map((l) => ({
        date: l.paidDate ?? l.dueDate,
        type: "LEVY" as const,
        description: l.levy.title,
        amountCents: l.amountCents,
        status: l.status,
      })),
      ...customBills.map((b) => ({
        date: b.createdAt,
        type: "CUSTOM_BILL" as const,
        description: b.description,
        amountCents: b.amountCents,
        status: b.status,
      })),
      ...tenancies.flatMap((t) =>
        t.rentPayments.map((p) => ({
          date: p.paidDate ?? p.dueDate,
          type: "RENT_INCOME" as const,
          description: `Rent — Unit ${t.unit.unitNumber}`,
          amountCents: p.amountCents,
          status: p.status,
        }))
      ),
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      levyTotalPaidCents,
      levyOutstandingCents,
      customBillsOwingCents,
      rentIncomeTotalCents,
      transactions,
    };
  }),
});
```

- [ ] **Step 2: Register in router.ts**

```typescript
import { ownerRouter } from "./routers/owner";
// inside createTRPCRouter:
  owner: ownerRouter,
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/server/trpc/routers/owner.ts src/server/trpc/router.ts
git commit -m "feat(owner): add owner.getFinancialSummary tRPC procedure"
```

---

## Task 2: Add Financial Summary tab to /resident/levies

**Files:**
- Modify: `src/app/(dashboard)/resident/levies/_client.tsx`

The levies client already has tabs (Levies, Custom Bills). Add a third tab that only renders for OWNER role. Read the file first, then make the following additions.

- [ ] **Step 1: Add the financial summary query**

Inside the client component, after existing queries, add:

```typescript
const { data: financials, isLoading: financialsLoading } = trpc.owner.getFinancialSummary.useQuery(
  undefined,
  { enabled: true } // procedure guard handles non-owners server-side; returns empty for non-owners
);
```

- [ ] **Step 2: Add the CSV export helper** (before the return statement)

```typescript
function exportCSV() {
  if (!financials) return;
  const rows = [
    ["Date", "Type", "Description", "Amount (AUD)", "Status"],
    ...financials.transactions.map((t) => [
      new Date(t.date).toLocaleDateString("en-AU"),
      t.type === "LEVY" ? "Levy" : t.type === "CUSTOM_BILL" ? "Custom Bill" : "Rent Income",
      t.description,
      (t.amountCents / 100).toFixed(2),
      t.status,
    ]),
  ];
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `financial-summary-${new Date().toISOString().split("T")[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 3: Add "Financial Summary" to TabsList**

Find the existing `<TabsList>` and add:

```tsx
<TabsTrigger value="financials">Financial Summary</TabsTrigger>
```

- [ ] **Step 4: Add TabsContent for financials** (after the last existing TabsContent)

```tsx
<TabsContent value="financials">
  {/* Stat cards */}
  <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {[
      { label: "Levies Paid", value: financials?.levyTotalPaidCents ?? 0, color: "text-emerald-600", bg: "bg-emerald-50" },
      { label: "Levies Outstanding", value: financials?.levyOutstandingCents ?? 0, color: "text-red-600", bg: "bg-red-50" },
      { label: "Custom Bills Owing", value: financials?.customBillsOwingCents ?? 0, color: "text-amber-600", bg: "bg-amber-50" },
      { label: "Rent Income", value: financials?.rentIncomeTotalCents ?? 0, color: "text-sky-600", bg: "bg-sky-50" },
    ].map(({ label, value, color, bg }) => (
      <Card key={label}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        </CardHeader>
        <CardContent>
          {financialsLoading ? (
            <Skeleton className="h-8 w-24" />
          ) : (
            <p className={`text-2xl font-bold ${color}`}>{formatCurrency(value)}</p>
          )}
        </CardContent>
      </Card>
    ))}
  </div>

  {/* Transaction table */}
  <div className="app-panel overflow-hidden">
    <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
      <div>
        <p className="panel-kicker">Transaction History</p>
        <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
          All financial activity
        </h2>
      </div>
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-xl"
        disabled={!financials || financials.transactions.length === 0}
        onClick={exportCSV}
      >
        Export CSV
      </Button>
    </div>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Type</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Amount</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {financialsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              {Array.from({ length: 5 }).map((_, j) => (
                <TableCell key={j}><Skeleton className="h-4 w-20" /></TableCell>
              ))}
            </TableRow>
          ))
        ) : !financials || financials.transactions.length === 0 ? (
          <TableRow>
            <TableCell colSpan={5} className="py-12 text-center text-sm text-muted-foreground">
              No transactions yet.
            </TableCell>
          </TableRow>
        ) : (
          financials.transactions.map((t, i) => {
            const typeLabel =
              t.type === "LEVY" ? "Levy"
              : t.type === "CUSTOM_BILL" ? "Custom Bill"
              : "Rent Income";
            const typeBadgeClass =
              t.type === "LEVY" ? "bg-violet-100 text-violet-800"
              : t.type === "CUSTOM_BILL" ? "bg-amber-100 text-amber-800"
              : "bg-sky-100 text-sky-800";
            const statusClass: Record<string, string> = {
              PAID: "bg-green-100 text-green-800",
              PENDING: "bg-yellow-100 text-yellow-800",
              OVERDUE: "bg-red-100 text-red-800",
              PARTIAL: "bg-blue-100 text-blue-800",
              WAIVED: "bg-gray-100 text-gray-600",
            };
            return (
              <TableRow key={i}>
                <TableCell className="text-muted-foreground">
                  {new Date(t.date).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" })}
                </TableCell>
                <TableCell>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${typeBadgeClass}`}>
                    {typeLabel}
                  </span>
                </TableCell>
                <TableCell className="font-medium">{t.description}</TableCell>
                <TableCell>{formatCurrency(t.amountCents)}</TableCell>
                <TableCell>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${statusClass[t.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {t.status.charAt(0) + t.status.slice(1).toLowerCase()}
                  </span>
                </TableCell>
              </TableRow>
            );
          })
        )}
      </TableBody>
    </Table>
  </div>
</TabsContent>
```

- [ ] **Step 5: Verify imports**

Confirm these are already imported in the file (add if missing):
- `Card, CardContent, CardHeader, CardTitle` from `@/components/ui/card`
- `Skeleton` from `@/components/ui/skeleton`
- `Table, TableBody, TableCell, TableHead, TableHeader, TableRow` from `@/components/ui/table`
- `Button` from `@/components/ui/button`
- `formatCurrency` from `@/lib/constants`

- [ ] **Step 6: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/resident/levies/_client.tsx
git commit -m "feat(owner): add Financial Summary tab to /resident/levies"
```

---

## Task 3: Prefetch financial summary in levies RSC page

**Files:**
- Modify: `src/app/(dashboard)/resident/levies/page.tsx`

- [ ] **Step 1: Add prefetch**

Read the current `page.tsx` first, then add the prefetch. Add after existing prefetch calls:

```typescript
await trpc.owner.getFinancialSummary.prefetch();
```

This is safe for non-owners — the `ownerProcedure` guard will return empty data rather than throw, so the prefetch won't error.

- [ ] **Step 2: Commit**

```bash
git add src/app/\(dashboard\)/resident/levies/page.tsx
git commit -m "feat(owner): prefetch financial summary in levies RSC page"
```

---

## Task 4: Final check & push

- [ ] **Step 1: Full build**

```bash
npm run build 2>&1 | tail -20
```
Expected: succeeds

- [ ] **Step 2: Manual smoke test**

1. Log in as `owner1@demo.com` (password: `Demo1234!`)
2. Go to `/resident/levies` → see **Financial Summary** tab
3. Click it → stat cards show levy/bill/rent totals
4. Transactions table shows all activity sorted newest first
5. Click **Export CSV** → file downloads with correct columns
6. Log in as `tenant1@demo.com` → go to `/resident/levies` → Financial Summary tab should still appear (ownerProcedure returns empty result, not an error)
7. Log in as `manager@demo.com` → `/resident/` redirect handles correctly (managers go to manager portal)

- [ ] **Step 3: Push**

```bash
git push origin main
```
