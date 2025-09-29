import { defineConfig } from "vite";

export default defineConfig({
  root: "./",
  publicDir: "public",
  build: {
    outDir: "dist/demo",
    emptyOutDir: true,
    sourcemap: true,
  },
  server: {
    port: 4173,
  },
});