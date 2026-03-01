import { sql, relations } from "drizzle-orm";
import {
  date,
  index,
  numeric,
  pgTableCreator,
  timestamp,
  varchar,
  uuid,
  text,
  jsonb,
  pgEnum,
  boolean,
  integer,
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

export const userStatusEnum = pgEnum("user_status", [
  "PENDING",
  "ACTIVE",
  "SUSPENDED",
]);

export const sessionStatusEnum = pgEnum("session_status", [
  "ACTIVE",
  "COMPLETED",
  "RESET",
]);

export const userRoleEnum = pgEnum("user_role", [
  "super_admin",
  "org_admin",
  "officer",
]);

export const severityEnum = pgEnum("severity", ["NORMAL", "WARNING", "HIGH"]);

export const severitySourceEnum = pgEnum("severity_source", [
  "ORG_CONFIG",
  "DEFAULT_FALLBACK",
]);

export const weatherEnrichmentStatusEnum = pgEnum("weather_enrichment_status", [
  "PENDING",
  "OK",
  "FAILED",
  "NEEDS_REVIEW",
]);

export const weatherQualityFlagEnum = pgEnum("weather_quality_flag", [
  "UNKNOWN",
  "PLAUSIBLE",
  "SUSPECT",
]);

export const organizations = createTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  activeWorkflow: text("active_workflow"),
  workflowConfig: jsonb("workflow_config"),
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
    email: text("email"), // Cached email for display
    phoneNumber: varchar("phone_number", { length: 50 }).unique(), // For Bot users
    fullName: text("full_name"),
    role: userRoleEnum("role").default("officer").notNull(),
    status: userStatusEnum("status").default("ACTIVE").notNull(),
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

export const riskLevelEnum = pgEnum("risk_level", ["LOW", "MEDIUM", "HIGH"]);

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
  workflowId: text("workflow_id"),
  label: text("label"), // Replaces explicit category inference in some cases
  quantity: text("quantity"), // captured via bot
  dataPayload: jsonb("data_payload"),

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

  // Enhancement tracking
  enhancementCount: integer("enhancement_count").default(0).notNull(),
  lastEnhancementAt: timestamp("last_enhancement_at", { withTimezone: true }),

  // Alert severity (computed at ingestion time)
  severity: severityEnum("severity"),
  observedCount: integer("observed_count"), // Raw count used for severity computation
  severitySource: severitySourceEnum("severity_source"), // Source of severity computation (ORG_CONFIG or DEFAULT_FALLBACK)

  createdAt: timestamp("created_at", { withTimezone: true })
    .default(sql`CURRENT_TIMESTAMP`)
    .notNull(),
});

export const botSessions = createTable("bot_sessions", {
  userId: uuid("user_id")
    .references(() => appUsers.id)
    .primaryKey(), // One session per user
  workflowId: text("workflow_id"),
  currentStep: text("current_step"),
  dataCollected: jsonb("data_collected"),
  status: sessionStatusEnum("status").default("ACTIVE").notNull(),
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

export const reportWeather = createTable(
  "report_weather",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .references(() => reports.id, { onDelete: "cascade" })
      .notNull()
      .unique(),
    orgId: uuid("org_id").references(() => organizations.id, { onDelete: "cascade" }),
    lat: numeric("lat", { precision: 9, scale: 6 }),
    lon: numeric("lon", { precision: 9, scale: 6 }),
    observedAt: timestamp("observed_at", { withTimezone: true }).notNull(),
    observedLocalDate: date("observed_local_date").notNull(),
    timezone: text("timezone").default("Africa/Harare").notNull(),
    gridKey: text("grid_key"),
    source: text("source"),
    isProvisional: boolean("is_provisional").default(false).notNull(),
    status: weatherEnrichmentStatusEnum("status").default("PENDING").notNull(),
    attemptCount: integer("attempt_count").default(0).notNull(),
    nextRetryAt: timestamp("next_retry_at", { withTimezone: true }),
    lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
    errorCode: text("error_code"),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }),
    rainDayMm: numeric("rain_day_mm", { precision: 10, scale: 3 }),
    rain7dMm: numeric("rain_7d_mm", { precision: 10, scale: 3 }),
    tempMinC: numeric("temp_min_c", { precision: 6, scale: 2 }),
    tempMaxC: numeric("temp_max_c", { precision: 6, scale: 2 }),
    tempMeanC: numeric("temp_mean_c", { precision: 6, scale: 2 }),
    humidityMeanPct: numeric("humidity_mean_pct", { precision: 6, scale: 2 }),
    reviewedBy: uuid("reviewed_by").references(() => appUsers.id, { onDelete: "set null" }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewNote: text("review_note"),
    qualityFlag: weatherQualityFlagEnum("quality_flag").default("UNKNOWN").notNull(),
    providerVersion: text("provider_version"),
    providerPayload: jsonb("provider_payload"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("report_weather_status_next_retry_idx").on(table.status, table.nextRetryAt),
    index("report_weather_provisional_status_idx").on(table.isProvisional, table.status),
    index("report_weather_org_observed_at_idx").on(table.orgId, table.observedAt),
    index("report_weather_grid_observed_date_idx").on(table.gridKey, table.observedLocalDate),
    index("report_weather_quality_status_idx").on(table.qualityFlag, table.status),
  ]
);

export const reportWeatherRelations = relations(reportWeather, ({ one }) => ({
  report: one(reports, {
    fields: [reportWeather.reportId],
    references: [reports.id],
  }),
  organization: one(organizations, {
    fields: [reportWeather.orgId],
    references: [organizations.id],
  }),
  reviewer: one(appUsers, {
    fields: [reportWeather.reviewedBy],
    references: [appUsers.id],
  }),
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
  enhancements: many(triageEnhancements),
  weather: one(reportWeather, {
    fields: [reports.id],
    references: [reportWeather.reportId],
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

// Triage Enhancements (Soft Triage)
export const enhancementTypeEnum = pgEnum("enhancement_type", [
  "label_hint",
  "quality",
  "context",
  "follow_up",
  "internal",
]);

export const triageEnhancements = createTable(
  "triage_enhancements",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    reportId: uuid("report_id")
      .references(() => reports.id, { onDelete: "cascade" })
      .notNull(),
    addedBy: uuid("added_by")
      .references(() => appUsers.id, { onDelete: "cascade" })
      .notNull(),
    enhancementType: enhancementTypeEnum("enhancement_type").notNull(),
    enhancementText: text("enhancement_text").notNull(),
    isInternal: boolean("is_internal").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("triage_enhancements_report_id_idx").on(table.reportId),
    index("triage_enhancements_added_by_idx").on(table.addedBy),
  ]
);

export const triageEnhancementsRelations = relations(
  triageEnhancements,
  ({ one }) => ({
    report: one(reports, {
      fields: [triageEnhancements.reportId],
      references: [reports.id],
    }),
    addedByUser: one(appUsers, {
      fields: [triageEnhancements.addedBy],
      references: [appUsers.id],
    }),
  })
);

// Org Alert Thresholds (per-pest severity configuration)
export const orgAlertThresholds = createTable(
  "org_alert_thresholds",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id")
      .references(() => organizations.id, { onDelete: "cascade" })
      .notNull(),
    pestKey: text("pest_key").notNull(), // Normalized pest name (e.g., "Moth", "Bollworm")
    normalMax: integer("normal_max").notNull(), // Max value for NORMAL (exclusive upper bound)
    warningMax: integer("warning_max").notNull(), // Max value for WARNING (exclusive upper bound)
    // HIGH is warningMax + 1 and above
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`CURRENT_TIMESTAMP`)
      .notNull(),
  },
  (table) => [
    index("org_alert_thresholds_org_id_idx").on(table.orgId),
    index("org_alert_thresholds_pest_key_idx").on(table.pestKey),
    // Unique constraint: one threshold config per org per pest
    index("org_alert_thresholds_org_pest_unique_idx").on(
      table.orgId,
      table.pestKey
    ),
  ]
);

export const orgAlertThresholdsRelations = relations(
  orgAlertThresholds,
  ({ one }) => ({
    organization: one(organizations, {
      fields: [orgAlertThresholds.orgId],
      references: [organizations.id],
    }),
  })
);
