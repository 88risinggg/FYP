import { fileURLToPath, URL } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "0.0.0.0",
    port: 5173,
    proxy: {
      "/api": "http://127.0.0.1:5000",
      "/uploads": "http://127.0.0.1:5000"
    }
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  },
  build: {
    // Keep the production client beside the Express application so Discloud's
    // runtime image retains it together with the server source.
    outDir: "../server/public",
    emptyOutDir: true
  }
});
