import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
// ✅ Removed nanoid import - no longer needed

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
  };

  // ✅ Get the absolute path to client directory
  const clientRoot = path.resolve(__dirname, "..", "client");

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    root: clientRoot,  // ✅ Explicitly set root to client directory
    resolve: {
      alias: {
        "@": path.resolve(clientRoot, "src"),  // ✅ Ensure @ alias resolves correctly
        "@shared": path.resolve(__dirname, "..", "shared"),
        "@assets": path.resolve(__dirname, "..", "attached_assets"),
      },
      dedupe: ['react', 'react-dom'],
    },
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        // Don't exit on Vite errors in dev mode
        if (process.env.NODE_ENV !== 'development') {
          process.exit(1);
        }
      },
    },
    server: {
      ...serverOptions,
      fs: {
        strict: false,  // ✅ Allow access to files
        allow: [clientRoot, path.resolve(__dirname, "..")],  // ✅ Explicitly allow client and root
      },
    },
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Fast fail for missing static assets to prevent them from being processed as HTML
    if (url.match(/\.(json|map|ico|png|jpg|svg|woff2?)(\?.*)?$/)) {
      res.status(404).end();
      return;
    }

    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      const template = await fs.promises.readFile(clientTemplate, "utf-8");
      // ✅ Removed nanoid() version parameter - Vite handles cache busting internally
      // The random version was causing file resolution issues
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "..", "dist", "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html only for non-asset requests (SPA routing)
  app.use("*", (req, res) => {
    const url = req.originalUrl;
    // Let asset requests 404 properly so the browser gets a real error, not HTML
    if (url.startsWith("/assets/") || url.match(/\.(js|css|wasm|map|ico|png|jpg|svg|woff2?)(\?.*)?$/)) {
      res.status(404).end();
      return;
    }
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
