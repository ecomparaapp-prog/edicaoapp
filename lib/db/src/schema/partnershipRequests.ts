import { pgTable, serial, text, timestamp, integer } from "drizzle-orm/pg-core";

export type PartnershipStatus = "pending" | "approved" | "rejected";

export const partnershipRequestsTable = pgTable("partnership_requests", {
  id: serial("id").primaryKey(),
  googlePlaceId: text("google_place_id").notNull(),
  placeName: text("place_name").notNull(),
  requesterName: text("requester_name").notNull(),
  requesterEmail: text("requester_email").notNull(),
  message: text("message"),
  status: text("status").$type<PartnershipStatus>().default("pending").notNull(),
  adminNote: text("admin_note"),
  convertedRegistrationId: integer("converted_registration_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type PartnershipRequest = typeof partnershipRequestsTable.$inferSelect;
export type InsertPartnershipRequest = typeof partnershipRequestsTable.$inferInsert;
