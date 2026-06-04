import AdmZip from "adm-zip";
import { z } from "zod";
import path from "path";
import fs from "fs/promises";
import { pool } from "@workspace/db";
import { pluginManager } from "../plugin-runtime";
import { logger } from "../logger";

const UPLOAD_DIR = path.resolve(process.cwd(), "uploads/plugins");
const INSTALLED_DIR = path.resolve(process.cwd(), "src/plugins/installed");

const VALID_PERMISSIONS = new Set([
  "prospects:read","prospects:write","pipeline:read","pipeline:write",
  "sequences:read","sequences:write","signals:read","signals:write",
  "analytics:read","workflows:read","workflows:write","webhooks:send",
  "email:send","contacts:read","contacts:write","memory:read","memory:write",
  "meetings:read","meetings:write","accounts:read","accounts:write",
  "ai:generate","emails:write","deals:read","ai:analyze",
]);

export const UploadedManifestSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "id must be lowercase-alphanumeric with hyphens"),
  name: z.string().min(1).max(128),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver"),
  description: z.string().max(512).optional(),
  author: z.string().max(128).optional().default("Unknown"),
  permissions: z.array(z.string()).default([]),
  dependencies: z.array(z.string()).default([]),
  uiSlots: z.array(z.string()).default([]),
  routes: z.array(z.object({
    path: z.string(),
    label: z.string(),
    icon: z.string().optional(),
  })).default([]),
  extends: z.string().optional(),
  entryPoint: z.string().optional(),
});

export type UploadedPluginManifest = z.infer<typeof UploadedManifestSchema>;

export interface UploadedPlugin {
  id: string;
  slug: string;
  name: string;
  version: string;
  description: string | null;
  author: string;
  manifest: UploadedPluginManifest;
  files_path: string;
  state: "uploaded" | "installed" | "active" | "error";
  extends: string | null;
  error_msg: string | null;
  created_at: Date;
  activated_at: Date | null;
}

async function ensureDirs() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  await fs.mkdir(INSTALLED_DIR, { recursive: true });
}

class PluginUploaderService {
  /**
   * Extract ZIP buffer, validate manifest.json, persist to DB.
   */
  async uploadPlugin(zipBuffer: Buffer, slug: string): Promise<{ manifest: UploadedPluginManifest; filesPath: string }> {
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug)) {
      throw new Error(`Invalid slug "${slug}": must be lowercase-alphanumeric with hyphens`);
    }
    await ensureDirs();
    const extractPath = path.join(UPLOAD_DIR, slug);
    await fs.rm(extractPath, { recursive: true, force: true });

    let zip: AdmZip;
    try { zip = new AdmZip(zipBuffer); }
    catch { throw new Error("Invalid ZIP file"); }
    zip.extractAllTo(extractPath, true);

    const manifestPath = path.join(extractPath, "manifest.json");
    let rawManifest: unknown;
    try {
      rawManifest = JSON.parse(await fs.readFile(manifestPath, "utf-8"));
    } catch {
      await fs.rm(extractPath, { recursive: true, force: true });
      throw new Error("manifest.json missing or invalid JSON at ZIP root");
    }

    const parsed = UploadedManifestSchema.safeParse(rawManifest);
    if (!parsed.success) {
      await fs.rm(extractPath, { recursive: true, force: true });
      throw new Error(`Invalid manifest: ${parsed.error.issues.map(i => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    }

    const manifest = parsed.data;
    if (manifest.id !== slug) {
      await fs.rm(extractPath, { recursive: true, force: true });
      throw new Error(`manifest.id "${manifest.id}" must match slug "${slug}"`);
    }

    await pool.query(
      `INSERT INTO uploaded_plugins (slug,name,version,description,author,manifest,files_path,state,extends,error_msg)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,'uploaded',$8,NULL)
       ON CONFLICT (slug) DO UPDATE SET
         name=$2,version=$3,description=$4,author=$5,manifest=$6::jsonb,
         files_path=$7,state='uploaded',extends=$8,error_msg=NULL`,
      [slug, manifest.name, manifest.version, manifest.description ?? null,
       manifest.author ?? "Unknown", JSON.stringify(manifest), extractPath, manifest.extends ?? null],
    );
    logger.info({ slug, version: manifest.version }, "Plugin uploaded");
    return { manifest, filesPath: extractPath };
  }

  /**
   * Copy files → installed dir, set state = installed.
   */
  async installPlugin(slug: string): Promise<void> {
    const plugin = await this.getPlugin(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found`);
    if (plugin.state === "installed" || plugin.state === "active")
      throw new Error(`Plugin "${slug}" is already ${plugin.state}`);

    await ensureDirs();
    const destPath = path.join(INSTALLED_DIR, slug);
    await fs.rm(destPath, { recursive: true, force: true });
    await fs.cp(plugin.files_path, destPath, { recursive: true });
    await pool.query(
      `UPDATE uploaded_plugins SET state='installed',files_path=$2,error_msg=NULL WHERE slug=$1`,
      [slug, destPath],
    );
    logger.info({ slug }, "Plugin installed");
  }

  /**
   * Register manifest with pluginManager and enable the plugin.
   */
  async activatePlugin(slug: string): Promise<void> {
    const plugin = await this.getPlugin(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found`);
    if (plugin.state === "active") return;
    if (plugin.state !== "installed")
      throw new Error(`Plugin "${slug}" must be installed before activation (state: ${plugin.state})`);

    try {
      const safeManifest = {
        ...plugin.manifest,
        permissions: plugin.manifest.permissions.filter(p => VALID_PERMISSIONS.has(p)),
      };
      pluginManager.register(safeManifest);
      await pluginManager.enable(slug);
      await pool.query(
        `UPDATE uploaded_plugins SET state='active',activated_at=NOW(),error_msg=NULL WHERE slug=$1`,
        [slug],
      );
      logger.info({ slug }, "Plugin activated");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      await pool.query(`UPDATE uploaded_plugins SET state='error',error_msg=$2 WHERE slug=$1`, [slug, msg]);
      logger.error({ err, slug }, "Plugin activation failed");
      throw err;
    }
  }

  /**
   * Disable in pluginManager, set state = installed.
   */
  async deactivatePlugin(slug: string): Promise<void> {
    const plugin = await this.getPlugin(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found`);
    if (plugin.state !== "active") return;
    try { await pluginManager.disable(slug); }
    catch (err) { logger.warn({ err, slug }, "Runtime disable failed, forcing DB state"); }
    await pool.query(`UPDATE uploaded_plugins SET state='installed' WHERE slug=$1`, [slug]);
    logger.info({ slug }, "Plugin deactivated");
  }

  /**
   * Deactivate + remove files + delete DB row.
   */
  async deletePlugin(slug: string): Promise<void> {
    const plugin = await this.getPlugin(slug);
    if (!plugin) throw new Error(`Plugin "${slug}" not found`);
    if (plugin.state === "active") await this.deactivatePlugin(slug);
    for (const p of [plugin.files_path, path.join(UPLOAD_DIR, slug)]) {
      try { await fs.rm(p, { recursive: true, force: true }); } catch {}
    }
    await pool.query(`DELETE FROM uploaded_plugins WHERE slug=$1`, [slug]);
    logger.info({ slug }, "Plugin deleted");
  }

  async listPlugins(): Promise<UploadedPlugin[]> {
    const r = await pool.query<UploadedPlugin>(
      `SELECT id,slug,name,version,description,author,manifest,files_path,state,extends,error_msg,created_at,activated_at
       FROM uploaded_plugins ORDER BY created_at DESC`,
    );
    return r.rows;
  }

  async getPlugin(slug: string): Promise<UploadedPlugin | null> {
    const r = await pool.query<UploadedPlugin>(
      `SELECT * FROM uploaded_plugins WHERE slug=$1`,
      [slug],
    );
    return r.rows[0] ?? null;
  }

  /** Returns a Hello World plugin manifest JSON for testing */
  helloWorldExample(): object {
    return {
      id: "hello-world",
      name: "Hello World Plugin",
      version: "1.0.0",
      description: "Minimal example plugin for testing the upload system",
      author: "GrowthOS Labs",
      permissions: ["analytics:read"],
      dependencies: [],
      routes: [{ path: "/hello-world", label: "Hello World", icon: "Sparkles" }],
      uiSlots: [],
    };
  }
}

export const pluginUploaderService = new PluginUploaderService();
