import { boolean, integer, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const priceReportsTable = pgTable("price_reports", {
  id: serial("id").primaryKey(),
  ean: text("product_ean").notNull(),
  productName: text("product_name").notNull().default(""),
  placeId: text("place_id").notNull(),
  userId: text("user_id").notNull(),
  price: numeric("price", { precision: 10, scale: 2 }).notNull(),
  reportedAt: timestamp("reported_at", { withTimezone: true }).defaultNow().notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  upvotes: integer("upvotes").default(0).notNull(),
  downvotes: integer("downvotes").default(0).notNull(),
  reportType: text("report_type").default("price_submission"),
  pointsAwarded: integer("points_awarded").default(0),
  conflictStatus: text("conflict_status"),
  partnerNotifiedAt: timestamp("partner_notified_at", { withTimezone: true }),
});

export type PriceReport = typeof priceReportsTable.$inferSelect;
export type InsertPriceReport = typeof priceReportsTable.$inferInsert;
