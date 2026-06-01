import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const webhooksTable = pgTable("webhooks", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  events: jsonb("events").default([]),
  secret: text("secret"),
  status: text("status").notNull().default("active"),
  deliveries: integer("deliveries").default(0),
  lastTriggeredAt: timestamp("last_triggered_at"),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Webhook = typeof webhooksTable.$inferSelect;
