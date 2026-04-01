import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { merchantUsersTable } from "./merchantUsers";

export type CampaignStatus = "active" | "paused" | "ended";
export type CampaignType = "banner" | "oferta" | "destaque";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),

  merchantUserId: integer("merchant_user_id")
    .notNull()
    .references(() => merchantUsersTable.id),

  name: text("name").notNull(),
  productEan: text("product_ean"),
  productName: text("product_name"),
  campaignType: text("campaign_type").$type<CampaignType>().notNull().default("banner"),
  promotionalPrice: text("promotional_price"),
  radius: integer("radius").notNull().default(5),
  budget: text("budget").notNull().default("500"),

  status: text("status").$type<CampaignStatus>().notNull().default("active"),

  startDate: timestamp("start_date", { withTimezone: true }).notNull().defaultNow(),
  endDate: timestamp("end_date", { withTimezone: true }),

  impressions: integer("impressions").notNull().default(0),
  clicks: integer("clicks").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type Campaign = typeof campaignsTable.$inferSelect;
export type InsertCampaign = typeof campaignsTable.$inferInsert;
