import { pgTable, text, timestamp, jsonb } from "drizzle-orm/pg-core";

export const eanCacheTable = pgTable("ean_cache", {
  ean: text("ean").primaryKey(),
  description: text("description").notNull(),
  brand: text("brand"),
  category: text("category"),
  thumbnailUrl: text("thumbnail_url"),
  rawJson: jsonb("raw_json"),
  cachedAt: timestamp("cached_at", { withTimezone: true }).defaultNow().notNull(),
});

export type EanCache = typeof eanCacheTable.$inferSelect;
export type InsertEanCache = typeof eanCacheTable.$inferInsert;
