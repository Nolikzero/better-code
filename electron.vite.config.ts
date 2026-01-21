import { defineConfig } from "electron-vite";
import { resolve } from "path";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
        "@main": resolve(__dirname, "src/main"),
      },
    },
    build: {
      sourcemap: true,
      // Disable auto-externalization - bundle ALL pure JS deps
      externalizeDeps: false,
      rollupOptions: {
        // Only externalize native modules (can't be bundled by Vite)
        external: [
          "better-sqlite3",
          "node-pty",
          "electron-liquid-glass",
          "@anthropic-ai/claude-agent-sdk",
        ],
      },
    },
  },
  preload: {
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "src/shared"),
      },
    },
    build: {
      sourcemap: true,
      // Preload must bundle everything for sandbox support
      externalizeDeps: false,
    },
  },
  renderer: {
    root: resolve(__dirname, "src/renderer"),
    plugins: [tailwindcss(), react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src/renderer"),
        "@shared": resolve(__dirname, "src/shared"),
        "@main": resolve(__dirname, "src/main"),
      },
    },
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, "src/renderer/index.html"),
        },
        output: {
          manualChunks: {
            "vendor-react": ["react", "react-dom"],
            "vendor-icons": ["lucide-react"],
            "vendor-ui": [
              "@radix-ui/react-dialog",
              "@radix-ui/react-dropdown-menu",
              "@radix-ui/react-select",
              "@radix-ui/react-tooltip",
              "@radix-ui/react-popover",
            ],
          },
        },
      },
    },
  },
});
