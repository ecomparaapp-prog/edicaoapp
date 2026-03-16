import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const partnershipRequestsTable = pgTable("partnership_requests", {
  id: serial("id").primaryKey(),
  googlePlaceId: text("google_place_id").notNull(),
  placeName: text("place_name").notNull(),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  message: text("message"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PartnershipRequest = typeof partnershipRequestsTable.$inferSelect;
export type InsertPartnershipRequest = typeof partnershipRequestsTable.$inferInsert;
