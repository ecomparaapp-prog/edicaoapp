import { pgTable, serial, text, boolean, timestamp } from "drizzle-orm/pg-core";

export const userProfilesTable = pgTable("user_profiles", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull().unique(),
  nickname: text("nickname").notNull().unique(),
  fullName: text("full_name"),
  cpf: text("cpf"),
  phone: text("phone"),
  address: text("address"),
  pixKey: text("pix_key"),
  fullNameLocked: boolean("full_name_locked").notNull().default(false),
  cpfLocked: boolean("cpf_locked").notNull().default(false),
  profileBonusAwarded: boolean("profile_bonus_awarded").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type UserProfile = typeof userProfilesTable.$inferSelect;
export type InsertUserProfile = typeof userProfilesTable.$inferInsert;
