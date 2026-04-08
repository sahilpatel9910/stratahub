import { createTRPCRouter } from "./trpc";
import { organisationsRouter } from "./routers/organisations";
import { buildingsRouter } from "./routers/buildings";
import { unitsRouter } from "./routers/units";
import { residentsRouter } from "./routers/residents";
import { rentRouter } from "./routers/rent";
import { keysRouter } from "./routers/keys";
import { maintenanceRouter } from "./routers/maintenance";
import { visitorsRouter } from "./routers/visitors";
import { parcelsRouter } from "./routers/parcels";
import { announcementsRouter } from "./routers/announcements";
import { messagingRouter } from "./routers/messaging";

export const appRouter = createTRPCRouter({
  organisations: organisationsRouter,
  buildings: buildingsRouter,
  units: unitsRouter,
  residents: residentsRouter,
  rent: rentRouter,
  keys: keysRouter,
  maintenance: maintenanceRouter,
  visitors: visitorsRouter,
  parcels: parcelsRouter,
  announcements: announcementsRouter,
  messaging: messagingRouter,
});

export type AppRouter = typeof appRouter;
