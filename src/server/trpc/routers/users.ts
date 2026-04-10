import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  superAdminProcedure,
  managerProcedure,
} from "@/server/trpc/trpc";

const ROLE_ENUM = z.enum([
  "SUPER_ADMIN",
  "BUILDING_MANAGER",
  "RECEPTION",
  "OWNER",
  "TENANT",
]);

export const usersRouter = createTRPCRouter({
  list: superAdminProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findMany({
        where: input.search
          ? {
              OR: [
                { firstName: { contains: input.search, mode: "insensitive" } },
                { lastName: { contains: input.search, mode: "insensitive" } },
                { email: { contains: input.search, mode: "insensitive" } },
              ],
            }
          : undefined,
        include: {
          orgMemberships: {
            include: { organisation: { select: { name: true } } },
          },
          buildingAssignments: {
            where: { isActive: true },
            include: { building: { select: { name: true } } },
          },
        },
        orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
      });
    }),

  // Assign an existing user to a building + org
  assignToBuilding: superAdminProcedure
    .input(
      z.object({
        userId: z.string(),
        organisationId: z.string(),
        buildingId: z.string(),
        role: ROLE_ENUM,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { userId, organisationId, buildingId, role } = input;

      // Upsert org membership
      await ctx.db.organisationMembership.upsert({
        where: { userId_organisationId: { userId, organisationId } },
        create: { userId, organisationId, role },
        update: { role, isActive: true },
      });

      // Upsert building assignment
      // The unique constraint is (userId, buildingId, role) — use updateMany + create pattern
      const existing = await ctx.db.buildingAssignment.findFirst({
        where: { userId, buildingId },
      });

      if (existing) {
        await ctx.db.buildingAssignment.update({
          where: { id: existing.id },
          data: { role, isActive: true },
        });
      } else {
        await ctx.db.buildingAssignment.create({
          data: { userId, buildingId, role },
        });
      }

      return { success: true };
    }),

  // Create an invite link for a new (or existing) user
  createInvite: superAdminProcedure
    .input(
      z.object({
        email: z.string().email(),
        organisationId: z.string(),
        buildingId: z.string().optional(),
        role: ROLE_ENUM,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await ctx.db.invitation.create({
        data: {
          email: input.email,
          organisationId: input.organisationId,
          buildingId: input.buildingId,
          role: input.role,
          expiresAt,
        },
      });

      return invite;
    }),

  listInvites: superAdminProcedure
    .input(z.object({ organisationId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.invitation.findMany({
        where: {
          acceptedAt: null,
          expiresAt: { gt: new Date() },
          ...(input.organisationId
            ? { organisationId: input.organisationId }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  revokeInvite: superAdminProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.invitation.delete({ where: { id: input.id } });
    }),

  deactivateAssignments: superAdminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.buildingAssignment.updateMany({
        where: { userId: input.userId },
        data: { isActive: false },
      });
    }),
});
