import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";

export const apiCreditUsageTable = pgTable("api_credit_usage", {
  id: serial("id").primaryKey(),
  monthKey: text("month_key").notNull().unique(),
  callsCount: integer("calls_count").notNull().default(0),
  suspendedAt: timestamp("suspended_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type ApiCreditUsage = typeof apiCreditUsageTable.$inferSelect;
export type InsertApiCreditUsage = typeof apiCreditUsageTable.$inferInsert;
