import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  createTRPCRouter,
  superAdminProcedure,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { sendWelcomeInviteEmail } from "@/lib/email/send";
import type { UserRole } from "@/generated/prisma/client";

const ROLE_RANK: Record<UserRole, number> = {
  TENANT: 0,
  OWNER: 1,
  RECEPTION: 2,
  BUILDING_MANAGER: 3,
  SUPER_ADMIN: 4,
};

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

  // Current user's own profile
  getMe: protectedProcedure.query(async ({ ctx }) => {
    return ctx.db.user.findUnique({
      where: { id: ctx.user!.id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        avatarUrl: true,
        createdAt: true,
        orgMemberships: {
          where: { isActive: true },
          select: { role: true, organisation: { select: { name: true } } },
        },
      },
    });
  }),

  updateMe: protectedProcedure
    .input(
      z.object({
        firstName: z.string().min(1).optional(),
        lastName: z.string().optional(),
        phone: z.string().optional().nullable(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.user.update({
        where: { id: ctx.user!.id },
        data: input,
      });
    }),

  // Assign an existing user to a building + org — never downgrades existing role
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

      // Upsert org membership — only upgrade, never downgrade
      const existingMembership = await ctx.db.organisationMembership.findUnique({
        where: { userId_organisationId: { userId, organisationId } },
      });
      if (!existingMembership) {
        await ctx.db.organisationMembership.create({
          data: { userId, organisationId, role },
        });
      } else {
        await ctx.db.organisationMembership.update({
          where: { userId_organisationId: { userId, organisationId } },
          data: {
            isActive: true,
            ...(ROLE_RANK[role] > ROLE_RANK[existingMembership.role] ? { role } : {}),
          },
        });
      }

      // Upsert building assignment — only upgrade, never downgrade
      const existingAssignment = await ctx.db.buildingAssignment.findFirst({
        where: { userId, buildingId },
      });
      if (!existingAssignment) {
        await ctx.db.buildingAssignment.create({
          data: { userId, buildingId, role },
        });
      } else {
        await ctx.db.buildingAssignment.update({
          where: { id: existingAssignment.id },
          data: {
            isActive: true,
            ...(ROLE_RANK[role] > ROLE_RANK[existingAssignment.role] ? { role } : {}),
          },
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

      // Send invite email (fire-and-forget)
      const [org, building] = await Promise.all([
        ctx.db.organisation.findUnique({ where: { id: input.organisationId }, select: { name: true } }),
        input.buildingId
          ? ctx.db.building.findUnique({ where: { id: input.buildingId }, select: { name: true } })
          : Promise.resolve(null),
      ]);
      const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`;
      void sendWelcomeInviteEmail(input.email, {
        organisationName: org?.name ?? "StrataHub",
        buildingName: building?.name,
        role: input.role,
        inviteUrl,
        expiresAt,
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
