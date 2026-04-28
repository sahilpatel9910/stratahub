# Branch 17 — Inspections & Condition Reports Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Managers and reception can schedule inspections, fill a room-by-room condition report with photos, and complete it — completed reports appear in the resident's documents.

**Architecture:** New Prisma models (Inspection, InspectionRoom, InspectionItem, InspectionImage). New `inspection` tRPC router using `managerProcedure` throughout (BUILDING_MANAGER + RECEPTION). Manager gets `/manager/inspections` list + `/manager/inspections/[id]` detail/report page. Residents see `/resident/inspections` read-only. Photo upload uses the same two-step signed-URL pattern as maintenance images (bucket: `inspections`).

**Tech Stack:** Next.js 16 App Router, tRPC v11, Prisma 7, Supabase Storage, TanStack Query v5, shadcn/ui, Tailwind v4

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `prisma/schema.prisma` | Add Inspection, InspectionRoom, InspectionItem, InspectionImage models + enums |
| Create | `src/server/trpc/routers/inspection.ts` | All inspection procedures |
| Modify | `src/server/trpc/router.ts` | Register inspectionRouter |
| Create | `src/app/api/storage/inspection-upload-url/route.ts` | Signed upload URL endpoint |
| Create | `src/app/(dashboard)/manager/inspections/page.tsx` | RSC list wrapper |
| Create | `src/app/(dashboard)/manager/inspections/_client.tsx` | Inspection list with create dialog |
| Create | `src/app/(dashboard)/manager/inspections/loading.tsx` | Skeleton |
| Create | `src/app/(dashboard)/manager/inspections/[id]/page.tsx` | RSC detail wrapper |
| Create | `src/app/(dashboard)/manager/inspections/[id]/_client.tsx` | Condition report editor + photo upload |
| Create | `src/app/(dashboard)/manager/inspections/[id]/loading.tsx` | Skeleton |
| Create | `src/app/(dashboard)/resident/inspections/page.tsx` | Resident read-only view |
| Create | `src/app/(dashboard)/resident/inspections/_client.tsx` | Resident inspections list |
| Modify | `src/components/layout/app-sidebar.tsx` | Add Inspections nav item (manager) |
| Modify | `src/components/layout/resident-sidebar.tsx` | Add Inspections nav item (resident) |

---

## Task 1: Schema — add Inspection models

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add enums** (after existing enums block)

```prisma
enum InspectionType {
  ROUTINE
  ENTRY
  EXIT
  EMERGENCY
}

enum InspectionStatus {
  SCHEDULED
  COMPLETED
  CANCELLED
}

enum InspectionItemStatus {
  PASS
  FAIL
  NA
}
```

- [ ] **Step 2: Add models** (after existing models)

```prisma
model Inspection {
  id            String           @id @default(cuid())
  unitId        String
  type          InspectionType
  status        InspectionStatus @default(SCHEDULED)
  scheduledAt   DateTime
  completedAt   DateTime?
  notes         String?
  inspectedById String
  createdAt     DateTime         @default(now())
  updatedAt     DateTime         @updatedAt

  unit        Unit             @relation(fields: [unitId], references: [id])
  inspectedBy User             @relation("InspectionsCreated", fields: [inspectedById], references: [id])
  rooms       InspectionRoom[]
  images      InspectionImage[]

  @@map("inspections")
}

model InspectionRoom {
  id           String  @id @default(cuid())
  inspectionId String
  name         String
  order        Int     @default(0)

  inspection Inspection      @relation(fields: [inspectionId], references: [id], onDelete: Cascade)
  items      InspectionItem[]

  @@map("inspection_rooms")
}

model InspectionItem {
  id     String              @id @default(cuid())
  roomId String
  label  String
  status InspectionItemStatus @default(NA)
  note   String?

  room InspectionRoom @relation(fields: [roomId], references: [id], onDelete: Cascade)

  @@map("inspection_items")
}

model InspectionImage {
  id           String   @id @default(cuid())
  inspectionId String
  storagePath  String
  caption      String?
  createdAt    DateTime @default(now())

  inspection Inspection @relation(fields: [inspectionId], references: [id], onDelete: Cascade)

  @@map("inspection_images")
}
```

- [ ] **Step 3: Add relation on User model**

Find the `User` model and add:

```prisma
  inspectionsCreated Inspection[] @relation("InspectionsCreated")
```

- [ ] **Step 4: Add relation on Unit model**

Find the `Unit` model and add:

```prisma
  inspections Inspection[]
```

- [ ] **Step 5: Push schema**

```bash
npx prisma db push
npx prisma generate
```
Expected: schema applied, client regenerated

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma src/generated/
git commit -m "feat(inspections): add Inspection schema models"
```

---

## Task 2: Inspection tRPC router

**Files:**
- Create: `src/server/trpc/routers/inspection.ts`

- [ ] **Step 1: Create the router**

```typescript
import { z } from "zod";
import { createTRPCRouter, managerProcedure, protectedProcedure } from "@/server/trpc/trpc";
import { TRPCError } from "@trpc/server";
import {
  assertBuildingOperationsAccess,
  hasBuildingOperationsAccess,
} from "@/server/auth/building-access";
import { createAdminClient } from "@/lib/supabase/admin";
import { createNotification } from "@/server/trpc/lib/create-notification";

const INSPECTION_BUCKET = "inspections";

const typeEnum = z.enum(["ROUTINE", "ENTRY", "EXIT", "EMERGENCY"]);
const statusEnum = z.enum(["SCHEDULED", "COMPLETED", "CANCELLED"]);
const itemStatusEnum = z.enum(["PASS", "FAIL", "NA"]);

export const inspectionRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        status: statusEnum.optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.inspection.findMany({
        where: {
          unit: { buildingId: input.buildingId },
          ...(input.status ? { status: input.status } : {}),
        },
        include: {
          unit: { select: { unitNumber: true } },
          inspectedBy: { select: { firstName: true, lastName: true } },
          _count: { select: { rooms: true, images: true } },
        },
        orderBy: { scheduledAt: "desc" },
      });
    }),

  listByUnit: protectedProcedure
    .input(z.object({ unitId: z.string() }))
    .query(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });

      // Resident must own or rent the unit; managers can always see it
      if (!hasBuildingOperationsAccess(ctx.user!, unit.buildingId)) {
        const [ownership, tenancy] = await Promise.all([
          ctx.db.ownership.findFirst({ where: { userId: ctx.user!.id, unitId: input.unitId, isActive: true } }),
          ctx.db.tenancy.findFirst({ where: { userId: ctx.user!.id, unitId: input.unitId, isActive: true } }),
        ]);
        if (!ownership && !tenancy) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied." });
        }
      }

      return ctx.db.inspection.findMany({
        where: { unitId: input.unitId },
        include: {
          inspectedBy: { select: { firstName: true, lastName: true } },
          _count: { select: { rooms: true } },
        },
        orderBy: { scheduledAt: "desc" },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const inspection = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, inspection.unit.buildingId);

      const result = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          unit: { include: { building: { select: { name: true, suburb: true } } } },
          inspectedBy: { select: { firstName: true, lastName: true } },
          rooms: {
            include: { items: { orderBy: { id: "asc" } } },
            orderBy: { order: "asc" },
          },
          images: { orderBy: { createdAt: "asc" } },
        },
      });

      // Generate signed URLs for images
      const paths = result.images.map((img) => img.storagePath).filter(Boolean);
      let imagesWithUrls = result.images.map((img) => ({ ...img, displayUrl: null as string | null }));

      if (paths.length > 0) {
        try {
          const admin = createAdminClient();
          const { data } = await admin.storage.from(INSPECTION_BUCKET).createSignedUrls(paths, 3600);
          if (data) {
            const urlByPath = new Map(data.map((d) => [d.path, d.signedUrl ?? null]));
            imagesWithUrls = result.images.map((img) => ({
              ...img,
              displayUrl: urlByPath.get(img.storagePath) ?? null,
            }));
          }
        } catch (err) {
          console.error("[inspection] signed URL error:", err);
        }
      }

      return { ...result, images: imagesWithUrls };
    }),

  create: managerProcedure
    .input(
      z.object({
        unitId: z.string(),
        type: typeEnum,
        scheduledAt: z.string().transform((s) => new Date(s)),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, unit.buildingId);

      const inspection = await ctx.db.inspection.create({
        data: { ...input, inspectedById: ctx.user!.id },
        include: { unit: { select: { unitNumber: true } } },
      });

      // Notify resident(s) of the unit
      try {
        const [ownerships, tenancies] = await Promise.all([
          ctx.db.ownership.findMany({ where: { unitId: input.unitId, isActive: true }, select: { userId: true } }),
          ctx.db.tenancy.findMany({ where: { unitId: input.unitId, isActive: true }, select: { userId: true } }),
        ]);
        const userIds = [...new Set([...ownerships, ...tenancies].map((r) => r.userId))];
        await Promise.all(
          userIds.map((userId) =>
            createNotification(ctx.db, {
              userId,
              type: "MAINTENANCE_STATUS_UPDATED", // reuse closest type
              title: `Inspection scheduled for Unit ${inspection.unit.unitNumber}`,
              body: `${input.type} inspection on ${new Date(input.scheduledAt).toLocaleDateString("en-AU")}`,
              linkUrl: "/resident/inspections",
            })
          )
        );
      } catch (err) {
        console.error("[inspection] notification error:", err);
      }

      return inspection;
    }),

  update: managerProcedure
    .input(
      z.object({
        id: z.string(),
        scheduledAt: z.string().transform((s) => new Date(s)).optional(),
        notes: z.string().optional(),
        type: typeEnum.optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspection.update({ where: { id }, data });
    }),

  cancel: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspection.update({ where: { id: input.id }, data: { status: "CANCELLED" } });
    }),

  complete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.id },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspection.update({
        where: { id: input.id },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
    }),

  addRoom: managerProcedure
    .input(z.object({ inspectionId: z.string(), name: z.string().min(1), order: z.number().default(0) }))
    .mutation(async ({ ctx, input }) => {
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.inspectionId },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspectionRoom.create({ data: input });
    }),

  updateRoom: managerProcedure
    .input(z.object({ id: z.string(), name: z.string().min(1).optional(), order: z.number().optional() }))
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const room = await ctx.db.inspectionRoom.findUniqueOrThrow({
        where: { id },
        include: { inspection: { select: { unit: { select: { buildingId: true } } } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, room.inspection.unit.buildingId);
      return ctx.db.inspectionRoom.update({ where: { id }, data });
    }),

  deleteRoom: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.inspectionRoom.findUniqueOrThrow({
        where: { id: input.id },
        include: { inspection: { select: { unit: { select: { buildingId: true } } } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, room.inspection.unit.buildingId);
      return ctx.db.inspectionRoom.delete({ where: { id: input.id } });
    }),

  addItem: managerProcedure
    .input(z.object({ roomId: z.string(), label: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const room = await ctx.db.inspectionRoom.findUniqueOrThrow({
        where: { id: input.roomId },
        include: { inspection: { select: { unit: { select: { buildingId: true } } } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, room.inspection.unit.buildingId);
      return ctx.db.inspectionItem.create({ data: { roomId: input.roomId, label: input.label } });
    }),

  updateItem: managerProcedure
    .input(
      z.object({
        id: z.string(),
        status: itemStatusEnum.optional(),
        note: z.string().optional(),
        label: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const item = await ctx.db.inspectionItem.findUniqueOrThrow({
        where: { id },
        include: {
          room: { include: { inspection: { select: { unit: { select: { buildingId: true } } } } } },
        },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, item.room.inspection.unit.buildingId);
      return ctx.db.inspectionItem.update({ where: { id }, data });
    }),

  deleteItem: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const item = await ctx.db.inspectionItem.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          room: { include: { inspection: { select: { unit: { select: { buildingId: true } } } } } },
        },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, item.room.inspection.unit.buildingId);
      return ctx.db.inspectionItem.delete({ where: { id: input.id } });
    }),

  addImage: managerProcedure
    .input(z.object({ inspectionId: z.string(), storagePath: z.string().min(1), caption: z.string().optional() }))
    .mutation(async ({ ctx, input }) => {
      const insp = await ctx.db.inspection.findUniqueOrThrow({
        where: { id: input.inspectionId },
        select: { unit: { select: { buildingId: true } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, insp.unit.buildingId);
      return ctx.db.inspectionImage.create({ data: input });
    }),

  deleteImage: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const image = await ctx.db.inspectionImage.findUniqueOrThrow({
        where: { id: input.id },
        include: { inspection: { select: { unit: { select: { buildingId: true } } } } },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, image.inspection.unit.buildingId);

      try {
        const admin = createAdminClient();
        await admin.storage.from(INSPECTION_BUCKET).remove([image.storagePath]);
      } catch (err) {
        console.error("[inspection] storage delete error:", err);
      }

      return ctx.db.inspectionImage.delete({ where: { id: input.id } });
    }),
});
```

- [ ] **Step 2: Register in router.ts**

```typescript
import { inspectionRouter } from "./routers/inspection";
// inside createTRPCRouter:
  inspection: inspectionRouter,
```

- [ ] **Step 3: Type check**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add src/server/trpc/routers/inspection.ts src/server/trpc/router.ts
git commit -m "feat(inspections): add inspection tRPC router"
```

---

## Task 3: Signed upload URL API route

**Files:**
- Create: `src/app/api/storage/inspection-upload-url/route.ts`

- [ ] **Step 1: Create the route**

Copy the pattern from the existing maintenance upload route. Read `src/app/api/storage/maintenance-upload-url/route.ts` first, then create:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { db } from "@/lib/db";

const BUCKET = "inspections";

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { filename, contentType, inspectionId } = await req.json() as {
    filename: string;
    contentType: string;
    inspectionId: string;
  };

  if (!filename || !contentType || !inspectionId) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const path = `${inspectionId}/${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
  const adminClient = createAdminClient();
  const { data, error } = await adminClient.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data) {
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }

  return NextResponse.json({ signedUrl: data.signedUrl, path });
}
```

- [ ] **Step 2: Create the `inspections` bucket in Supabase**

In Supabase dashboard → Storage → New bucket: name `inspections`, private (not public).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/storage/inspection-upload-url/
git commit -m "feat(inspections): add inspection upload URL API route"
```

---

## Task 4: Manager inspections list page

**Files:**
- Create: `src/app/(dashboard)/manager/inspections/loading.tsx`
- Create: `src/app/(dashboard)/manager/inspections/page.tsx`
- Create: `src/app/(dashboard)/manager/inspections/_client.tsx`

- [ ] **Step 1: Create loading.tsx**

```typescript
export default function InspectionsLoading() {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Create page.tsx**

```typescript
import { createServerTRPC } from "@/lib/trpc/server";
import InspectionsClient from "./_client";

export default async function InspectionsPage() {
  const { trpc, HydrateClient, ctx } = await createServerTRPC();

  const assignments = ctx.user?.buildingAssignments ?? [];
  const buildingId = assignments.length === 1 ? assignments[0].buildingId : undefined;

  if (buildingId) {
    await trpc.inspection.listByBuilding.prefetch({ buildingId });
  }

  return (
    <HydrateClient>
      <InspectionsClient />
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Create _client.tsx**

```typescript
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { useBuildingContext } from "@/hooks/use-building-context";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ClipboardList, Plus } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  ROUTINE: "Routine", ENTRY: "Entry", EXIT: "Exit", EMERGENCY: "Emergency",
};
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });
}

export default function InspectionsClient() {
  const router = useRouter();
  const { selectedBuildingId } = useBuildingContext();
  const utils = trpc.useUtils();

  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    unitId: "",
    type: "ROUTINE" as "ROUTINE" | "ENTRY" | "EXIT" | "EMERGENCY",
    scheduledAt: "",
    notes: "",
  });

  const query = trpc.inspection.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken,
    { placeholderData: (prev) => prev }
  );
  const unitsQuery = trpc.units.listByBuilding.useQuery(
    selectedBuildingId ? { buildingId: selectedBuildingId } : skipToken
  );

  const createMutation = trpc.inspection.create.useMutation({
    onSuccess: () => {
      toast.success("Inspection scheduled");
      void utils.inspection.listByBuilding.invalidate();
      setCreateOpen(false);
      setForm({ unitId: "", type: "ROUTINE", scheduledAt: "", notes: "" });
    },
    onError: (e) => toast.error(e.message ?? "Failed to schedule inspection"),
  });

  const cancelMutation = trpc.inspection.cancel.useMutation({
    onSuccess: () => {
      toast.success("Inspection cancelled");
      void utils.inspection.listByBuilding.invalidate();
    },
    onError: (e) => toast.error(e.message ?? "Failed to cancel"),
  });

  const inspections = query.data ?? [];
  const units = unitsQuery.data ?? [];

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-6">
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-label text-primary/80">Manager Workspace</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Inspections
            </h1>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              Schedule and manage property inspections with full condition reports.
            </p>
          </div>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button className="mt-6 h-10 rounded-xl">
                <Plus className="mr-1.5 h-4 w-4" />
                Schedule Inspection
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Schedule Inspection</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <div className="space-y-1.5">
                  <Label>Unit</Label>
                  <Select
                    value={form.unitId}
                    onValueChange={(v) => v !== null && setForm((f) => ({ ...f, unitId: v }))}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue placeholder="Select unit" /></SelectTrigger>
                    <SelectContent>
                      {units.map((u) => (
                        <SelectItem key={u.id} value={u.id}>Unit {u.unitNumber}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => v !== null && setForm((f) => ({ ...f, type: v as typeof form.type }))}
                  >
                    <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(TYPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>Date &amp; time</Label>
                  <Input
                    type="datetime-local"
                    className="rounded-xl"
                    value={form.scheduledAt}
                    onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Notes (optional)</Label>
                  <Input
                    className="rounded-xl"
                    placeholder="Entry instructions, access code…"
                    value={form.notes}
                    onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={createMutation.isPending}>
                  Cancel
                </Button>
                <Button
                  disabled={!form.unitId || !form.scheduledAt || createMutation.isPending}
                  onClick={() =>
                    createMutation.mutate({
                      unitId: form.unitId,
                      type: form.type,
                      scheduledAt: form.scheduledAt,
                      notes: form.notes || undefined,
                    })
                  }
                >
                  {createMutation.isPending ? "Scheduling…" : "Schedule"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="app-panel overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Scheduled</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Rooms</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {query.isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {Array.from({ length: 6 }).map((_, j) => (
                    <TableCell key={j}><div className="h-4 w-20 animate-pulse rounded bg-muted" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : inspections.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <ClipboardList className="h-8 w-8 opacity-40" />
                    <p className="text-sm">No inspections yet. Schedule one to get started.</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              inspections.map((insp) => (
                <TableRow
                  key={insp.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/manager/inspections/${insp.id}`)}
                >
                  <TableCell className="font-medium">Unit {insp.unit.unitNumber}</TableCell>
                  <TableCell>{TYPE_LABELS[insp.type] ?? insp.type}</TableCell>
                  <TableCell>{formatDate(insp.scheduledAt)}</TableCell>
                  <TableCell>
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[insp.status] ?? ""}`}>
                      {insp.status.charAt(0) + insp.status.slice(1).toLowerCase()}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{insp._count.rooms}</TableCell>
                  <TableCell>
                    {insp.status === "SCHEDULED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 rounded-lg text-xs text-red-600 hover:bg-red-50"
                        disabled={cancelMutation.isPending}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("Cancel this inspection?")) {
                            cancelMutation.mutate({ id: insp.id });
                          }
                        }}
                      >
                        Cancel
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/manager/inspections/
git commit -m "feat(inspections): add manager inspections list page"
```

---

## Task 5: Manager inspection detail / condition report page

**Files:**
- Create: `src/app/(dashboard)/manager/inspections/[id]/loading.tsx`
- Create: `src/app/(dashboard)/manager/inspections/[id]/page.tsx`
- Create: `src/app/(dashboard)/manager/inspections/[id]/_client.tsx`

- [ ] **Step 1: Create loading.tsx**

```typescript
export default function InspectionDetailLoading() {
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

- [ ] **Step 2: Create page.tsx**

```typescript
import { createServerTRPC } from "@/lib/trpc/server";
import InspectionDetailClient from "./_client";

export default async function InspectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { trpc, HydrateClient } = await createServerTRPC();
  await trpc.inspection.getById.prefetch({ id });

  return (
    <HydrateClient>
      <InspectionDetailClient id={id} />
    </HydrateClient>
  );
}
```

- [ ] **Step 3: Create _client.tsx**

This file is the condition report editor. It is intentionally long due to the room/item/photo management UI.

```typescript
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { trpc } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, MinusCircle, Plus, Trash2, Upload, X, ImageIcon } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  ROUTINE: "Routine", ENTRY: "Entry", EXIT: "Exit", EMERGENCY: "Emergency",
};
const ITEM_STATUS_ICONS = {
  PASS: <CheckCircle2 className="h-4 w-4 text-green-600" />,
  FAIL: <XCircle className="h-4 w-4 text-red-600" />,
  NA: <MinusCircle className="h-4 w-4 text-muted-foreground" />,
};

export default function InspectionDetailClient({ id }: { id: string }) {
  const utils = trpc.useUtils();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ file: File; previewUrl: string } | null>(null);
  const [newRoomName, setNewRoomName] = useState("");
  const [newItemLabels, setNewItemLabels] = useState<Record<string, string>>({});

  const { data: insp, isLoading, isError } = trpc.inspection.getById.useQuery({ id });

  const invalidate = () => {
    void utils.inspection.getById.invalidate({ id });
    void utils.inspection.listByBuilding.invalidate();
  };

  const completeMutation = trpc.inspection.complete.useMutation({
    onSuccess: () => { toast.success("Inspection completed"); invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to complete"),
  });

  const addRoomMutation = trpc.inspection.addRoom.useMutation({
    onSuccess: () => { invalidate(); setNewRoomName(""); },
    onError: (e) => toast.error(e.message ?? "Failed to add room"),
  });

  const deleteRoomMutation = trpc.inspection.deleteRoom.useMutation({
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to delete room"),
  });

  const addItemMutation = trpc.inspection.addItem.useMutation({
    onSuccess: (_, vars) => {
      invalidate();
      setNewItemLabels((prev) => ({ ...prev, [vars.roomId]: "" }));
    },
    onError: (e) => toast.error(e.message ?? "Failed to add item"),
  });

  const updateItemMutation = trpc.inspection.updateItem.useMutation({
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to update item"),
  });

  const deleteItemMutation = trpc.inspection.deleteItem.useMutation({
    onSuccess: () => { invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to delete item"),
  });

  const addImageMutation = trpc.inspection.addImage.useMutation({
    onSuccess: () => { toast.success("Photo added"); invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to add photo"),
  });

  const deleteImageMutation = trpc.inspection.deleteImage.useMutation({
    onSuccess: () => { toast.success("Photo removed"); invalidate(); },
    onError: (e) => toast.error(e.message ?? "Failed to remove photo"),
  });

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Select an image file"); e.target.value = ""; return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image must be under 10 MB"); e.target.value = ""; return; }
    setPendingFile({ file, previewUrl: URL.createObjectURL(file) });
    e.target.value = "";
  }

  function cancelPendingFile() {
    if (pendingFile) URL.revokeObjectURL(pendingFile.previewUrl);
    setPendingFile(null);
  }

  async function confirmUpload() {
    if (!pendingFile) return;
    setUploading(true);
    try {
      const urlRes = await fetch("/api/storage/inspection-upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: pendingFile.file.name, contentType: pendingFile.file.type, inspectionId: id }),
      });
      if (!urlRes.ok) throw new Error((await urlRes.json().catch(() => ({}))).error ?? "Failed to get upload URL");
      const { signedUrl, path } = (await urlRes.json()) as { signedUrl: string; path: string };
      const uploadRes = await fetch(signedUrl, { method: "PUT", body: pendingFile.file, headers: { "Content-Type": pendingFile.file.type } });
      if (!uploadRes.ok) throw new Error("Upload failed");
      await addImageMutation.mutateAsync({ inspectionId: id, storagePath: path });
      cancelPendingFile();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to upload photo");
      cancelPendingFile();
    } finally {
      setUploading(false);
    }
  }

  if (isLoading) return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <section className="app-panel p-6 md:p-8">
        <Skeleton className="h-10 w-64 rounded-xl" />
        <Skeleton className="mt-4 h-5 w-48 rounded-full" />
      </section>
    </div>
  );

  if (isError || !insp) return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      <section className="app-panel p-6 md:p-8">
        <p className="text-sm text-muted-foreground">Could not load inspection.</p>
        <Link href="/manager/inspections" className="mt-3 inline-flex text-sm text-muted-foreground hover:text-foreground">← Inspections</Link>
      </section>
    </div>
  );

  const isCompleted = insp.status === "COMPLETED";
  const isCancelled = insp.status === "CANCELLED";
  const isEditable = !isCompleted && !isCancelled;

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6">
      {/* Header */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <Link href="/manager/inspections" className="mb-4 flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          ← Inspections
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow-label text-primary/80">Inspection</p>
            <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">
              Unit {insp.unit.unitNumber} — {TYPE_LABELS[insp.type] ?? insp.type}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {insp.unit.building.name}{insp.unit.building.suburb ? `, ${insp.unit.building.suburb}` : ""} ·{" "}
              {new Date(insp.scheduledAt).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
            </p>
          </div>
          {isEditable && (
            <Button
              className="mt-3 h-10 rounded-xl bg-green-600 hover:bg-green-700"
              disabled={completeMutation.isPending}
              onClick={() => completeMutation.mutate({ id })}
            >
              {completeMutation.isPending ? "Completing…" : "Mark Complete"}
            </Button>
          )}
        </div>
        {isCompleted && <Badge className="mt-4 bg-green-100 text-green-800">Completed {insp.completedAt ? new Date(insp.completedAt).toLocaleDateString("en-AU") : ""}</Badge>}
        {isCancelled && <Badge className="mt-4 bg-gray-100 text-gray-600">Cancelled</Badge>}
      </section>

      {/* Condition report — rooms */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow-label">Condition Report</p>
        </div>

        {insp.rooms.length === 0 && (
          <p className="mt-4 text-sm text-muted-foreground">No rooms added yet. Add a room to start the report.</p>
        )}

        <div className="mt-4 space-y-6">
          {insp.rooms.map((room) => (
            <div key={room.id} className="rounded-xl border border-border/60 p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-foreground">{room.name}</p>
                {isEditable && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 rounded-lg p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => deleteRoomMutation.mutate({ id: room.id })}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>

              <div className="mt-3 space-y-2">
                {room.items.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
                    <div className="flex items-center gap-1">
                      {(["PASS", "FAIL", "NA"] as const).map((s) => (
                        <button
                          key={s}
                          disabled={!isEditable || updateItemMutation.isPending}
                          onClick={() => updateItemMutation.mutate({ id: item.id, status: s })}
                          className={`rounded p-1 transition-colors ${item.status === s ? "bg-accent" : "hover:bg-accent/50"}`}
                          title={s}
                        >
                          {ITEM_STATUS_ICONS[s]}
                        </button>
                      ))}
                    </div>
                    <p className="flex-1 text-sm text-foreground">{item.label}</p>
                    {isEditable && (
                      <button
                        onClick={() => deleteItemMutation.mutate({ id: item.id })}
                        className="text-muted-foreground hover:text-red-600"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {isEditable && (
                <div className="mt-3 flex gap-2">
                  <Input
                    className="h-9 rounded-xl bg-background text-sm"
                    placeholder="Add item (e.g. Windows, Flooring)"
                    value={newItemLabels[room.id] ?? ""}
                    onChange={(e) => setNewItemLabels((prev) => ({ ...prev, [room.id]: e.target.value }))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (newItemLabels[room.id] ?? "").trim()) {
                        addItemMutation.mutate({ roomId: room.id, label: (newItemLabels[room.id] ?? "").trim() });
                      }
                    }}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-9 rounded-xl"
                    disabled={!(newItemLabels[room.id] ?? "").trim() || addItemMutation.isPending}
                    onClick={() => addItemMutation.mutate({ roomId: room.id, label: (newItemLabels[room.id] ?? "").trim() })}
                  >
                    Add
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        {isEditable && (
          <div className="mt-5 flex gap-2 border-t border-border/50 pt-5">
            <Input
              className="h-10 max-w-xs rounded-xl bg-background"
              placeholder="Room name (e.g. Kitchen, Bathroom 1)"
              value={newRoomName}
              onChange={(e) => setNewRoomName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && newRoomName.trim()) {
                  addRoomMutation.mutate({ inspectionId: id, name: newRoomName.trim(), order: insp.rooms.length });
                }
              }}
            />
            <Button
              variant="outline"
              className="h-10 rounded-xl"
              disabled={!newRoomName.trim() || addRoomMutation.isPending}
              onClick={() => addRoomMutation.mutate({ inspectionId: id, name: newRoomName.trim(), order: insp.rooms.length })}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Add Room
            </Button>
          </div>
        )}
      </section>

      {/* Photos */}
      <section className="app-panel overflow-hidden p-6 md:p-8">
        <div className="flex items-center justify-between">
          <p className="eyebrow-label">Photos ({insp.images.length})</p>
          {isEditable && (
            <div>
              <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileChange} />
              <Button
                variant="outline"
                size="sm"
                className="h-8 rounded-lg text-xs"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading || addImageMutation.isPending || !!pendingFile}
              >
                <Upload className="mr-1.5 h-3 w-3" />
                Add Photo
              </Button>
            </div>
          )}
        </div>

        {pendingFile && (
          <div className="mt-4 rounded-xl border border-primary/30 bg-primary/5 p-3">
            <div className="flex items-center gap-3">
              <img src={pendingFile.previewUrl} alt="Preview" className="h-20 w-20 rounded-lg border object-cover" />
              <div className="flex-1">
                <p className="truncate text-sm font-medium">{pendingFile.file.name}</p>
                <div className="mt-2 flex gap-2">
                  <Button size="sm" className="h-8 rounded-lg text-xs" disabled={uploading} onClick={confirmUpload}>
                    {uploading ? "Uploading…" : "Upload"}
                  </Button>
                  <Button type="button" size="sm" variant="outline" className="h-8 rounded-lg text-xs" disabled={uploading} onClick={cancelPendingFile}>
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4">
          {insp.images.length === 0 && !pendingFile ? (
            <div className="rounded-xl border border-dashed border-border/70 py-10 text-center text-sm text-muted-foreground">
              <ImageIcon className="mx-auto mb-2 h-8 w-8 opacity-30" />
              No photos yet.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
              {insp.images.map((img) => (
                <div key={img.id} className="group relative aspect-square overflow-hidden rounded-xl border border-border/60 bg-muted/30">
                  {img.displayUrl ? (
                    <img src={img.displayUrl} alt={img.caption ?? "Inspection photo"} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground">
                      <ImageIcon className="h-8 w-8 opacity-30" />
                    </div>
                  )}
                  {isEditable && (
                    <button
                      className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white shadow group-hover:flex"
                      onClick={() => deleteImageMutation.mutate({ id: img.id })}
                      disabled={deleteImageMutation.isPending}
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/manager/inspections/\[id\]/
git commit -m "feat(inspections): add inspection detail + condition report page"
```

---

## Task 6: Resident inspections page + sidebar nav

**Files:**
- Create: `src/app/(dashboard)/resident/inspections/page.tsx`
- Create: `src/app/(dashboard)/resident/inspections/_client.tsx`
- Modify: `src/components/layout/app-sidebar.tsx`
- Modify: `src/components/layout/resident-sidebar.tsx`

- [ ] **Step 1: Create resident page.tsx**

```typescript
import { createServerTRPC } from "@/lib/trpc/server";
import ResidentInspectionsClient from "./_client";

export default async function ResidentInspectionsPage() {
  // Prefetch deferred to client — unitId needed, resolved from tenancy/ownership
  const { HydrateClient } = await createServerTRPC();
  return (
    <HydrateClient>
      <ResidentInspectionsClient />
    </HydrateClient>
  );
}
```

- [ ] **Step 2: Create resident _client.tsx**

```typescript
"use client";

import { skipToken } from "@tanstack/react-query";
import { trpc } from "@/lib/trpc/client";
import { ClipboardList } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  ROUTINE: "Routine", ENTRY: "Entry", EXIT: "Exit", EMERGENCY: "Emergency",
};
const STATUS_STYLES: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-800",
  COMPLETED: "bg-green-100 text-green-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

function formatDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "long", year: "numeric" });
}

export default function ResidentInspectionsClient() {
  const { data: tenancy } = trpc.resident.getMyTenancy.useQuery();

  const unitId = tenancy?.unitId;

  const { data: inspections = [], isLoading } = trpc.inspection.listByUnit.useQuery(
    unitId ? { unitId } : skipToken
  );

  if (!unitId && !isLoading) {
    return (
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <section className="app-panel p-6 md:p-8">
          <p className="eyebrow-label text-primary/80">Resident Workspace</p>
          <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">Inspections</h1>
        </section>
        <section className="app-panel px-6 py-12 text-center">
          <ClipboardList className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-4 font-semibold text-foreground">No unit linked</p>
          <p className="mt-2 text-sm text-muted-foreground">Inspections will appear here once your unit is set up.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <section className="app-panel p-6 md:p-8">
        <p className="eyebrow-label text-primary/80">Resident Workspace</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-foreground md:text-4xl">Inspections</h1>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">Upcoming and past inspections for your unit.</p>
      </section>

      <section className="app-panel overflow-hidden">
        <div className="divide-y divide-border/60">
          {isLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-4">
                <div className="space-y-1.5">
                  <div className="h-4 w-36 animate-pulse rounded bg-muted" />
                  <div className="h-3 w-24 animate-pulse rounded bg-muted" />
                </div>
              </div>
            ))
          ) : inspections.length === 0 ? (
            <div className="px-5 py-12 text-center text-sm text-muted-foreground">
              No inspections scheduled.
            </div>
          ) : (
            inspections.map((insp) => (
              <div key={insp.id} className="flex items-center justify-between px-5 py-4">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {TYPE_LABELS[insp.type] ?? insp.type} inspection
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatDate(insp.scheduledAt)} · {insp.inspectedBy.firstName} {insp.inspectedBy.lastName}
                  </p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_STYLES[insp.status] ?? ""}`}>
                  {insp.status.charAt(0) + insp.status.slice(1).toLowerCase()}
                </span>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 3: Add Inspections to manager sidebar**

In `src/components/layout/app-sidebar.tsx`, find the manager nav items array and add:

```typescript
{ title: "Inspections", href: "/manager/inspections", icon: ClipboardList },
```

Import `ClipboardList` from `lucide-react` if not already imported.

- [ ] **Step 4: Add Inspections to resident sidebar**

In `src/components/layout/resident-sidebar.tsx`, add to `residentNavItems`:

```typescript
{ title: "Inspections", href: "/resident/inspections", icon: ClipboardList },
```

Import `ClipboardList` from `lucide-react`.

- [ ] **Step 5: Type check + commit**

```bash
npx tsc --noEmit 2>&1 | head -20
git add src/app/\(dashboard\)/resident/inspections/ src/components/layout/
git commit -m "feat(inspections): add resident inspections page + sidebar nav"
```

---

## Task 7: Final check & push

- [ ] **Step 1: Full build**

```bash
npm run build 2>&1 | tail -20
```
Expected: succeeds

- [ ] **Step 2: Manual smoke test**

1. Log in as `manager@demo.com`
2. Click **Inspections** in sidebar → list page loads
3. Click **Schedule Inspection** → fill unit/type/date → submit → row appears
4. Click the row → detail page loads
5. Add a room (e.g. "Kitchen") → room card appears
6. Add items to the room (e.g. "Flooring") → item appears with PASS/FAIL/NA buttons
7. Toggle item status → icon updates
8. Upload a photo → two-step upload works, photo grid shows image
9. Click **Mark Complete** → status badge turns green
10. Log in as `tenant1@demo.com` → `/resident/inspections` shows the completed inspection

- [ ] **Step 3: Push**

```bash
git push origin main
```
