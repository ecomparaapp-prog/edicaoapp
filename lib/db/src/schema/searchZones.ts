import { pgTable, serial, text, doublePrecision, timestamp, boolean } from "drizzle-orm/pg-core";

export const searchZonesTable = pgTable("search_zones", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  radiusKm: doublePrecision("radius_km").notNull().default(5),
  active: boolean("active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type SearchZone = typeof searchZonesTable.$inferSelect;
export type InsertSearchZone = typeof searchZonesTable.$inferInsert;
