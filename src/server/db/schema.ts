import { sql, relations } from "drizzle-orm";
import {
  index,
  pgTableCreator,
  timestamp,
  varchar,
  uuid,
  text,
  jsonb,
  pgEnum,
  boolean,
} from "drizzle-orm/pg-core";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator((name) => `agridata_${name}`);

export const reportStatusEnum = pgEnum("report_status", [
  "DRAFT",
  "PENDING_TRIAGE",
  "VERIFIED",
  "REJECTED",
]);

export const reportCategoryEnum = pgEnum("report_category", [
  "PEST",
  "DISEASE",
  "WEATHER",
]);

export const botStateEnum = pgEnum("bot_state", [
  "IDLE",
  "AWAITING_LABEL", // Changed from AWAITING_MENU_CHOICE
  "AWAITING_PHOTO_COUNT", // Changed from AWAITING_PHOTO
  "AWAITING_LOCATION",
]);

export const userRoleEnum = pgEnum("user_role", [
  "admin",
  "officer",
]);

export const organizations = createTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const appUsers = createTable(
  "app_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id)
      .notNull(),
    authId: uuid("auth_id"), // Link to Supabase Auth (for Dashboard users)
    phoneNumber: varchar("phone_number", { length: 50 }).unique(), // For Bot users
    fullName: text("full_name"),
    role: userRoleEnum("role").default("officer").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("phone_number_idx").on(table.phoneNumber),
    index("auth_id_idx").on(table.authId),
    index("org_id_idx").on(table.orgId),
  ]
);

export const riskLevelEnum = pgEnum("risk_level", [
  "LOW",
  "MEDIUM",
  "HIGH",
]);

export const reports = createTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id")
    .references(() => organizations.id)
    .notNull(),
  userId: uuid("user_id")
    .references(() => appUsers.id)
    .notNull(),
  status: reportStatusEnum("status").default("DRAFT").notNull(),
  category: reportCategoryEnum("category"),
  
  // Dynamic Collection Fields
  label: text("label"), // Replaces explicit category inference in some cases
  quantity: text("quantity"), // captured via bot
  
  mediaUrl: text("media_url"),

  // Using text for location for now as PostGIS setup in Drizzle can be complex without extensions
  // We will store 'POINT(long lat)' string or JSON
  location: text("location"), 
  description: text("description"),
  
  // Expert Triage Fields
  diagnosis: text("diagnosis"),
  riskLevel: riskLevelEnum("risk_level"),
  rejectionReason: text("rejection_reason"),
  verifiedAt: timestamp("verified_at", { withTimezone: true }),
  verifiedBy: uuid("verified_by"), // References app_users(id) presumably, or auth id
  
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const botSessions = createTable("bot_sessions", {
  userId: uuid("user_id")
    .references(() => appUsers.id)
    .primaryKey(), // One session per user
  currentState: botStateEnum("current_state").default("IDLE").notNull(),
  draftReportId: uuid("draft_report_id").references(() => reports.id),
  lastActive: timestamp("last_active", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  metadata: jsonb("metadata"),
});

// Relations
export const organizationsRelations = relations(organizations, ({ many }) => ({
  users: many(appUsers),
  reports: many(reports),
}));

export const appUsersRelations = relations(appUsers, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [appUsers.orgId],
    references: [organizations.id],
  }),
  reports: many(reports),
  session: one(botSessions, {
    fields: [appUsers.id],
    references: [botSessions.userId],
  }),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [reports.orgId],
    references: [organizations.id],
  }),
  user: one(appUsers, {
    fields: [reports.userId],
    references: [appUsers.id],
  }),
  media: many(reportMedia),
}));

export const reportMedia = createTable("report_media", {
  id: uuid("id").primaryKey().defaultRandom(),
  reportId: uuid("report_id")
    .references(() => reports.id)
    .notNull(),
  mediaUrl: text("media_url").notNull(),
  contentType: text("content_type"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const reportMediaRelations = relations(reportMedia, ({ one }) => ({
  report: one(reports, {
    fields: [reportMedia.reportId],
    references: [reports.id],
  }),
}));

export const botSessionsRelations = relations(botSessions, ({ one }) => ({
  user: one(appUsers, {
    fields: [botSessions.userId],
    references: [appUsers.id],
  }),
  draftReport: one(reports, {
    fields: [botSessions.draftReportId],
    references: [reports.id],
  }),
}));
