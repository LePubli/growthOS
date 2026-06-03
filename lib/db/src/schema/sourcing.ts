import { pgTable, text, uuid, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";

export const sourcingJobsTable = pgTable("sourcing_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  name: text("name").notNull(),
  status: text("status").notNull().default("queued"),
  count: integer("count").default(0),
  duration: text("duration").default("—"),
  params: jsonb("params").default({}),
  progress: integer("progress").default(0),
  error: text("error"),
  tenantId: uuid("tenant_id").references(() => tenantsTable.id, { onDelete: "cascade" }).notNull(),
  createdBy: uuid("created_by").references(() => usersTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type SourcingJob = typeof sourcingJobsTable.$inferSelect;
