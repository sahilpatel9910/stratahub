import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  managerProcedure,
  type Context,
} from "@/server/trpc/trpc";
import { hasBuildingManagementAccess } from "@/server/auth/building-access";

async function assertResidentManagementAccess(ctx: Context, residentId: string) {
  const resident = await ctx.db.user.findUniqueOrThrow({
    where: { id: residentId },
    select: {
      buildingAssignments: {
        where: { isActive: true },
        select: { buildingId: true },
      },
      ownerships: {
        where: { isActive: true },
        select: { unit: { select: { buildingId: true } } },
      },
      tenancies: {
        where: { isActive: true },
        select: { unit: { select: { buildingId: true } } },
      },
    },
  });

  const buildingIds = new Set<string>([
    ...resident.buildingAssignments.map((assignment) => assignment.buildingId),
    ...resident.ownerships.map((ownership) => ownership.unit.buildingId),
    ...resident.tenancies.map((tenancy) => tenancy.unit.buildingId),
  ]);

  const allowed = Array.from(buildingIds).some((buildingId) =>
    hasBuildingManagementAccess(ctx.user!, buildingId)
  );

  if (!allowed) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to manage this resident.",
    });
  }
}

export const residentsRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        role: z.enum(["OWNER", "TENANT"]).optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (!hasBuildingManagementAccess(ctx.user!, input.buildingId)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to manage this building.",
        });
      }

      const buildingAssignments = await ctx.db.buildingAssignment.findMany({
        where: {
          buildingId: input.buildingId,
          isActive: true,
          ...(input.role ? { role: input.role } : { role: { in: ["OWNER", "TENANT"] } }),
        },
        include: {
          user: {
            include: {
              emergencyContacts: true,
              ownerships: {
                where: { isActive: true },
                include: { unit: { select: { unitNumber: true, id: true } } },
              },
              tenancies: {
                where: { isActive: true },
                include: { unit: { select: { unitNumber: true, id: true } } },
              },
            },
          },
        },
      });

      let residents = buildingAssignments.map((ba) => ({
        ...ba.user,
        buildingRole: ba.role,
      }));

      if (input.search) {
        const term = input.search.toLowerCase();
        residents = residents.filter(
          (r) =>
            r.firstName.toLowerCase().includes(term) ||
            r.lastName.toLowerCase().includes(term) ||
            r.email.toLowerCase().includes(term)
        );
      }

      return residents;
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertResidentManagementAccess(ctx, input.id);

      return ctx.db.user.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          emergencyContacts: true,
          ownerships: {
            include: { unit: { include: { building: true } } },
          },
          tenancies: {
            include: {
              unit: { include: { building: true } },
              rentPayments: { orderBy: { dueDate: "desc" }, take: 12 },
              bondRecord: true,
            },
          },
          buildingAssignments: {
            include: { building: true },
          },
        },
      });
    }),

  addEmergencyContact: managerProcedure
    .input(
      z.object({
        userId: z.string(),
        name: z.string().min(1),
        relationship: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      await assertResidentManagementAccess(ctx, input.userId);

      return ctx.db.emergencyContact.create({ data: input });
    }),

  removeEmergencyContact: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const contact = await ctx.db.emergencyContact.findUniqueOrThrow({
        where: { id: input.id },
        select: { userId: true },
      });

      await assertResidentManagementAccess(ctx, contact.userId);

      return ctx.db.emergencyContact.delete({ where: { id: input.id } });
    }),
});
