import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const workflowsTable = pgTable("workflows", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  trigger: text("trigger").notNull().default("prospect_created"),
  triggerConfig: jsonb("trigger_config").default({}),
  actions: jsonb("actions").default([]),
  status: text("status").notNull().default("draft"),
  executions: integer("executions").default(0),
  lastRunAt: timestamp("last_run_at"),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type Workflow = typeof workflowsTable.$inferSelect;
