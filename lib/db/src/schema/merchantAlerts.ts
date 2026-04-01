import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { merchantUsersTable } from "./merchantUsers";

export type AlertType =
  | "price_divergence"
  | "ranking_drop"
  | "price_report"
  | "plan_expiry"
  | "nps_negative"
  | "stock_rupture"
  | "competitiveness"
  | "new_follower"
  | "nfce_validated";

export type AlertStatus = "PENDING" | "IN_PROGRESS" | "RESOLVED";
export type AlertPriority = "high" | "medium" | "low";

export const merchantAlertsTable = pgTable("merchant_alerts", {
  id: serial("id").primaryKey(),
  merchantUserId: integer("merchant_user_id")
    .notNull()
    .references(() => merchantUsersTable.id, { onDelete: "cascade" }),
  type: text("type").$type<AlertType>().notNull(),
  status: text("status").$type<AlertStatus>().notNull().default("PENDING"),
  priority: text("priority").$type<AlertPriority>().notNull().default("medium"),
  title: text("title").notNull(),
  description: text("description").notNull(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
  resolvedBy: text("resolved_by"),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  actionNote: text("action_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MerchantAlert = typeof merchantAlertsTable.$inferSelect;
export type InsertMerchantAlert = typeof merchantAlertsTable.$inferInsert;
