import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerDMG } from "@electron-forge/maker-dmg";
import { MakerZIP } from "@electron-forge/maker-zip";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { VitePlugin } from "@electron-forge/plugin-vite";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { existsSync, readdirSync, rmSync, statSync } from "fs";
import { join } from "path";

/**
 * Calculate directory size recursively
 */
function getDirSize(dirPath: string): number {
  let size = 0;
  const entries = readdirSync(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      size += getDirSize(fullPath);
    } else {
      size += statSync(fullPath).size;
    }
  }
  return size;
}

/**
 * Map Forge platform/arch to ripgrep directory naming convention
 */
const platformMap: Record<string, string> = {
  "darwin-arm64": "arm64-darwin",
  "darwin-x64": "x64-darwin",
  "linux-arm64": "arm64-linux",
  "linux-x64": "x64-linux",
  "win32-x64": "x64-win32",
};

const config: ForgeConfig = {
  packagerConfig: {
    name: "BetterCode",
    executableName: "BetterCode",
    appBundleId: "app.bettercode.desktop",
    appCategoryType: "public.app-category.developer-tools",
    icon: "build/icon",
    asar: {
      unpack: "**/{*.node,better-sqlite3,node-pty,electron-liquid-glass,@anthropic-ai,bindings,file-uri-to-path}/**/*",
    },
    extraResource: [
      "drizzle",
      "app-update.yml",
      // Platform-specific binaries are handled via hooks
    ],
    // Note: ignore patterns are handled automatically by Forge Vite plugin

    // macOS signing configuration
    osxSign: {
      optionsForFile: () => ({
        entitlements: "build/entitlements.mac.plist",
        hardenedRuntime: true,
      }),
    },
    // Notarization (only when env vars are set)
    ...(process.env.APPLE_ID && {
      osxNotarize: {
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD || "",
        teamId: process.env.APPLE_TEAM_ID || "",
      },
    }),
  },

  rebuildConfig: {
    force: true,
  },

  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "src/main/index.ts",
          config: "vite.main.config.ts",
          target: "main",
        },
        {
          entry: "src/preload/preload.ts",
          config: "vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.ts",
        },
      ],
    }),
    new AutoUnpackNativesPlugin({}),
  ],

  makers: [
    // macOS
    new MakerDMG({
      background: "build/dmg-background.png",
      icon: "build/icon.icns",
      iconSize: 80,
      format: "ULFO",
    }),
    new MakerZIP({}, ["darwin"]),

    // Windows
    new MakerSquirrel({
      name: "BetterCode",
      iconUrl: "https://raw.githubusercontent.com/your-org/bettercode/main/build/icon.ico",
      setupIcon: "build/icon.ico",
    }),

    // Linux
    new MakerDeb({
      options: {
        maintainer: "BetterCode",
        homepage: "https://bettercode.app",
        icon: "build/icon.png",
        categories: ["Development"],
      },
    }),
    new MakerRpm({
      options: {
        homepage: "https://bettercode.app",
        icon: "build/icon.png",
        categories: ["Development"],
      },
    }),
  ],

  hooks: {
    // Copy native modules and platform-specific binaries
    packageAfterCopy: async (_config, buildPath, _electronVersion, platform, arch) => {
      const fs = await import("fs/promises");
      const path = await import("path");
      const { cpSync } = await import("fs");

      // Copy native modules that were externalized in Vite
      const nativeModules = ["better-sqlite3", "node-pty", "electron-liquid-glass", "node-gyp-build"];
      const nodeModulesDest = path.join(buildPath, "node_modules");
      await fs.mkdir(nodeModulesDest, { recursive: true });

      for (const mod of nativeModules) {
        const src = path.join(process.cwd(), "node_modules", mod);
        const dest = path.join(nodeModulesDest, mod);
        if (existsSync(src)) {
          cpSync(src, dest, { recursive: true });
          console.log(`[Forge] Copied native module: ${mod}`);
        }
      }

      // Copy @anthropic-ai/claude-agent-sdk (has native ripgrep binaries)
      const sdkSrc = path.join(process.cwd(), "node_modules", "@anthropic-ai");
      const sdkDest = path.join(nodeModulesDest, "@anthropic-ai");
      if (existsSync(sdkSrc)) {
        cpSync(sdkSrc, sdkDest, { recursive: true });
        console.log("[Forge] Copied @anthropic-ai/claude-agent-sdk");
      }

      // Copy bindings dependency (required by better-sqlite3)
      const bindingsSrc = path.join(process.cwd(), "node_modules", "bindings");
      if (existsSync(bindingsSrc)) {
        cpSync(bindingsSrc, path.join(nodeModulesDest, "bindings"), { recursive: true });
      }

      // Copy file-uri-to-path dependency (required by bindings)
      const fileUriSrc = path.join(process.cwd(), "node_modules", "file-uri-to-path");
      if (existsSync(fileUriSrc)) {
        cpSync(fileUriSrc, path.join(nodeModulesDest, "file-uri-to-path"), { recursive: true });
      }

      // Copy nan dependency (might be needed for native modules)
      const nanSrc = path.join(process.cwd(), "node_modules", "nan");
      if (existsSync(nanSrc)) {
        cpSync(nanSrc, path.join(nodeModulesDest, "nan"), { recursive: true });
      }

      // Copy Claude binaries for this platform
      const binSrc = path.join(process.cwd(), "resources", "bin", `${platform}-${arch}`);
      const binDest = path.join(buildPath, "resources", "bin");

      if (existsSync(binSrc)) {
        await fs.mkdir(binDest, { recursive: true });
        const files = await fs.readdir(binSrc);
        for (const file of files) {
          await fs.copyFile(path.join(binSrc, file), path.join(binDest, file));
        }
        console.log(`[Forge] Copied Claude binaries for ${platform}-${arch}`);
      }

      // Copy VERSION file
      const versionSrc = path.join(process.cwd(), "resources", "bin", "VERSION");
      if (existsSync(versionSrc)) {
        await fs.copyFile(versionSrc, path.join(binDest, "VERSION"));
      }
    },

    // Cleanup after packaging (replaces afterPack.js)
    packageAfterPrune: async (_config, buildPath, _electronVersion, platform, arch) => {
      const targetPlatform = platformMap[`${platform}-${arch}`];
      if (!targetPlatform) {
        console.log(`[Forge] Unknown platform: ${platform}-${arch}, skipping cleanup`);
        return;
      }

      console.log(`[Forge] Target platform: ${targetPlatform}`);

      // Clean up ripgrep binaries (keep only target platform)
      const ripgrepDir = join(
        buildPath,
        "node_modules",
        "@anthropic-ai",
        "claude-agent-sdk",
        "vendor",
        "ripgrep"
      );

      if (existsSync(ripgrepDir)) {
        const entries = readdirSync(ripgrepDir, { withFileTypes: true });
        let removedSize = 0;

        for (const entry of entries) {
          if (!entry.isDirectory()) continue;
          if (entry.name !== targetPlatform) {
            const dirPath = join(ripgrepDir, entry.name);
            console.log(`[Forge] Removing non-target platform: ${entry.name}`);
            const dirSize = getDirSize(dirPath);
            removedSize += dirSize;
            rmSync(dirPath, { recursive: true, force: true });
          }
        }

        console.log(
          `[Forge] Removed ${(removedSize / 1024 / 1024).toFixed(1)} MB of unused ripgrep binaries`
        );
      }

      // Clean up better-sqlite3 build artifacts
      const betterSqlite3Dir = join(buildPath, "node_modules", "better-sqlite3");

      if (existsSync(betterSqlite3Dir)) {
        let sqlite3Removed = 0;

        // Remove SQLite source files (deps/ folder ~9.5MB)
        const depsDir = join(betterSqlite3Dir, "deps");
        if (existsSync(depsDir)) {
          const size = getDirSize(depsDir);
          sqlite3Removed += size;
          rmSync(depsDir, { recursive: true, force: true });
        }

        // Remove build object files
        const objDir = join(betterSqlite3Dir, "build", "Release", "obj");
        if (existsSync(objDir)) {
          const size = getDirSize(objDir);
          sqlite3Removed += size;
          rmSync(objDir, { recursive: true, force: true });
        }

        // Remove C source files
        const srcDir = join(betterSqlite3Dir, "src");
        if (existsSync(srcDir)) {
          const size = getDirSize(srcDir);
          sqlite3Removed += size;
          rmSync(srcDir, { recursive: true, force: true });
        }

        // Remove test_extension.node
        const testExt = join(betterSqlite3Dir, "build", "Release", "test_extension.node");
        if (existsSync(testExt)) {
          sqlite3Removed += statSync(testExt).size;
          rmSync(testExt);
        }

        // Remove node_gyp_bins
        const nodeGypBins = join(betterSqlite3Dir, "build", "node_gyp_bins");
        if (existsSync(nodeGypBins)) {
          const size = getDirSize(nodeGypBins);
          sqlite3Removed += size;
          rmSync(nodeGypBins, { recursive: true, force: true });
        }

        if (sqlite3Removed > 0) {
          console.log(
            `[Forge] Removed ${(sqlite3Removed / 1024 / 1024).toFixed(1)} MB of better-sqlite3 build artifacts`
          );
        }
      }
    },
  },
};

export default config;
