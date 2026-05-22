import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { fileURLToPath } from "url";
import { visualizer } from 'rollup-plugin-visualizer';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => ({
  plugins: [
    react({
      jsxRuntime: 'automatic',
    }),
    // Bundle analyzer (only in analyze mode)
    mode === 'analyze' && visualizer({
      open: true,
      filename: 'dist/bundle-analysis.html',
      gzipSize: true,
      brotliSize: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client", "src"),
      "@shared": path.resolve(__dirname, "shared"),
      "@assets": path.resolve(__dirname, "attached_assets"),
    },
    dedupe: ['react', 'react-dom'],
  },
  build: {
    outDir: path.resolve(__dirname, "dist/public"),
    emptyOutDir: true,
    chunkSizeWarningLimit: 1000,
    // Production optimizations
    minify: 'esbuild',
    ...(mode === 'production' && {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes('node_modules')) return;

            if (id.includes('react') || id.includes('scheduler')) return 'react-vendor';
            if (id.includes('@radix-ui')) return 'radix-vendor';
            if (id.includes('@tanstack/react-query')) return 'query-vendor';
            if (id.includes('@supabase/supabase-js')) return 'supabase-vendor';
            if (id.includes('socket.io-client')) return 'socket-vendor';
            if (id.includes('lucide-react') || id.includes('react-icons')) return 'icons-vendor';
            if (id.includes('recharts') || id.includes('framer-motion') || id.includes('embla-carousel-react')) return 'ui-vendor';
            if (id.includes('html2canvas') || id.includes('jspdf') || id.includes('jspdf-autotable') || id.includes('xlsx')) return 'export-vendor';
            if (id.includes('zod') || id.includes('drizzle-zod')) return 'schema-vendor';
            // Let Rollup decide remaining shared deps to avoid circular chunk groups.
            return undefined;
          },
        }
      }
    }),
  },
  root: path.resolve(__dirname, "client"),
  envDir: path.resolve(__dirname, "."),
  server: {
    fs: {
      strict: false,  // ✅ Allow Vite to access files outside root
      // deny: [".env", ".env.*"],  // Only deny sensitive files
    },
    host: '0.0.0.0',
    port: 5173,
    strictPort: false,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/socket.io': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
}));
