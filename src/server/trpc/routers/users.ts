import { z } from "zod";
import {
  createTRPCRouter,
  superAdminProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";
import { sendWelcomeInviteEmail } from "@/lib/email/send";
import { createNotification } from "@/server/trpc/lib/create-notification";
import { ROLE_RANK } from "@/lib/auth/roles";
import { normalizeEmail } from "@/lib/auth/invitations";
import { roleCanTargetBuilding, roleRequiresUnit } from "@/lib/auth/invite-scope";
import { TRPCError } from "@trpc/server";

const ROLE_ENUM = z.enum([
  "SUPER_ADMIN",
  "BUILDING_MANAGER",
  "RECEPTION",
  "OWNER",
  "TENANT",
]);

const MANAGER_INVITE_ROLE_ENUM = z.enum(["OWNER", "TENANT"]);
const INVITE_LIFECYCLE_INPUT = z.object({ id: z.string() });

async function sendInvitationEmail(
  ctx: { db: { organisation: { findUnique: Function }; building: { findUnique: Function } } },
  invite: {
    email: string;
    organisationId: string;
    buildingId: string | null;
    role: z.infer<typeof ROLE_ENUM>;
    token: string;
    expiresAt: Date;
  }
) {
  const [org, building] = await Promise.all([
    ctx.db.organisation.findUnique({
      where: { id: invite.organisationId },
      select: { name: true },
    }),
    invite.buildingId
      ? ctx.db.building.findUnique({
          where: { id: invite.buildingId },
          select: { name: true },
        })
      : Promise.resolve(null),
  ]);

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`;
  void sendWelcomeInviteEmail(invite.email, {
    organisationName: org?.name ?? "StrataHub",
    buildingName: building?.name,
    role: invite.role,
    inviteUrl,
    expiresAt: invite.expiresAt,
  });
}

export const usersRouter = createTRPCRouter({
  list: superAdminProcedure
    .input(z.object({ search: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.user.findMany({
        where: {
          // Show all active registered users, including people who have
          // created an account but have not been assigned yet.
          isActive: true,
          ...(input.search
            ? {
                AND: [
                  {
                    OR: [
                      { firstName: { contains: input.search, mode: "insensitive" } },
                      { lastName: { contains: input.search, mode: "insensitive" } },
                      { email: { contains: input.search, mode: "insensitive" } },
                    ],
                  },
                ],
              }
            : {}),
        },
        include: {
          orgMemberships: {
            where: { isActive: true },
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
        supabaseAuthId: true,
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
        unitId: z.string().optional(),
        role: ROLE_ENUM,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      if (roleRequiresUnit(input.role) && (!input.buildingId || !input.unitId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Owner and tenant invites must target a specific building and unit.",
        });
      }

      if (!roleCanTargetBuilding(input.role) && (input.buildingId || input.unitId)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Super admin invites should not be scoped to a building or unit.",
        });
      }

      if (!roleRequiresUnit(input.role) && input.unitId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only owner and tenant invites can target a unit.",
        });
      }

      if (input.unitId) {
        const unit = await ctx.db.unit.findUnique({
          where: { id: input.unitId },
          select: { id: true, buildingId: true, building: { select: { organisationId: true } } },
        });

        if (!unit || unit.buildingId !== input.buildingId || unit.building.organisationId !== input.organisationId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "The selected unit must belong to the selected building and organisation.",
          });
        }
      }

      const invite = await ctx.db.invitation.create({
        data: {
          email,
          organisationId: input.organisationId,
          buildingId: input.buildingId,
          unitId: input.unitId,
          role: input.role,
          expiresAt,
        },
      });

      await sendInvitationEmail(ctx, invite);

      // If the invitee already has an account, send an in-app notification (fire-and-forget)
      void ctx.db.user.findFirst({ where: { email }, select: { id: true } }).then(async (existing) => {
        if (!existing) return;
        const [org, building] = await Promise.all([
          ctx.db.organisation.findUnique({ where: { id: input.organisationId }, select: { name: true } }),
          input.buildingId
            ? ctx.db.building.findUnique({ where: { id: input.buildingId }, select: { name: true } })
            : Promise.resolve(null),
        ]);
        return createNotification(ctx.db, {
          userId: existing.id,
          type: "INVITE_SENT",
          title: "You have a new invitation",
          body: `Join ${org?.name ?? "StrataHub"}${building?.name ? ` — ${building.name}` : ""}`,
          linkUrl: `/invite/${invite.token}`,
        });
      }).catch((err) => console.error("[notification] INVITE_SENT failed:", err));

      return invite;
    }),

  createManagerInvite: protectedProcedure
    .input(
      z.object({
        email: z.string().email(),
        buildingId: z.string(),
        unitId: z.string(),
        role: MANAGER_INVITE_ROLE_ENUM,
      })
    )
    .mutation(async ({ ctx, input }) => {
      const email = normalizeEmail(input.email);
      const isSuperAdmin = ctx.user!.orgMemberships.some(
        (membership) => membership.role === "SUPER_ADMIN"
      );
      const isBuildingManagerForBuilding = ctx.user!.buildingAssignments.some(
        (assignment) =>
          assignment.buildingId === input.buildingId &&
          assignment.role === "BUILDING_MANAGER"
      );

      if (!isSuperAdmin && !isBuildingManagerForBuilding) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only a building manager can invite residents into this building.",
        });
      }

      const building = await ctx.db.building.findUniqueOrThrow({
        where: { id: input.buildingId },
        select: {
          id: true,
          name: true,
          organisationId: true,
          organisation: { select: { name: true } },
        },
      });

      const unit = await ctx.db.unit.findUnique({
        where: { id: input.unitId },
        select: { id: true, buildingId: true, unitNumber: true },
      });

      if (!unit || unit.buildingId !== building.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Resident invites must target a unit in the selected building.",
        });
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const invite = await ctx.db.invitation.create({
        data: {
          email,
          organisationId: building.organisationId,
          buildingId: building.id,
          unitId: unit.id,
          role: input.role,
          expiresAt,
        },
      });

      await sendInvitationEmail(ctx, invite);

      // If the invitee already has an account, send an in-app notification (fire-and-forget)
      void ctx.db.user.findFirst({ where: { email }, select: { id: true } }).then((existing) => {
        if (!existing) return;
        return createNotification(ctx.db, {
          userId: existing.id,
          type: "INVITE_SENT",
          title: "You have a new invitation",
          body: `Join ${building.organisation.name} — Unit ${unit.unitNumber}`,
          linkUrl: `/invite/${invite.token}`,
        });
      }).catch((err) => console.error("[notification] MANAGER_INVITE_SENT failed:", err));

      return invite;
    }),

  listInvites: superAdminProcedure
    .input(z.object({ organisationId: z.string().optional() }))
    .query(async ({ ctx, input }) => {
      return ctx.db.invitation.findMany({
        where: {
          ...(input.organisationId
            ? { organisationId: input.organisationId }
            : {}),
        },
        orderBy: { createdAt: "desc" },
      });
    }),

  revokeInvite: superAdminProcedure
    .input(INVITE_LIFECYCLE_INPUT)
    .mutation(async ({ ctx, input }) => {
      const invite = await ctx.db.invitation.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (invite.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Accepted invites cannot be revoked.",
        });
      }

      if (invite.revokedAt) {
        return invite;
      }

      return ctx.db.invitation.update({
        where: { id: invite.id },
        data: { revokedAt: new Date() },
      });
    }),

  resendInvite: superAdminProcedure
    .input(INVITE_LIFECYCLE_INPUT)
    .mutation(async ({ ctx, input }) => {
      const existingInvite = await ctx.db.invitation.findUniqueOrThrow({
        where: { id: input.id },
      });

      if (existingInvite.acceptedAt) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Accepted invites do not need to be resent.",
        });
      }

      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const resentInvite = await ctx.db.$transaction(async (tx) => {
        if (!existingInvite.revokedAt && existingInvite.expiresAt > new Date()) {
          await tx.invitation.update({
            where: { id: existingInvite.id },
            data: { revokedAt: new Date() },
          });
        }

        return tx.invitation.create({
          data: {
            email: existingInvite.email,
            organisationId: existingInvite.organisationId,
            buildingId: existingInvite.buildingId,
            unitId: existingInvite.unitId,
            role: existingInvite.role,
            expiresAt,
          },
        });
      });

      await sendInvitationEmail(ctx, resentInvite);
      return resentInvite;
    }),

  deactivateAssignments: superAdminProcedure
    .input(z.object({ userId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await Promise.all([
        ctx.db.user.update({
          where: { id: input.userId },
          data: { isActive: false },
        }),
        ctx.db.buildingAssignment.updateMany({
          where: { userId: input.userId },
          data: { isActive: false },
        }),
        ctx.db.organisationMembership.updateMany({
          where: { userId: input.userId },
          data: { isActive: false },
        }),
      ]);
      return { success: true };
    }),
});
