import { defineConfig } from "vite";

export default defineConfig({
  base: "./",
  // Tanpa sourcemap di produksi: tidak dipakai pemain dan memperlambat build. Untuk debug: vite build --sourcemap.
  build: { target: "es2022", assetsInlineLimit: 0, sourcemap: false },
  server: { host: true },
});
