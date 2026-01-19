import { defineConfig } from "vite";
import { resolve } from "path";
import { builtinModules } from "module";

// https://vitejs.dev/config
// Note: Forge Vite plugin handles entry/output - only specify resolve and externals
export default defineConfig({
  resolve: {
    alias: {
      "@shared": resolve(__dirname, "src/shared"),
      "@main": resolve(__dirname, "src/main"),
    },
  },
  build: {
    rollupOptions: {
      external: [
        "electron",
        "better-sqlite3",
        "node-pty",
        "electron-liquid-glass",
        "@anthropic-ai/claude-agent-sdk",
        // All Node.js built-ins
        ...builtinModules,
        ...builtinModules.map((m) => `node:${m}`),
      ],
    },
    sourcemap: true,
  },
});
