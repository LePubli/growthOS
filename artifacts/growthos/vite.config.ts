import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

// PORT — only needed for the dev server; falls back to 3000 in production builds
const rawPort = process.env.PORT || "3000";
const port = Number(rawPort);

// BASE_PATH — URL prefix; must default to "/" so Docker/CI builds work without
// explicitly setting this env var (Coolify may pass it as an empty string)
const basePath = process.env.BASE_PATH || "/";

const isReplit =
  process.env.REPL_ID !== undefined && process.env.NODE_ENV !== "production";

export default defineConfig(async () => {
  const plugins: any[] = [react(), tailwindcss()];

  // Replit-only dev plugins — never load in production or outside Replit
  if (isReplit) {
    const [{ default: runtimeErrorOverlay }, { cartographer }, { devBanner }] =
      await Promise.all([
        import("@replit/vite-plugin-runtime-error-modal"),
        import("@replit/vite-plugin-cartographer"),
        import("@replit/vite-plugin-dev-banner"),
      ]);
    plugins.push(
      runtimeErrorOverlay(),
      cartographer({ root: path.resolve(import.meta.dirname, "..") }),
      devBanner(),
    );
  }

  return {
    base: basePath,
    plugins,
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "src"),
      },
      dedupe: ["react", "react-dom"],
    },
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      strictPort: true,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: {
        strict: true,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
