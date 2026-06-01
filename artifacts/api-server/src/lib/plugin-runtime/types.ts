import { z } from "zod";

export const PluginPermission = z.enum([
  "prospects:read",
  "prospects:write",
  "pipeline:read",
  "pipeline:write",
  "sequences:read",
  "sequences:write",
  "signals:read",
  "signals:write",
  "analytics:read",
  "workflows:read",
  "workflows:write",
  "webhooks:send",
  "email:send",
  "contacts:read",
  "contacts:write",
]);
export type PluginPermission = z.infer<typeof PluginPermission>;

export const PluginManifest = z.object({
  id: z
    .string()
    .regex(
      /^[a-z0-9][a-z0-9-]*[a-z0-9]$/,
      "Plugin ID must be lowercase alphanumeric with hyphens",
    ),
  name: z.string().min(1).max(128),
  version: z
    .string()
    .regex(/^\d+\.\d+\.\d+$/, "Version must follow semver (e.g. 1.0.0)"),
  description: z.string().max(512).optional(),
  author: z.string().max(128).optional(),
  dependencies: z.array(z.string()).default([]),
  permissions: z.array(PluginPermission).default([]),
  entryPoint: z.string().optional(),
  uiSlots: z.array(z.string()).default([]),
  routes: z
    .array(
      z.object({
        path: z.string(),
        label: z.string(),
        icon: z.string().optional(),
      }),
    )
    .default([]),
});
export type PluginManifest = z.infer<typeof PluginManifest>;

export const PluginLifecycleState = z.enum([
  "DISCOVERED",
  "RESOLVING",
  "ACTIVE",
  "ERROR",
  "DISABLED",
]);
export type PluginLifecycleState = z.infer<typeof PluginLifecycleState>;

export interface PluginRecord {
  manifest: PluginManifest;
  state: PluginLifecycleState;
  error?: string;
  activatedAt?: Date;
  disabledAt?: Date;
}

export interface PluginStatusResponse {
  id: string;
  name: string;
  version: string;
  state: PluginLifecycleState;
  permissions: PluginPermission[];
  uiSlots: string[];
  routes: PluginManifest["routes"];
  error?: string;
  activatedAt?: string;
}
