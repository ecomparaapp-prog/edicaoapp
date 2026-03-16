import { pgTable, text, doublePrecision, timestamp, boolean } from "drizzle-orm/pg-core";

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
  isPartner: boolean("is_partner").notNull().default(false),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PlacesCache = typeof placesCacheTable.$inferSelect;
export type InsertPlacesCache = typeof placesCacheTable.$inferInsert;
