import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@/generated/prisma/client";
import {
  createTRPCRouter,
  buildingManagerProcedure,
  managerProcedure,
} from "@/server/trpc/trpc";
import {
  assertBuildingManagementAccess,
  assertBuildingOperationsAccess,
} from "@/server/auth/building-access";
import { ROLE_RANK } from "@/lib/auth/roles";
import { sendWelcomeInviteEmail } from "@/lib/email/send";

function buildRentSchedule({
  tenancyId, leaseStartDate, rentFrequency, rentAmountCents, months, leaseEndDate,
}: {
  tenancyId: string; leaseStartDate: Date; rentFrequency: "WEEKLY" | "FORTNIGHTLY" | "MONTHLY";
  rentAmountCents: number; months: number; leaseEndDate?: Date | null;
}) {
  const start = new Date(leaseStartDate);
  const count = rentFrequency === "WEEKLY" ? months * 4 : rentFrequency === "FORTNIGHTLY" ? months * 2 : months;
  const payments = [];
  for (let i = 0; i < count; i++) {
    const dueDate = new Date(start);
    if (rentFrequency === "WEEKLY") dueDate.setDate(start.getDate() + i * 7);
    else if (rentFrequency === "FORTNIGHTLY") dueDate.setDate(start.getDate() + i * 14);
    else dueDate.setMonth(start.getMonth() + i);
    if (leaseEndDate && dueDate > leaseEndDate) break;
    payments.push({ tenancyId, amountCents: rentAmountCents, dueDate, status: "PENDING" as const });
  }
  return payments;
}

const unitTypeEnum = z.enum([
  "APARTMENT", "STUDIO", "PENTHOUSE", "TOWNHOUSE", "COMMERCIAL", "STORAGE", "PARKING",
]);
const residentRoleEnum = z.enum(["OWNER", "TENANT"]);
const rentFrequencyEnum = z.enum(["WEEKLY", "FORTNIGHTLY", "MONTHLY"]);

async function ensureResidentAccessForUnit(
  db: Prisma.TransactionClient | typeof import("@/server/db/client").db,
  {
    userId,
    organisationId,
    buildingId,
    role,
  }: {
    userId: string;
    organisationId: string;
    buildingId: string;
    role: "OWNER" | "TENANT";
  }
) {
  const existingMembership = await db.organisationMembership.findUnique({
    where: { userId_organisationId: { userId, organisationId } },
  });

  if (!existingMembership) {
    await db.organisationMembership.create({
      data: { userId, organisationId, role },
    });
  } else {
    const currentMembershipRole = existingMembership.role as keyof typeof ROLE_RANK;
    await db.organisationMembership.update({
      where: { userId_organisationId: { userId, organisationId } },
      data: {
        isActive: true,
        ...(ROLE_RANK[role] > ROLE_RANK[currentMembershipRole] ? { role } : {}),
      },
    });
  }

  const existingAssignment = await db.buildingAssignment.findFirst({
    where: { userId, buildingId },
  });

  if (!existingAssignment) {
    await db.buildingAssignment.create({
      data: { userId, buildingId, role },
    });
  } else {
    const currentAssignmentRole = existingAssignment.role as keyof typeof ROLE_RANK;
    await db.buildingAssignment.update({
      where: { id: existingAssignment.id },
      data: {
        isActive: true,
        ...(ROLE_RANK[role] > ROLE_RANK[currentAssignmentRole] ? { role } : {}),
      },
    });
  }
}

export const unitsRouter = createTRPCRouter({
  listByBuilding: managerProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, input.buildingId);

      return ctx.db.unit.findMany({
        where: { buildingId: input.buildingId },
        include: {
          floor: true,
          ownerships: {
            where: { isActive: true },
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
          },
          tenancies: {
            where: { isActive: true },
            include: { user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true } } },
          },
          parkingSpots: true,
          storageUnits: true,
          _count: { select: { maintenanceReqs: true, keyRecords: true } },
        },
        orderBy: { unitNumber: "asc" },
      });
    }),

  getById: managerProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingOperationsAccess(ctx.db, ctx.user!, unit.buildingId);

      return ctx.db.unit.findUniqueOrThrow({
        where: { id: input.id },
        include: {
          building: true,
          floor: true,
          ownerships: { include: { user: true } },
          tenancies: {
            include: {
              user: true,
              rentPayments: { orderBy: { dueDate: "desc" }, take: 12 },
              bondRecord: true,
            },
          },
          maintenanceReqs: { orderBy: { createdAt: "desc" }, take: 10 },
          keyRecords: { where: { isActive: true } },
          parkingSpots: true,
          storageUnits: true,
        },
      });
    }),

  create: buildingManagerProcedure
    .input(
      z.object({
        buildingId: z.string(),
        floorId: z.string().optional(),
        unitNumber: z.string().min(1, "Unit number is required"),
        unitType: unitTypeEnum.default("APARTMENT"),
        bedrooms: z.number().int().min(0).optional(),
        bathrooms: z.number().int().min(0).optional(),
        parkingSpaces: z.number().int().min(0).default(0),
        storageSpaces: z.number().int().min(0).default(0),
        squareMetres: z.number().positive().optional(),
        lotNumber: z.string().optional(),
        unitEntitlement: z.number().positive().optional(),
        ownerFirstName: z.string().min(1, "Owner first name is required"),
        ownerLastName: z.string().min(1, "Owner last name is required"),
        ownerEmail: z.string().email("A valid owner email is required"),
        ownerPhone: z.string().min(1, "Owner phone is required"),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const {
        ownerFirstName,
        ownerLastName,
        ownerEmail,
        ownerPhone,
        ...unitData
      } = input;

      await assertBuildingManagementAccess(ctx.db, ctx.user!, unitData.buildingId);

      const building = await ctx.db.building.findUniqueOrThrow({
        where: { id: unitData.buildingId },
        select: {
          id: true,
          name: true,
          organisationId: true,
          organisation: { select: { name: true } },
        },
      });

      const normalizedOwnerEmail = ownerEmail.trim().toLowerCase();

      try {
        const result = await ctx.db.$transaction(async (tx) => {
          const unit = await tx.unit.create({ data: unitData });

          const existingOwner = await tx.user.findUnique({
            where: { email: normalizedOwnerEmail },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          });

          if (existingOwner) {
            await ensureResidentAccessForUnit(tx, {
              userId: existingOwner.id,
              organisationId: building.organisationId,
              buildingId: building.id,
              role: "OWNER",
            });

            await tx.ownership.updateMany({
              where: { unitId: unit.id, isActive: true },
              data: { isActive: false },
            });

            await tx.tenancy.updateMany({
              where: { unitId: unit.id, isActive: true },
              data: {
                isActive: false,
                moveOutDate: new Date(),
              },
            });

            await tx.ownership.upsert({
              where: {
                userId_unitId: {
                  userId: existingOwner.id,
                  unitId: unit.id,
                },
              },
              create: {
                userId: existingOwner.id,
                unitId: unit.id,
                isPrimary: true,
                ownershipPct: 100,
                purchaseDate: new Date(),
              },
              update: {
                isActive: true,
                isPrimary: true,
                ownershipPct: 100,
                purchaseDate: new Date(),
              },
            });

            await tx.user.update({
              where: { id: existingOwner.id },
              data: {
                firstName: existingOwner.firstName || ownerFirstName.trim(),
                lastName: existingOwner.lastName || ownerLastName.trim(),
                phone: existingOwner.phone || ownerPhone.trim(),
              },
            });

            const updatedUnit = await tx.unit.update({
              where: { id: unit.id },
              data: { isOccupied: true },
            });

            return {
              unit: updatedUnit,
              ownerStatus: "linked" as const,
            };
          }

          const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          const invite = await tx.invitation.create({
            data: {
              email: normalizedOwnerEmail,
              organisationId: building.organisationId,
              buildingId: building.id,
              unitId: unit.id,
              role: "OWNER",
              expiresAt,
            },
          });

          const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invite/${invite.token}`;
          void sendWelcomeInviteEmail(normalizedOwnerEmail, {
            organisationName: building.organisation.name,
            buildingName: building.name,
            role: "OWNER",
            inviteUrl,
            expiresAt,
          });

          return {
            unit,
            ownerStatus: "invited" as const,
            ownerInviteToken: invite.token,
          };
        });

        return result;
      } catch (error) {
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          error.code === "P2002"
        ) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A unit with this number already exists in this building.",
          });
        }

        throw error;
      }
    }),

  assignResident: buildingManagerProcedure
    .input(
      z.object({
        unitId: z.string(),
        residentUserId: z.string(),
        role: residentRoleEnum,
        purchaseDate: z.date().optional(),
        leaseStartDate: z.date().optional(),
        leaseEndDate: z.date().optional().nullable(),
        rentAmountCents: z.number().int().min(0).optional(),
        rentFrequency: rentFrequencyEnum.optional(),
        bondAmountCents: z.number().int().min(0).optional(),
        moveInDate: z.date().optional().nullable(),
        scheduleMonths: z.number().int().min(1).max(24).default(12),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: {
          id: true,
          buildingId: true,
          building: { select: { organisationId: true } },
        },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, unit.buildingId);

      const resident = await ctx.db.user.findUniqueOrThrow({
        where: { id: input.residentUserId },
        select: { id: true },
      });

      await ensureResidentAccessForUnit(ctx.db, {
        userId: resident.id,
        organisationId: unit.building.organisationId,
        buildingId: unit.buildingId,
        role: input.role,
      });

      if (input.role === "OWNER") {
        await ctx.db.$transaction(async (tx) => {
          await tx.ownership.updateMany({
            where: { unitId: unit.id, isActive: true },
            data: { isActive: false },
          });

          await tx.tenancy.updateMany({
            where: { unitId: unit.id, isActive: true },
            data: {
              isActive: false,
              moveOutDate: new Date(),
            },
          });

          await tx.ownership.upsert({
            where: {
              userId_unitId: {
                userId: resident.id,
                unitId: unit.id,
              },
            },
            create: {
              userId: resident.id,
              unitId: unit.id,
              isPrimary: true,
              ownershipPct: 100,
              purchaseDate: input.purchaseDate ?? new Date(),
            },
            update: {
              isActive: true,
              isPrimary: true,
              ownershipPct: 100,
              purchaseDate: input.purchaseDate ?? new Date(),
            },
          });

          await tx.unit.update({
            where: { id: unit.id },
            data: { isOccupied: true },
          });
        });

        return { success: true };
      }

      if (
        !input.leaseStartDate ||
        input.rentAmountCents == null ||
        !input.rentFrequency ||
        input.bondAmountCents == null
      ) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Lease start, rent, rent frequency, and bond are required for tenants.",
        });
      }

      const leaseStartDate = input.leaseStartDate;
      const rentAmountCents = input.rentAmountCents;
      const rentFrequency = input.rentFrequency;
      const bondAmountCents = input.bondAmountCents;

      await ctx.db.$transaction(async (tx) => {
        await tx.tenancy.updateMany({
          where: { unitId: unit.id, isActive: true },
          data: {
            isActive: false,
            moveOutDate: new Date(),
          },
        });

        const tenancy = await tx.tenancy.create({
          data: {
            userId: resident.id,
            unitId: unit.id,
            leaseStartDate,
            leaseEndDate: input.leaseEndDate ?? null,
            rentAmountCents,
            rentFrequency,
            bondAmountCents,
            moveInDate: input.moveInDate ?? leaseStartDate,
          },
        });

        // Auto-generate payment schedule (same behaviour as tenancy.create router)
        const schedule = buildRentSchedule({
          tenancyId: tenancy.id,
          leaseStartDate,
          rentFrequency,
          rentAmountCents,
          months: input.scheduleMonths,
          leaseEndDate: input.leaseEndDate,
        });
        await tx.rentPayment.createMany({ data: schedule });

        await tx.unit.update({
          where: { id: unit.id },
          data: { isOccupied: true },
        });
      });

      return { success: true };
    }),

  update: buildingManagerProcedure
    .input(
      z.object({
        id: z.string(),
        unitNumber: z.string().min(1).optional(),
        unitType: unitTypeEnum.optional(),
        bedrooms: z.number().int().min(0).optional(),
        bathrooms: z.number().int().min(0).optional(),
        parkingSpaces: z.number().int().min(0).optional(),
        storageSpaces: z.number().int().min(0).optional(),
        squareMetres: z.number().positive().optional(),
        isOccupied: z.boolean().optional(),
        lotNumber: z.string().optional(),
        unitEntitlement: z.number().positive().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id },
        select: { buildingId: true },
      });
      await assertBuildingManagementAccess(ctx.db, ctx.user!, unit.buildingId);
      return ctx.db.unit.update({ where: { id }, data });
    }),

  delete: buildingManagerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.id },
        select: { buildingId: true },
      });

      await assertBuildingManagementAccess(ctx.db, ctx.user!, unit.buildingId);

      return ctx.db.unit.delete({ where: { id: input.id } });
    }),

  getResidents: managerProcedure
    .input(z.object({ unitId: z.string() }))
    .query(async ({ ctx, input }) => {
      const unit = await ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: { buildingId: true },
      });
      await assertBuildingOperationsAccess(ctx.db, ctx.user!, unit.buildingId);

      return ctx.db.unit.findUniqueOrThrow({
        where: { id: input.unitId },
        select: {
          ownerships: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
          tenancies: {
            where: { isActive: true },
            include: {
              user: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
      });
    }),
});
