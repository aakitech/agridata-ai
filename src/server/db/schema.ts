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
  "AWAITING_MENU_CHOICE",
  "AWAITING_PHOTO",
  "AWAITING_LOCATION",
  "AWAITING_DESCRIPTION",
]);

export const botUsers = createTable(
  "bot_users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    phoneNumber: varchar("phone_number", { length: 50 }).notNull().unique(),
    languagePref: varchar("language_pref", { length: 10 }).default("en"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [index("phone_number_idx").on(table.phoneNumber)]
);

export const riskLevelEnum = pgEnum("risk_level", [
  "LOW",
  "MEDIUM",
  "HIGH",
]);

export const reports = createTable("reports", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => botUsers.id)
    .notNull(),
  status: reportStatusEnum("status").default("DRAFT").notNull(),
  category: reportCategoryEnum("category"),
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
  verifiedBy: uuid("verified_by"), // References auth.users(id) but kept loose here for simplicity
  
  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const botSessions = createTable("bot_sessions", {
  userId: uuid("user_id")
    .references(() => botUsers.id)
    .primaryKey(), // One session per user
  currentState: botStateEnum("current_state").default("IDLE").notNull(),
  draftReportId: uuid("draft_report_id").references(() => reports.id),
  lastActive: timestamp("last_active", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
  metadata: jsonb("metadata"),
});

// Relations
export const botUsersRelations = relations(botUsers, ({ many, one }) => ({
  reports: many(reports),
  session: one(botSessions, {
    fields: [botUsers.id],
    references: [botSessions.userId],
  }),
}));

export const reportsRelations = relations(reports, ({ one, many }) => ({
  user: one(botUsers, {
    fields: [reports.userId],
    references: [botUsers.id],
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
  user: one(botUsers, {
    fields: [botSessions.userId],
    references: [botUsers.id],
  }),
  draftReport: one(reports, {
    fields: [botSessions.draftReportId],
    references: [reports.id],
  }),
}));
