import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    // @roastr/shared compiles to CommonJS (NodeNext + no "type": "module" in
    // its package.json). Rollup's default commonjs handling can fail to
    // detect named exports (e.g. PLAN_LIMITS) through its `export *`
    // re-export chain (index.ts -> constants/plans.ts) unless it's told to
    // transform this workspace package the same way it transforms
    // node_modules CJS deps.
    commonjsOptions: {
      include: [/node_modules/, /packages\/shared/],
      transformMixedEsModules: true,
    },
  },
  optimizeDeps: {
    // Same CJS interop issue as build.commonjsOptions, but for the dev
    // server: without this, esbuild serves @roastr/shared's raw CJS
    // (`exports.X = ...`) straight to the browser, which isn't valid ESM
    // and crashes the whole app at import time.
    include: ["@roastr/shared"],
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
});
