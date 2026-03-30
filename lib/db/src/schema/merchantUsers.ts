import {
  pgTable,
  serial,
  integer,
  text,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { merchantRegistrationsTable } from "./merchantRegistrations";

export type MerchantPlan = "normal" | "plus";

export const merchantUsersTable = pgTable("merchant_users", {
  id: serial("id").primaryKey(),

  merchantRegistrationId: integer("merchant_registration_id")
    .notNull()
    .references(() => merchantRegistrationsTable.id),

  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(true),

  plan: text("plan").$type<MerchantPlan>().notNull().default("normal"),

  resetToken: text("reset_token"),
  resetTokenExpiresAt: timestamp("reset_token_expires_at", { withTimezone: true }),

  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type MerchantUser = typeof merchantUsersTable.$inferSelect;
export type InsertMerchantUser = typeof merchantUsersTable.$inferInsert;
