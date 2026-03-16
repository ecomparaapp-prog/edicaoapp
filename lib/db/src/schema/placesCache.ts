import { pgTable, text, doublePrecision, timestamp } from "drizzle-orm/pg-core";

export const placesCacheTable = pgTable("places_cache", {
  googlePlaceId: text("google_place_id").primaryKey(),
  name: text("name").notNull(),
  address: text("address"),
  lat: doublePrecision("lat").notNull(),
  lng: doublePrecision("lng").notNull(),
  phone: text("phone"),
  website: text("website"),
  photoUrl: text("photo_url"),
  rating: doublePrecision("rating"),
  status: text("status").notNull().default("shadow"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PlacesCache = typeof placesCacheTable.$inferSelect;
export type InsertPlacesCache = typeof placesCacheTable.$inferInsert;
