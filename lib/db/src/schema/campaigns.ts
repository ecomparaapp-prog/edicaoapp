import { pgTable, serial, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { merchantUsersTable } from "./merchantUsers";

export type CampaignStatus = "active" | "paused" | "ended";
export type CampaignType = "banner_home" | "search_boost" | "flash_deal";
export type CampaignAudience = "all" | "favorited";

export const campaignsTable = pgTable("campaigns", {
  id: serial("id").primaryKey(),

  merchantUserId: integer("merchant_user_id")
    .notNull()
    .references(() => merchantUsersTable.id),

  name: text("name").notNull(),

  // Tipo definitivo de campanha
  campaignType: text("campaign_type").$type<CampaignType>().notNull().default("search_boost"),

  // Para banner_home: array de até 6 EANs
  eanList: jsonb("ean_list").$type<string[]>(),

  // Para search_boost e flash_deal: 1 EAN
  productEan: text("product_ean"),
  productName: text("product_name"),

  // Flash deal: preço promocional
  promotionalPrice: text("promotional_price"),

  // Configurações de exposição
  radius: integer("radius").notNull().default(5),
  audience: text("audience").$type<CampaignAudience>().notNull().default("all"),
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
