import { pgTable, text, uuid, timestamp } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { prospectsTable } from "./prospects";
import { dealsTable } from "./deals";

export const activitiesTable = pgTable("activities", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull().default("note"),
  title: text("title").notNull(),
  description: text("description"),
  status: text("status").notNull().default("done"),
  prospectId: uuid("prospect_id").references(() => prospectsTable.id, { onDelete: "set null" }),
  dealId: uuid("deal_id").references(() => dealsTable.id, { onDelete: "set null" }),
  scheduledAt: timestamp("scheduled_at"),
  doneAt: timestamp("done_at"),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Activity = typeof activitiesTable.$inferSelect;
