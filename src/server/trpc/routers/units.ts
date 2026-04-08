import { z } from "zod";
import {
  createTRPCRouter,
  managerProcedure,
  protectedProcedure,
} from "@/server/trpc/trpc";

const unitTypeEnum = z.enum([
  "APARTMENT", "STUDIO", "PENTHOUSE", "TOWNHOUSE", "COMMERCIAL", "STORAGE", "PARKING",
]);

export const unitsRouter = createTRPCRouter({
  listByBuilding: protectedProcedure
    .input(z.object({ buildingId: z.string() }))
    .query(async ({ ctx, input }) => {
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

  getById: protectedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
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

  create: managerProcedure
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
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.db.unit.create({ data: input });
    }),

  update: managerProcedure
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
      return ctx.db.unit.update({ where: { id }, data });
    }),

  delete: managerProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      return ctx.db.unit.delete({ where: { id: input.id } });
    }),
});
