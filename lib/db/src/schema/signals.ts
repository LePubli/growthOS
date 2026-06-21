import { pgTable, text, uuid, timestamp, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { prospectsTable } from "./prospects";

export const signalsTable = pgTable("signals", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  company: text("company").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  score: integer("score").default(50),
  isRead: boolean("is_read").default(false),
  isStarred: boolean("is_starred").default(false),
  source: text("source").default("manual"),
  prospectId: uuid("prospect_id").references(() => prospectsTable.id, { onDelete: "set null" }),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSignalSchema = createInsertSchema(signalsTable).omit({ id: true, createdAt: true });
export type InsertSignal = z.infer<typeof insertSignalSchema>;
export type Signal = typeof signalsTable.$inferSelect;
