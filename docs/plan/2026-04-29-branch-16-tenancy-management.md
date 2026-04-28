# Branch 16 — Manager Tenancy Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give building managers full CRUD over tenancies — create, edit lease terms, end, and view a per-tenancy detail page with payment actions.

**Architecture:** New `tenancy` tRPC router handles tenancy lifecycle (create/update/end/list/getById). `rent.markOverdue` is added to the existing rent router. The existing `/manager/rent` page gains create/edit/end actions. A new `/manager/tenancies/[id]` detail page follows the maintenance detail pattern (RSC wrapper + `_client.tsx`).

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 7, Supabase, TanStack Query v5, shadcn/ui, Tailwind v4

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `src/server/trpc/routers/tenancy.ts` | create, update, end, listByBuilding, getById procedures |
| Modify | `src/server/trpc/routers/rent.ts` | Add markOverdue procedure |
| Modify | `src/server/trpc/router.ts` | Register tenancyRouter |
| Create | `src/app/(dashboard)/manager/tenancies/[id]/page.tsx` | RSC prefetch wrapper |
| Create | `src/app/(dashboard)/manager/tenancies/[id]/_client.tsx` | Detail page with lease info + payment schedule + actions |
| Create | `src/app/(dashboard)/manager/tenancies/[id]/loading.tsx` | Skeleton |
| Create | `src/app/(dashboard)/manager/rent/_create-tenancy-dialog.tsx` | Create tenancy form (lazy-loaded) |
| Create | `src/app/(dashboard)/manager/rent/_edit-tenancy-dialog.tsx` | Edit lease terms form (lazy-loaded, controlled) |
| Modify | `src/app/(dashboard)/manager/rent/page.tsx` | Add create button, edit/end/view actions per row, markOverdue button |

---

## Task 1: tenancy tRPC router

**Files:**
- Create: `src/server/trpc/routers/tenancy.ts`

- [ ] **Step 1: Create the router file**

```typescript
import { z } from "zod";
import {
  buildingManagerProcedure,
  managerProcedure,
  createTRPCRouter,
} from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import {
  assertBuildingManagementAccess,
} from "@/server/auth/building-access";

const rentFrequencyEnum = z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]);
const bondStatusEnum = z.enum(["PENDING", "LODGED", "PARTIALLY_RELEASED", "FULLY_RELEASED", "DISPUTED"]);

export const tenancyRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        activeOnly: z.boolean().default(true),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.tenancy.findMany({
        where: {
          unit: { buildingId: input.buildingId },
          ...(input.activeOnly ? { isActive: true } : {}),
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          unit: { select: { unitNumber: true } },
          _count: { select: { rentPayments: true } },
          rentPayments: {
            where: { status: { in: ["PENDING", "OVERDUE"] } },
            orderBy: { dueDate: "asc" },
            take: 1,
          },
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      return ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, email: true } },
          unit: { include: { building: { select: { name: true, suburb: true } } } },
          rentPayments: { orderBy: { dueDate: "desc" } },
          bondRecord: true,
        },
      });
    }),

  create: buildingManagerProcedure
    .input(
      z.object({
        unitId: z.string(),
        userId: z.string(),
        leaseStartDate: z.string().transform((s) => new Date(s)),
        leaseEndDate: z.string().transform((s) => new Date(s)).nullable().optional(),
        rentAmountCents: z.number().int().positive(),
        rentFrequency: rentFrequencyEnum,
        bondAmountCents: z.number().int().min(0),
        moveInDate: z.string().transform((s) => new Date(s)).nullable().optional(),
        generateSchedule: z.boolean().default(true),
        scheduleMonths: z.number().int().min(1).max(24).default(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, unit.buildingId);

      // Enforce one active tenancy per unit
      const existing = await ctx.db.tenancy.findFirst({
        where: { unitId: input.unitId, isActive: true },
      });
      if (existing) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This unit already has an active tenancy. End the existing tenancy first.",
        });
      }

      const { generateSchedule, scheduleMonths, ...tenancyData } = input;

      return ctx.db.$transaction(async (tx) => {
        const tenancy = await tx.tenancy.create({
          data: {
            ...tenancyData,
            leaseEndDate: input.leaseEndDate ?? null,
            moveInDate: input.moveInDate ?? input.leaseStartDate,
          },
        });

        if (generateSchedule) {
          const payments = buildSchedule({
            tenancyId: tenancy.id,
            leaseStartDate: tenancy.leaseStartDate,
            rentFrequency: tenancy.rentFrequency,
            rentAmountCents: tenancy.rentAmountCents,
            months: scheduleMonths,
          });
          await tx.rentPayment.createMany({ data: payments });
        }

        return tenancy;
      });
    }),

  update: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        leaseStartDate: z.string().transform((s) => new Date(s)).optional(),
        leaseEndDate: z.string().transform((s) => new Date(s)).nullable().optional(),
        rentAmountCents: z.number().int().positive().optional(),
        rentFrequency: rentFrequencyEnum.optional(),
        bondAmountCents: z.number().int().min(0).optional(),
        moveInDate: z.string().transform((s) => new Date(s)).nullable().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      return ctx.db.tenancy.update({ where: { id }, data });
    }),

  end: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        moveOutDate: z.string().transform((s) => new Date(s)).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const tenancy = await ctx.db.tenancy.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, tenancy.unit.buildingId);

      return ctx.db.tenancy.update({
        where: { id: input.id },
        data: {
          isActive: false,
          moveOutDate: input.moveOutDate ?? new Date(),
        },
      });
    }),
});

// ── Shared schedule builder ───────────────────────────────────────────────────
function buildSchedule({
  tenancyId,
  leaseStartDate,
  rentFrequency,
  rentAmountCents,
  months,
}: {
  tenancyId: string;
  leaseStartDate: Date;
  rentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  rentAmountCents: number;
  months: number;
}) {
  const payments = [];
  const start = new Date(leaseStartDate);
  const count =
    rentFrequency === "WEEKLY" ? months * 4 :
    rentFrequency === "FORTNIGHTLY" ? months * 2 :
    months;

  for (let i = 0; i < count; i++) {
    const dueDate = new Date(start);
    if (rentFrequency === "WEEKLY") dueDate.setDate(start.getDate() + i * 7);
    else if (rentFrequency === "FORTNIGHTLY") dueDate.setDate(start.getDate() + i * 14);
    else dueDate.setMonth(start.getMonth() + i);

    payments.push({ tenancyId, amountCents: rentAmountCents, dueDate, status: "PENDING" as const });
  }
  return payments;
}
```

- [ ] **Step 2: Verify file saved correctly**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors in tenancy.ts

---

## Task 2: Add markOverdue to rent router + register tenancy router

**Files:**
- Modify: `src/server/trpc/routers/rent.ts` (add at end, before closing `}`)
- Modify: `src/server/trpc/router.ts`

- [ ] **Step 1: Add markOverdue to rent router**

Add inside `rentRouter` in `src/server/trpc/routers/rent.ts`, before the closing `});`:

```typescript
  markOverdue: buildingManagerProcedure
    .input(z.object({ buildingId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await assertBuildingManagementAccess(ctx.db, ctx.user!, input.buildingId);

      const now = new Date();
      return ctx.db.rentPayment.updateMany({
        where: {
          status: "PENDING",
          dueDate: { lt: now },
          tenancy: {
            isActive: true,
            unit: { buildingId: input.buildingId },
          },
        },
        data: { status: "OVERDUE" },
      });
    }),
```

- [ ] **Step 2: Register tenancy router**

In `src/server/trpc/router.ts`, add:

```typescript
import { tenancyRouter } from "./routers/tenancy";
```

And inside `createTRPCRouter({...})`:

```typescript
  tenancy: tenancyRouter,
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/server/trpc/routers/tenancy.ts src/server/trpc/routers/rent.ts src/server/trpc/router.ts
git commit -m "feat(tenancy): add tenancy router + rent.markOverdue"
```

---

## Task 3: Create Tenancy dialog

**Files:**
- Create: `src/app/(dashboard)/manager/rent/_create-tenancy-dialog.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { UserPlus } from "lucide-react";
import { skipToken } from "@tanstack/react-query";
import { useBuildingContext } from "@/hooks/use-building-context";

export default function CreateTenancyDialog() {
  const [open, setOpen] = useState(false);
  const { selectedBuildingId } = useBuildingContext();
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    unitId: "",
    userId: "",
    leaseStartDate: "",
    leaseEndDate: "",
    rentAmountCents: "",
    rentFrequency: "MONTHLY" as "WEEKLY" | "FORTNIGHTLY" | "MONTHLY",
    bondAmountCents: "",
    scheduleMonths: "12",
  });

  const unitsQuery = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );
  const residentsQuery = trpc.residents.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createMutation = trpc.tenancy.create.useMutation({
    onSuccess: () => {
      toast.success("Tenancy created");
      void utils.tenancy.listByBuilding.invalidate();
      void utils.rent.getRentRoll.invalidate();
      void utils.rent.listByBuilding.invalidate();
      setOpen(false);
      setForm({
        unitId: "", userId: "", leaseStartDate: "", leaseEndDate: "",
        rentAmountCents: "", rentFrequency: "MONTHLY", bondAmountCents: "",
        scheduleMonths: "12",
      });
    },
    onError: (e) => toast.error(e.message ?? "Failed to create tenancy"),
  });

  const units = unitsQuery.data ?? [];
  const residents = residentsQuery.data ?? [];

  const canSubmit =
    form.unitId && form.userId && form.leaseStartDate &&
    form.rentAmountCents && form.bondAmountCents && !createMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="h-9 rounded-xl">
          <UserPlus className="mr-1.5 h-4 w-4" />
          New Tenancy
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Create Tenancy</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Unit</Label>
              <Select
                value={form.unitId}
                onValueChange={(v) => v !== null && setForm((f) => ({ ...f, unitId: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select unit" />
                </SelectTrigger>
                <SelectContent>
                  {units.map((u) => (
                    <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Tenant</Label>
              <Select
                value={form.userId}
                onValueChange={(v) => v !== null && setForm((f) => ({ ...f, userId: v }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue placeholder="Select resident" />
                </SelectTrigger>
                <SelectContent>
                  {residents.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.firstName} {r.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Lease start</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={form.leaseStartDate}
                onChange={(e) => setForm((f) => ({ ...f, leaseStartDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lease end (optional)</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={form.leaseEndDate}
                onChange={(e) => setForm((f) => ({ ...f, leaseEndDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rent (cents)</Label>
              <Input
                type="number"
                placeholder="e.g. 150000 = $1,500"
                className="rounded-xl"
                value={form.rentAmountCents}
                onChange={(e) => setForm((f) => ({ ...f, rentAmountCents: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={form.rentFrequency}
                onValueChange={(v) => v !== null && setForm((f) => ({ ...f, rentFrequency: v as typeof form.rentFrequency }))}
              >
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Bond (cents)</Label>
              <Input
                type="number"
                placeholder="e.g. 450000 = $4,500"
                className="rounded-xl"
                value={form.bondAmountCents}
                onChange={(e) => setForm((f) => ({ ...f, bondAmountCents: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Schedule months</Label>
              <Input
                type="number"
                min={1}
                max={24}
                className="rounded-xl"
                value={form.scheduleMonths}
                onChange={(e) => setForm((f) => ({ ...f, scheduleMonths: e.target.value }))}
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={createMutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={!canSubmit}
            onClick={() =>
              createMutation.mutate({
                unitId: form.unitId,
                userId: form.userId,
                leaseStartDate: form.leaseStartDate,
                leaseEndDate: form.leaseEndDate || null,
                rentAmountCents: parseInt(form.rentAmountCents, 10),
                rentFrequency: form.rentFrequency,
                bondAmountCents: parseInt(form.bondAmountCents, 10),
                generateSchedule: true,
                scheduleMonths: parseInt(form.scheduleMonths, 10),
              })
            }
          >
            {createMutation.isPending ? "Creating…" : "Create Tenancy"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit 2>&1 | grep "_create-tenancy" | head -10
```
Expected: no errors

---

## Task 4: Edit Tenancy dialog

**Files:**
- Create: `src/app/(dashboard)/manager/rent/_edit-tenancy-dialog.tsx`

- [ ] **Step 1: Create the file**

```typescript
"use client";

import { useEffect, useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type TenancyForEdit = {
  id: string;
  leaseStartDate: Date | string;
  leaseEndDate?: Date | string | null;
  rentAmountCents: number;
  rentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  bondAmountCents: number;
};

interface Props {
  tenancy: TenancyForEdit | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function toDateInput(v: Date | string | null | undefined) {
  if (!v) return "";
  return new Date(v).toISOString().split("T")[0];
}

export default function EditTenancyDialog({ tenancy, open, onOpenChange }: Props) {
  const utils = trpc.useUtils();

  const [form, setForm] = useState({
    leaseStartDate: "",
    leaseEndDate: "",
    rentAmountCents: "",
    rentFrequency: "MONTHLY" as "WEEKLY" | "FORTNIGHTLY" | "MONTHLY",
    bondAmountCents: "",
  });

  useEffect(() => {
    if (tenancy) {
      setForm({
        leaseStartDate: toDateInput(tenancy.leaseStartDate),
        leaseEndDate: toDateInput(tenancy.leaseEndDate),
        rentAmountCents: String(tenancy.rentAmountCents),
        rentFrequency: tenancy.rentFrequency,
        bondAmountCents: String(tenancy.bondAmountCents),
      });
    }
  }, [tenancy?.id]);

  const updateMutation = trpc.tenancy.update.useMutation({
    onSuccess: () => {
      toast.success("Tenancy updated");
      void utils.tenancy.listByBuilding.invalidate();
      void utils.tenancy.getById.invalidate();
      void utils.rent.getRentRoll.invalidate();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e.message ?? "Failed to update tenancy"),
  });

  if (!tenancy) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Lease Terms</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Lease start</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={form.leaseStartDate}
                onChange={(e) => setForm((f) => ({ ...f, leaseStartDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Lease end</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={form.leaseEndDate}
                onChange={(e) => setForm((f) => ({ ...f, leaseEndDate: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Rent (cents)</Label>
              <Input
                type="number"
                className="rounded-xl"
                value={form.rentAmountCents}
                onChange={(e) => setForm((f) => ({ ...f, rentAmountCents: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select
                value={form.rentFrequency}
                onValueChange={(v) => v !== null && setForm((f) => ({ ...f, rentFrequency: v as typeof form.rentFrequency }))}
              >
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="WEEKLY">Weekly</SelectItem>
                  <SelectItem value="FORTNIGHTLY">Fortnightly</SelectItem>
                  <SelectItem value="MONTHLY">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Bond (cents)</Label>
            <Input
              type="number"
              className="rounded-xl"
              value={form.bondAmountCents}
              onChange={(e) => setForm((f) => ({ ...f, bondAmountCents: e.target.value }))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button
            disabled={updateMutation.isPending}
            onClick={() =>
              updateMutation.mutate({
                id: tenancy.id,
                leaseStartDate: form.leaseStartDate,
                leaseEndDate: form.leaseEndDate || null,
                rentAmountCents: parseInt(form.rentAmountCents, 10),
                rentFrequency: form.rentFrequency,
                bondAmountCents: parseInt(form.bondAmountCents, 10),
              })
            }
          >
            {updateMutation.isPending ? "Saving…" : "Save Changes"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Commit dialogs**

```bash
git add src/app/\(dashboard\)/manager/rent/_create-tenancy-dialog.tsx src/app/\(dashboard\)/manager/rent/_edit-tenancy-dialog.tsx
git commit -m "feat(tenancy): add create + edit tenancy dialogs"
```

---

## Task 5: Extend /manager/rent page — Tenancies tab

**Files:**
- Modify: `src/app/(dashboard)/manager/rent/page.tsx`

The existing rent page is `"use client"` (not an RSC wrapper). It has tabs: `roll`, `payments`, `setup`, `bonds`. Add a `tenancies` tab.

- [ ] **Step 1: Add dynamic imports at top of file** (after existing imports)

```typescript
import dynamic from "next/dynamic";

const CreateTenancyDialog = dynamic(() => import("./_create-tenancy-dialog"), { ssr: false });
const EditTenancyDialog = dynamic(() => import("./_edit-tenancy-dialog"), { ssr: false });
```

- [ ] **Step 2: Add state for edit dialog**

In the component state block, add:

```typescript
const [editTenancy, setEditTenancy] = useState<{
  id: string;
  leaseStartDate: Date;
  leaseEndDate?: Date | null;
  rentAmountCents: number;
  rentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  bondAmountCents: number;
} | null>(null);
const [editOpen, setEditOpen] = useState(false);
```

- [ ] **Step 3: Add tenancy list query**

After the existing queries in the component, add:

```typescript
const tenancyQuery = trpc.tenancy.listByBuilding.useQuery(
  selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
  { placeholderData: (prev) => prev }
);
const tenancies = tenancyQuery.data ?? [];
```

- [ ] **Step 4: Add endMutation and markOverdueMutation**

```typescript
const endTenancyMutation = trpc.tenancy.end.useMutation({
  onSuccess: () => {
    toast.success("Tenancy ended");
    void utils.tenancy.listByBuilding.invalidate();
    void utils.rent.getRentRoll.invalidate();
  },
  onError: (e) => toast.error(e.message ?? "Failed to end tenancy"),
});

const markOverdueMutation = trpc.rent.markOverdue.useMutation({
  onSuccess: (result) => {
    toast.success(`${result.count} payment(s) marked overdue`);
    void utils.rent.listByBuilding.invalidate();
    void utils.rent.getRentRoll.invalidate();
  },
  onError: (e) => toast.error(e.message ?? "Failed to mark overdue"),
});
```

- [ ] **Step 5: Add "tenancies" to the TabsList**

Find the existing `<TabsList>` and add:

```tsx
<TabsTrigger value="tenancies">Tenancies</TabsTrigger>
```

Also add `"tenancies"` to the `RentTab` type union at the top of the file.

- [ ] **Step 6: Add TabsContent for tenancies**

Add after the last existing `<TabsContent>` block, before `</Tabs>`:

```tsx
<TabsContent value="tenancies">
  <div className="mb-4 flex items-center justify-between">
    <div>
      <p className="text-sm font-medium text-muted-foreground">
        {tenancies.length} active {tenancies.length === 1 ? "tenancy" : "tenancies"}
      </p>
    </div>
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        className="h-9 rounded-xl"
        disabled={!selectedBuildingId || markOverdueMutation.isPending}
        onClick={() => selectedBuildingId && markOverdueMutation.mutate({ buildingId: selectedBuildingId })}
      >
        {markOverdueMutation.isPending ? "Marking…" : "Mark Overdue"}
      </Button>
      <CreateTenancyDialog />
    </div>
  </div>

  <Table>
    <TableHeader>
      <TableRow>
        <TableHead>Tenant</TableHead>
        <TableHead>Unit</TableHead>
        <TableHead>Rent</TableHead>
        <TableHead>Lease End</TableHead>
        <TableHead>Status</TableHead>
        <TableHead />
      </TableRow>
    </TableHeader>
    <TableBody>
      {tenancyQuery.isLoading ? (
        Array.from({ length: 4 }).map((_, i) => (
          <TableRow key={i}>
            {Array.from({ length: 6 }).map((_, j) => (
              <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
            ))}
          </TableRow>
        ))
      ) : tenancies.length === 0 ? (
        <TableRow>
          <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
            No active tenancies.
          </TableCell>
        </TableRow>
      ) : (
        tenancies.map((t) => {
          const overdue = t.rentPayments.filter((p: { status: string }) => p.status === "OVERDUE").length;
          return (
            <TableRow
              key={t.id}
              className="cursor-pointer"
              onClick={() => router.push(`/manager/tenancies/${t.id}`)}
            >
              <TableCell className="font-medium">
                {t.user.firstName} {t.user.lastName}
              </TableCell>
              <TableCell>Unit {t.unit.unitNumber}</TableCell>
              <TableCell>
                {formatCurrency(t.rentAmountCents)} / {t.rentFrequency.toLowerCase()}
              </TableCell>
              <TableCell className="text-muted-foreground">
                {t.leaseEndDate ? new Date(t.leaseEndDate).toLocaleDateString("en-AU") : "Ongoing"}
              </TableCell>
              <TableCell>
                {overdue > 0 ? (
                  <Badge variant="destructive">{overdue} overdue</Badge>
                ) : (
                  <Badge variant="outline">Active</Badge>
                )}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs"
                    onClick={() => {
                      setEditTenancy(t);
                      setEditOpen(true);
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 rounded-lg text-xs text-red-600 hover:bg-red-50"
                    disabled={endTenancyMutation.isPending}
                    onClick={() => {
                      if (confirm(`End tenancy for ${t.user.firstName} ${t.user.lastName}? This cannot be undone.`)) {
                        endTenancyMutation.mutate({ id: t.id });
                      }
                    }}
                  >
                    End
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          );
        })
      )}
    </TableBody>
  </Table>

  <EditTenancyDialog tenancy={editTenancy} open={editOpen} onOpenChange={setEditOpen} />
</TabsContent>
```

- [ ] **Step 7: Add `useRouter` import** (if not already present)

```typescript
import { useRouter } from "next/navigation";
```

And in the component: `const router = useRouter();`

- [ ] **Step 8: Type check + dev test**

```bash
npx tsc --noEmit 2>&1 | head -20
npm run dev
```
Navigate to `/manager/rent`, open Tenancies tab. Verify table renders, Create dialog opens, Edit dialog opens, End button works.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(dashboard\)/manager/rent/page.tsx
git commit -m "feat(tenancy): add Tenancies tab to /manager/rent with create/edit/end/mark-overdue"
```

---

## Task 6: Tenancy detail page

**Files:**
- Create: `src/app/(dashboard)/manager/tenancies/[id]/loading.tsx`
- Create: `src/app/(dashboard)/manager/tenancies/[id]/page.tsx`
- Create: `src/app/(dashboard)/manager/tenancies/[id]/_client.tsx`

- [ ] **Step 1: Create loading.tsx**

```typescript
export default function TenancyDetailLoading() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {[1, 2, 3].map((i) => (
        <section key={i} className="app-panel overflow-hidden p-6 md:p-8">
          <div className="space-y-4">
            {[1, 2, 3].map((j) => (
              <div key={j} className="h-8 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Create page.tsx (RSC wrapper)**

```typescript
import { createServerTRPC } from "@/lib/trpc/server";
import TenancyDetailClient from "./_client";

export default async function TenancyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trpc, HydrateClient } = await createServerTRPC();
  await trpc.tenancy.getById.prefetch({ id });

  return (
    <HydrateClient>
      <TenancyDetailClient id={id} />
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Create _client.tsx**

```typescript
"use client";

import Link from "next/link";
import { useState } from "react";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending", PAID: "Paid", OVERDUE: "Overdue",
  PARTIAL: "Partial", WAIVED: "Waived",
};
const STATUS_STYLES: Record<string, string> = {
  PAID: "bg-green-100 text-green-800",
  OVERDUE: "bg-red-100 text-red-800",
  PENDING: "bg-yellow-100 text-yellow-800",
  PARTIAL: "bg-blue-100 text-blue-800",
  WAIVED: "bg-gray-100 text-gray-600",
};
const FREQ_LABELS: Record<string, string> = {
  WEEKLY: "Weekly", FORTNIGHTLY: "Fortnightly", MONTHLY: "Monthly",
};

function formatDate(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function TenancyDetailClient({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const { data: tenancy, isLoading, isError } = trpc.tenancy.getById.useQuery({ id });

  const [recordOpen, setRecordOpen] = useState(false);
  const [selectedPaymentId, setSelectedPaymentId] = useState<string | null>(null);
  const [paymentForm, setPaymentForm] = useState({
    amountCents: "", paidDate: "", paymentMethod: "",
  });

  const recordPaymentMutation = trpc.rent.recordPayment.useMutation({
    onSuccess: () => {
      toast.success("Payment recorded");
      void utils.tenancy.getById.invalidate({ id });
      setRecordOpen(false);
      setSelectedPaymentId(null);
      setPaymentForm({ amountCents: "", paidDate: "", paymentMethod: "" });
    },
    onError: (e) => toast.error(e.message ?? "Failed to record payment"),
  });

  if (isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="app-panel p-6 md:p-8">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="mt-4 h-5 w-48 rounded-full" />
        </section>
      </div>
    );
  }

  if (isError || !tenancy) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
        <section className="app-panel p-6 md:p-8">
          <p className="text-sm text-muted-foreground">Could not load tenancy.</p>
          <Link href="/manager/rent" className="mt-3 inline-flex text-sm text-muted-foreground hover:text-foreground">
            ← Back to Rent
          </Link>
        </section>
      </div>
    );
  }

  const selectedPayment = tenancy.rentPayments.find((p) => p.id === selectedPaymentId);
  const overdueCount = tenancy.rentPayments.filter((p) => p.status === "OVERDUE").length;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Header */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <Link
          href="/manager/rent"
          className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          ← Rent
        </Link>
        <p className="eyebrow-label text-primary/80">Tenancy</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
          {tenancy.user.firstName} {tenancy.user.lastName}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Unit {tenancy.unit.unitNumber} — {tenancy.unit.building.name}
          {tenancy.unit.building.suburb ? `, ${tenancy.unit.building.suburb}` : ""}
        </p>
      </section>

      {/* Lease details */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <p className="eyebrow-label">Lease details</p>
        <div className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {[
            ["Tenant", `${tenancy.user.firstName} ${tenancy.user.lastName}`],
            ["Email", tenancy.user.email],
            ["Rent", `${formatCurrency(tenancy.rentAmountCents)} / ${FREQ_LABELS[tenancy.rentFrequency]}`],
            ["Bond", formatCurrency(tenancy.bondAmountCents)],
            ["Lease start", formatDate(tenancy.leaseStartDate)],
            ["Lease end", formatDate(tenancy.leaseEndDate)],
            ["Move in", formatDate(tenancy.moveInDate)],
            ["Overdue", overdueCount > 0 ? `${overdueCount} payment(s)` : "None"],
          ].map(([label, value]) => (
            <div key={label} className="flex flex-col gap-0.5">
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className={`text-sm font-medium ${label === "Overdue" && overdueCount > 0 ? "text-red-600" : "text-foreground"}`}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Payment schedule */}
      <section className="app-panel overflow-hidden">
        <div className="border-b border-border/70 px-5 py-4">
          <p className="panel-kicker">Payment Schedule</p>
          <h2 className="mt-1 text-lg font-semibold tracking-[-0.03em] text-foreground">
            Rent history &amp; upcoming payments
          </h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Due Date</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Paid Date</TableHead>
              <TableHead>Method</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenancy.rentPayments.map((p) => (
              <TableRow key={p.id}>
                <TableCell className="font-medium">{formatDate(p.dueDate)}</TableCell>
                <TableCell>{formatCurrency(p.amountCents)}</TableCell>
                <TableCell>
                  <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[p.status] ?? "bg-gray-100 text-gray-600"}`}>
                    {STATUS_LABELS[p.status] ?? p.status}
                  </span>
                </TableCell>
                <TableCell className="text-muted-foreground">{formatDate(p.paidDate)}</TableCell>
                <TableCell className="text-muted-foreground">{p.paymentMethod ?? "—"}</TableCell>
                <TableCell>
                  {(p.status === "PENDING" || p.status === "OVERDUE") && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-lg text-xs"
                      onClick={() => {
                        setSelectedPaymentId(p.id);
                        setPaymentForm({
                          amountCents: String(p.amountCents),
                          paidDate: new Date().toISOString().split("T")[0],
                          paymentMethod: "",
                        });
                        setRecordOpen(true);
                      }}
                    >
                      Record
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </section>

      {/* Record payment dialog */}
      <Dialog open={recordOpen} onOpenChange={setRecordOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Amount (cents)</Label>
              <Input
                type="number"
                className="rounded-xl"
                value={paymentForm.amountCents}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amountCents: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Date paid</Label>
              <Input
                type="date"
                className="rounded-xl"
                value={paymentForm.paidDate}
                onChange={(e) => setPaymentForm((f) => ({ ...f, paidDate: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Payment method</Label>
              <Select
                value={paymentForm.paymentMethod}
                onValueChange={(v) => v !== null && setPaymentForm((f) => ({ ...f, paymentMethod: v }))}
              >
                <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select method" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Bank transfer">Bank transfer</SelectItem>
                  <SelectItem value="Cash">Cash</SelectItem>
                  <SelectItem value="Cheque">Cheque</SelectItem>
                  <SelectItem value="Direct debit">Direct debit</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRecordOpen(false)} disabled={recordPaymentMutation.isPending}>
              Cancel
            </Button>
            <Button
              disabled={!paymentForm.amountCents || !paymentForm.paidDate || recordPaymentMutation.isPending}
              onClick={() => {
                if (!selectedPaymentId) return;
                recordPaymentMutation.mutate({
                  id: selectedPaymentId,
                  amountCents: parseInt(paymentForm.amountCents, 10),
                  paidDate: paymentForm.paidDate,
                  paymentMethod: paymentForm.paymentMethod || undefined,
                });
              }}
            >
              {recordPaymentMutation.isPending ? "Saving…" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 4: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```
Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add src/app/\(dashboard\)/manager/tenancies/
git commit -m "feat(tenancy): add /manager/tenancies/[id] detail page"
```

---

## Task 7: Final check & push

- [ ] **Step 1: Full build**

```bash
npm run build 2>&1 | tail -20
```
Expected: build succeeds with no errors

- [ ] **Step 2: Manual smoke test**

1. Log in as `manager@demo.com` (password: `Demo1234!`)
2. Go to `/manager/rent` → Tenancies tab
3. Click **New Tenancy** — fill form, submit → row appears
4. Click **Edit** on a row → dialog opens with pre-filled values, save → row updates
5. Click a row → navigates to `/manager/tenancies/[id]`
6. On detail page, click **Record** on a PENDING payment → fill form, save → status changes to PAID/PARTIAL
7. Back on list, click **Mark Overdue** → any past-due PENDING payments become OVERDUE
8. Click **End** on a tenancy → confirms, row disappears from active list

- [ ] **Step 3: Push**

```bash
git push origin main
```
