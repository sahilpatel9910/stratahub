import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";

export const residentsRouter = createTRPCRouter({
  listByBuilding: protectedProcedure
    .input(
      z.object({
        buildingId: z.string(),
        role: z.enum(["OWNER", "TENANT"]).optional(),
        search: z.string().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
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

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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
      return ctx.db.emergencyContact.create({ data: input });
    }),

  removeEmergencyContact: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.emergencyContact.delete({ where: { id: input.id } });
    }),
});
