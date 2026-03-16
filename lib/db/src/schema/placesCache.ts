import { pgTable, text, doublePrecision, timestamp, index, customType } from "drizzle-orm/pg-core";

const geographyPoint = customType<{ data: string; driverData: string }>({
  dataType() {
    return "geography(Point, 4326)";
  },
  toDriver(value: string) {
    return value;
  },
  fromDriver(value: string) {
    return value;
  },
});

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
  geom: geographyPoint("geom"),
  syncedAt: timestamp("synced_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  index("idx_places_cache_geom").using("gist", table.geom),
]);

export type PlacesCache = typeof placesCacheTable.$inferSelect;
export type InsertPlacesCache = typeof placesCacheTable.$inferInsert;
