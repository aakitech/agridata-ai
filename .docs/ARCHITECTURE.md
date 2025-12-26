# AgriData AI - Architecture Guide

## Project Overview
AgriData AI is a T3 Stack application for agricultural pest and disease reporting via WhatsApp, with an expert triage dashboard for agronomists.

**Tech Stack:**
- **Framework**: Next.js 15 (App Router)
- **API**: tRPC v11
- **Database**: PostgreSQL (Supabase) with Drizzle ORM
- **UI**: React, Tailwind CSS, shadcn/ui
- **Messaging**: Twilio (WhatsApp)

---

## Folder Structure

### Backend (`src/server/`)

```
src/server/
├── api/
│   ├── routers/              # tRPC API endpoints (THIN LAYER)
│   │   ├── health.ts         # Health check endpoint
│   │   ├── reports.ts        # Triage reports API
│   │   └── [future].ts       # Add new routers here
│   ├── root.ts               # Main tRPC router
│   └── trpc.ts               # tRPC setup & context
│
├── modules/                  # Business logic (THICK LAYER)
│   ├── whatsapp-bot/
│   │   ├── workflow.ts       # Bot state machine & message handling
│   │   └── types.ts          # Bot-specific types
│   │
│   ├── triage/
│   │   ├── triage-service.ts # Triage business logic
│   │   └── types.ts          # Triage-specific types
│   │
│   └── [new-module]/         # Add new modules here
│       ├── [module]-service.ts
│       └── types.ts
│
└── db/
    └── schema.ts             # Drizzle ORM schemas & relations
```

### Frontend (`src/`)

```
src/
├── app/                      # Next.js App Router
│   ├── triage/
│   │   ├── page.tsx          # Route page
│   │   └── _components/      # Route-specific components
│   │       ├── triage-dashboard.tsx
│   │       ├── reports-list.tsx
│   │       ├── report-detail.tsx
│   │       └── report-map.tsx
│   │
│   ├── api/
│   │   ├── trpc/[trpc]/route.ts  # tRPC handler
│   │   ├── panel/route.ts        # tRPC UI panel
│   │   └── webhooks/
│   │       └── whatsapp/route.ts # Twilio webhook
│   │
│   └── layout.tsx            # Root layout
│
├── components/
│   ├── ui/                   # shadcn/ui primitives (DO NOT MODIFY)
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   │
│   └── shared/               # Reusable custom components
│       └── [future components]
│
├── hooks/                    # Custom React hooks
│   └── [custom hooks]
│
├── lib/                      # Utilities
│   └── utils.ts              # Helper functions
│
└── styles/
    └── globals.css           # Global styles
```

---

## Architecture Principles

### 1. **Separation of Concerns**

#### Backend Layers
- **Routers** (`src/server/api/routers/`): Thin API layer
  - Define tRPC procedures
  - Handle input validation (Zod)
  - Delegate to services
  - **NO business logic**

- **Services** (`src/server/modules/`): Business logic layer
  - Database queries
  - Data transformations
  - Business rules
  - Reusable logic

**Example:**
```typescript
// ❌ BAD - Business logic in router
export const reportsRouter = createTRPCRouter({
  getPending: publicProcedure.query(async ({ ctx }) => {
    return ctx.db.query.reports.findMany({
      where: (reports, { eq }) => eq(reports.status, "PENDING_TRIAGE"),
      // ... complex query logic
    });
  }),
});

// ✅ GOOD - Router delegates to service
export const reportsRouter = createTRPCRouter({
  getPending: publicProcedure.query(async ({ ctx }) => {
    const service = new TriageService(ctx.db);
    return service.getPendingReports();
  }),
});
```

#### Frontend Layers
- **Pages** (`src/app/*/page.tsx`): Route definitions
  - Minimal logic
  - Call tRPC hooks
  - Render components

- **Components** (`src/app/*/_components/`): UI logic
  - Route-specific components live in `_components/`
  - Reusable components go in `src/components/shared/`
  - Design system components in `src/components/ui/`

### 2. **Module Organization**

Each module in `src/server/modules/` should be:
- **Self-contained**: All related logic in one folder
- **Focused**: Single domain responsibility
- **Testable**: Can be tested independently

**When to create a new module:**
- New business domain (e.g., `auth`, `media`, `analytics`)
- Shared logic across multiple routers
- Complex business rules that need isolation

### 3. **Component Organization**

**Route-specific components:**
```
src/app/triage/_components/
```
- Used only in this route
- Prefix with `_` to indicate private to route

**Reusable components:**
```
src/components/shared/
```
- Used across multiple routes
- Move here when component is reused

**Design system:**
```
src/components/ui/
```
- shadcn/ui primitives
- **DO NOT modify** - regenerate via CLI

---

## Naming Conventions

### Files
- **Components**: `kebab-case.tsx` (e.g., `triage-dashboard.tsx`)
- **Services**: `[module]-service.ts` (e.g., `triage-service.ts`)
- **Types**: `types.ts` or `[module]-types.ts`
- **Routes**: `page.tsx`, `layout.tsx`, `route.ts`

### Code
- **Components**: `PascalCase` (e.g., `TriageDashboard`)
- **Services**: `PascalCase` (e.g., `TriageService`)
- **Functions**: `camelCase` (e.g., `getPendingReports`)
- **Constants**: `UPPER_SNAKE_CASE` (e.g., `MAX_RETRIES`)

---

## Adding New Features

### Backend Feature (API + Business Logic)

1. **Create module** (if new domain):
   ```bash
   mkdir -p src/server/modules/[module-name]
   ```

2. **Create service**:
   ```typescript
   // src/server/modules/[module-name]/[module]-service.ts
   export class [Module]Service {
     constructor(private db: typeof db) {}
     
     async [method]() {
       // Business logic here
     }
   }
   ```

3. **Create router**:
   ```typescript
   // src/server/api/routers/[module].ts
   import { [Module]Service } from "~/server/modules/[module]/[module]-service";
   
   export const [module]Router = createTRPCRouter({
     [procedure]: publicProcedure.query(async ({ ctx }) => {
       const service = new [Module]Service(ctx.db);
       return service.[method]();
     }),
   });
   ```

4. **Register router**:
   ```typescript
   // src/server/api/root.ts
   export const appRouter = createTRPCRouter({
     // ...
     [module]: [module]Router,
   });
   ```

### Frontend Feature (UI)

1. **Create route** (if new page):
   ```bash
   mkdir -p src/app/[route]/_components
   ```

2. **Create page**:
   ```typescript
   // src/app/[route]/page.tsx
   export default function [Route]Page() {
     return <[Route]Dashboard />;
   }
   ```

3. **Create components**:
   ```typescript
   // src/app/[route]/_components/[route]-dashboard.tsx
   export function [Route]Dashboard() {
     const data = api.[module].[procedure].useQuery();
     // ...
   }
   ```

---

## Database Schema

All schemas live in `src/server/db/schema.ts`:
- Define tables using Drizzle ORM
- Define relations for type-safe joins
- Export schemas for use in services

**Example:**
```typescript
export const reports = createTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  // ... columns
});

export const reportsRelations = relations(reports, ({ one, many }) => ({
  user: one(botUsers, {
    fields: [reports.userId],
    references: [botUsers.id],
  }),
  media: many(reportMedia),
}));
```

---

## Best Practices

### ✅ DO
- Keep routers thin - delegate to services
- Put route-specific components in `_components/`
- **Use tRPC for all core application data & mutations**: This provides full end-to-end type safety and is our default for dashboard features.
- **Use Server Actions for Auth/Form-based entry points**: Use Actions for Login, Logout, and simple form-POSTs that require direct server redirects or specific cookie management (like Supabase Auth).
- Use Zod for input validation in both layers.
- Create services for reusable business logic

### ❌ DON'T
- Put business logic in routers
- Modify `src/components/ui/` (shadcn/ui)
- Create "manager" or "factory" classes
- Over-engineer with too many layers
- Mix frontend and backend code
- Skip input validation

---

## Testing Strategy

### Backend
- Unit test services independently
- Mock database for fast tests
- Integration tests for routers

### Frontend
- Component tests with React Testing Library
- E2E tests for critical flows (Playwright)

---

## Migration Guide

When refactoring existing code:
1. Create service in `src/server/modules/`
2. Move business logic from router to service
3. Update router to use service
4. Verify TypeScript compiles
5. Test functionality

---

## Questions?

- **Where do I put API endpoints?** → `src/server/api/routers/`
- **Where do I put business logic?** → `src/server/modules/`
- **Where do I put UI components?** → `src/app/[route]/_components/` (route-specific) or `src/components/shared/` (reusable)
- **Where do I put database schemas?** → `src/server/db/schema.ts`
- **Where do I put types?** → Co-located with the module or component

---

**Last Updated**: 2025-12-02
