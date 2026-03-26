import { integer, jsonb, numeric, pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const nfceRecordsTable = pgTable("nfce_records", {
  id: serial("id").primaryKey(),
  chaveAcesso: text("chave_acesso").notNull().unique(),
  cnpj: text("cnpj"),
  storeName: text("store_name"),
  placeId: text("place_id"),
  userId: text("user_id").notNull(),
  totalValue: numeric("total_value", { precision: 10, scale: 2 }),
  itemCount: integer("item_count").default(0),
  items: jsonb("items"),
  pointsAwarded: integer("points_awarded").default(0),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  source: text("source").default("manual"),
  stateCode: text("state_code"),
  docNumber: text("doc_number"),
});

export type NfceRecord = typeof nfceRecordsTable.$inferSelect;
export type InsertNfceRecord = typeof nfceRecordsTable.$inferInsert;
