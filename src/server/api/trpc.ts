/**
 * YOU PROBABLY DON'T NEED TO EDIT THIS FILE, UNLESS:
 * 1. You want to modify request context (see Part 1).
 * 2. You want to create a new middleware or type of procedure (see Part 3).
 *
 * TL;DR - This is where all the tRPC server stuff is created and plugged in. The pieces you will
 * need to use are documented accordingly near the end.
 */
import { initTRPC, TRPCError } from "@trpc/server";
import superjson from "superjson";
import { ZodError } from "zod";
import { createClient } from "@supabase/supabase-js";

import { db } from "~/server/db";
import { env } from "~/env";
import { appUsers } from "~/server/db/schema";
import { eq } from "drizzle-orm";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
import { createClient as createSupabaseServerClient } from "~/lib/supabase/server";

/**
 * 1. CONTEXT
 *
 * This section defines the "contexts" that are available in the backend API.
 *
 * These allow you to access things when processing a request, like the database, the session, etc.
 *
 * This helper generates the "internals" for a tRPC context. The API handler and RSC clients each
 * wrap this and provides the required context.
 *
 * @see https://trpc.io/docs/server/context
 */
export const createTRPCContext = async (opts: { headers: Headers }) => {
  // Try to get token from header first (for client-side tRPC calls)
  const authHeader = opts.headers.get("authorization");
  const token = authHeader?.split(" ")[1];
  
  let user = null;
  let appUser = null;

  if (token) {
    // Client-side call with Bearer token
    const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data: { user: supabaseUser }, error } = await supabase.auth.getUser(token);
    
    if (supabaseUser && !error) {
      user = supabaseUser;
    }
  } else {
    // Likely a Server Component call or missing token. Check cookies via server client.
    try {
      const supabase = await createSupabaseServerClient();
      const { data: { user: supabaseUser } } = await supabase.auth.getUser();
      if (supabaseUser) {
        user = supabaseUser;
      }
    } catch (e) {
      // Cookies might not be available in all contexts (e.g. some internal calls)
      console.log("[TRPC Context] No token and cookies unavailable");
    }
  }

  // If we have a Supabase user, fetch the internal profile
  if (user) {
    appUser = await db.query.appUsers.findFirst({
      where: eq(appUsers.authId, user.id),
    });
  }

  return {
    db,
    user,     // Supabase Auth User
    appUser,  // Internal DB User (with Org ID)
    ...opts,
  };
};

/**
 * 2. INITIALIZATION
 *
 * This is where the tRPC API is initialized, connecting the context and transformer. We also parse
 * ZodErrors so that you get typesafety on the frontend if your procedure fails due to validation
 * errors on the backend.
 */
const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        zodError:
          error.cause instanceof ZodError ? error.cause.flatten() : null,
      },
    };
  },
});

/**
 * Create a server-side caller.
 *
 * @see https://trpc.io/docs/server/server-side-calls
 */
export const createCallerFactory = t.createCallerFactory;

/**
 * 3. ROUTER & PROCEDURE (THE IMPORTANT BIT)
 *
 * These are the pieces you use to build your tRPC API. You should import these a lot in the
 * "/src/server/api/routers" directory.
 */

/**
 * This is how you create new routers and sub-routers in your tRPC API.
 *
 * @see https://trpc.io/docs/router
 */
export const createTRPCRouter = t.router;

/**
 * Middleware for timing procedure execution and adding an artificial delay in development.
 *
 * You can remove this if you don't like it, but it can help catch unwanted waterfalls by simulating
 * network latency that would occur in production but not in local development.
 */
const timingMiddleware = t.middleware(async ({ next, path }) => {
  const start = Date.now();

  if (t._config.isDev) {
    // artificial delay in dev
    const waitMs = Math.floor(Math.random() * 400) + 100;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }

  const result = await next();

  const end = Date.now();
  console.log(`[TRPC] ${path} took ${end - start}ms to execute`);

  return result;
});

/**
 * Public (unauthenticated) procedure
 *
 * This is the base piece you use to build new queries and mutations on your tRPC API. It does not
 * guarantee that a user querying is authorized, but you can still access user session data if they
 * are logged in.
 */
export const publicProcedure = t.procedure.use(timingMiddleware);

/**
 * Auth procedure (Supabase Session only)
 * 
 * Used for onboarding where the user is logged in but doesn't have a profile yet.
 */
export const authProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.user) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        user: ctx.user,
      },
    });
  });

/**
 * Protected (authenticated & profiled) procedure
 *
 * Requires both a Supabase session AND an internal app_users profile.
 */
export const protectedProcedure = t.procedure
  .use(timingMiddleware)
  .use(async ({ ctx, next }) => {
    if (!ctx.user || !ctx.appUser) {
      throw new TRPCError({ code: "UNAUTHORIZED" });
    }
    return next({
      ctx: {
        // infers the `user` and `appUser` as non-nullable
        user: ctx.user,
        appUser: ctx.appUser,
      },
    });
  });
