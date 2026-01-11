import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import open from "open";

// --------------------------------------------------------------
// Vite Configuration — LAN Accessible + Stable HMR
// --------------------------------------------------------------

const DEV_LAN_IP = "192.168.0.75"; // 🔁 CHANGE THIS IF YOUR IP CHANGES

export default defineConfig({
  plugins: [
    react({
      fastRefresh: true,
      jsxRuntime: "automatic",

      // Optional future optimization
      babel: {
        plugins: [["babel-plugin-react-compiler"]],
      },
    }),

    // ----------------------------------------------------------
    // AUTO-OPEN (DEV MACHINE ONLY)
    // ----------------------------------------------------------
    {
      name: "auto-open-dev-browser",
      configureServer(server) {
        let opened = false;

        server.httpServer?.once("listening", () => {
          if (!opened) {
            const port = server.config.server.port;

            // Only auto-open on the machine running Vite
            open(`http://localhost:${port}`);
            opened = true;
          }
        });
      },
    },
  ],

  // --------------------------------------------------------------
  // DEV SERVER (LAN ENABLED)
  // --------------------------------------------------------------
  server: {
    host: true, // Bind to 0.0.0.0 (LAN + localhost)
    port: 5173,
    strictPort: true,
    open: false, // We handle open manually

    // ----------------------------------------------------------
    // HMR — FIXED FOR LAN
    // ----------------------------------------------------------
    hmr: {
      protocol: "ws",
      host: DEV_LAN_IP, // 🔑 CRITICAL FIX
      port: 5173,
      overlay: true,
    },

    watch: {
      usePolling: false,
      interval: 100,
    },
  },

  // --------------------------------------------------------------
  // PREVIEW MODE (npm run preview)
  // --------------------------------------------------------------
  preview: {
    host: true,
    port: 5173,
    strictPort: true,
  },

  // --------------------------------------------------------------
  // PATH ALIASES
  // --------------------------------------------------------------
  resolve: {
    alias: {
      "@": "/src",
      "@components": "/src/components",
      "@css": "/src/css",
      "@pages": "/src/pages",
      "@data": "/src/data",
    },
  },

  // --------------------------------------------------------------
  // BUILD OPTIMIZATION
  // --------------------------------------------------------------
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 800,
    cssMinify: true,
    minify: "esbuild",
  },
});
