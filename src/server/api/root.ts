import { analyticsRouter } from "~/server/api/routers/analytics";
import { organizationsRouter } from "~/server/api/routers/organizations";
import { reportsRouter } from "~/server/api/routers/reports";
import { usersRouter } from "~/server/api/routers/users";
import { healthRouter } from "~/server/api/routers/health";
import { createCallerFactory, createTRPCRouter } from "~/server/api/trpc";
import { invitesRouter } from "~/server/api/routers/invites";
import { enhancementsRouter } from "~/server/api/routers/enhancements";

/**
 * This is the primary router for your server.
 *
 * All routers added in /api/routers should be manually added here.
 */
export const appRouter = createTRPCRouter({
  analytics: analyticsRouter,
  organizations: organizationsRouter,
  reports: reportsRouter,
  users: usersRouter,
  health: healthRouter,
  invites: invitesRouter,
  enhancements: enhancementsRouter,
});

// export type definition of API
export type AppRouter = typeof appRouter;

/**
 * Create a server-side caller for the tRPC API.
 * @example
 * const trpc = createCaller(createContext);
 * const res = await trpc.post.all();
 *       ^? Post[]
 */
export const createCaller = createCallerFactory(appRouter);
