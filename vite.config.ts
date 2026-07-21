import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  server: {
    host: true,
    // W:\ is a network drive; native fs.watch throws UNKNOWN, so poll instead.
    watch: { usePolling: true, interval: 300 },
  },
  build: {
    chunkSizeWarningLimit: 1400,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("phaser")) {
            return "phaser";
          }

          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
  },
});
