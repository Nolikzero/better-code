import { app, BrowserWindow, Menu } from "electron";
import log from "electron-log";
import { existsSync, readFileSync, readlinkSync, unlinkSync } from "fs";
import { join } from "path";

// Enable file logging in both dev and production
log.transports.file.level = "info";

if (app.isPackaged) {
  Object.assign(console, log.functions);
}

import {
  checkForUpdates,
  downloadUpdate,
  initAutoUpdater,
  setupFocusUpdateCheck,
} from "./lib/auto-updater";
import { closeDatabase, initDatabase } from "./lib/db";
import { initDockMenu } from "./lib/dock-menu";
import { branchWatcher } from "./lib/git/branch-watcher";
import { initializeProviders, shutdownProviders } from "./lib/providers/init";
import { initTray, updateTrayStatus } from "./lib/tray-menu";
import { createMainWindow, getWindow } from "./windows/main";

// Dev mode detection - use process.env.NODE_ENV for initial setup
// (app.isPackaged isn't available until app is ready in some contexts)
const IS_DEV = process.env.NODE_ENV === "development";

// Set dev mode userData path BEFORE requestSingleInstanceLock()
// This ensures dev and prod have separate instance locks
if (IS_DEV && app) {
  const devUserData = join(app.getPath("userData"), "..", "BetterCode Dev");
  app.setPath("userData", devUserData);
  console.log("[Dev] Using separate userData path:", devUserData);
}

// Clean up stale lock files from crashed instances
// Returns true if locks were cleaned, false otherwise
function cleanupStaleLocks(): boolean {
  // Windows uses named mutex for single instance, not symlink locks
  if (process.platform === "win32") return false;

  const userDataPath = app.getPath("userData");
  const lockPath = join(userDataPath, "SingletonLock");

  if (!existsSync(lockPath)) return false;

  try {
    // SingletonLock is a symlink like "hostname-pid"
    const lockTarget = readlinkSync(lockPath);
    const match = lockTarget.match(/-(\d+)$/);
    if (match) {
      const pid = Number.parseInt(match[1], 10);
      try {
        // Check if process is running (signal 0 doesn't kill, just checks)
        process.kill(pid, 0);
        // Process exists, lock is valid
        console.log("[App] Lock held by running process:", pid);
        return false;
      } catch {
        // Process doesn't exist, clean up stale locks
        console.log("[App] Cleaning stale locks (pid", pid, "not running)");
        const filesToRemove = [
          "SingletonLock",
          "SingletonSocket",
          "SingletonCookie",
        ];
        for (const file of filesToRemove) {
          const filePath = join(userDataPath, file);
          if (existsSync(filePath)) {
            try {
              unlinkSync(filePath);
            } catch (e) {
              console.warn("[App] Failed to remove", file, e);
            }
          }
        }
        return true;
      }
    }
  } catch (e) {
    console.warn("[App] Failed to check lock file:", e);
  }
  return false;
}

// Prevent multiple instances
let gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // Maybe stale lock - try cleanup and retry once
  const cleaned = cleanupStaleLocks();
  if (cleaned) {
    gotTheLock = app.requestSingleInstanceLock();
  }
  if (!gotTheLock) {
    app.quit();
  }
}

if (gotTheLock) {
  // Handle second instance launch
  app.on("second-instance", () => {
    const window = getWindow();
    if (window) {
      if (window.isMinimized()) window.restore();
      window.focus();
    }
  });

  // App ready
  app.whenReady().then(async () => {
    // Set dev mode app name (userData path was already set before requestSingleInstanceLock)
    if (IS_DEV) {
      app.name = "BetterCode Dev";
    }

    // Set app user model ID for Windows (different in dev to avoid taskbar conflicts)
    if (process.platform === "win32") {
      app.setAppUserModelId(IS_DEV ? "com.bettercode.dev" : "com.bettercode");
    }

    console.log(`[App] Starting BetterCode${IS_DEV ? " (DEV)" : ""}...`);

    // Defer About panel setup to avoid blocking startup with VERSION file read
    // This runs after the critical startup path completes
    const setupAboutPanel = () => {
      let claudeCodeVersion = "unknown";
      try {
        const isDev = !app.isPackaged;
        const versionPath = isDev
          ? join(app.getAppPath(), "resources/bin/VERSION")
          : join(process.resourcesPath, "bin/VERSION");

        if (existsSync(versionPath)) {
          const versionContent = readFileSync(versionPath, "utf-8");
          claudeCodeVersion =
            versionContent.split("\n")[0]?.trim() || "unknown";
        }
      } catch (error) {
        console.warn("[App] Failed to read Claude Code version:", error);
      }

      app.setAboutPanelOptions({
        applicationName: "BetterCode",
        applicationVersion: app.getVersion(),
        version: `Claude Code ${claudeCodeVersion}`,
        copyright: "Copyright © 2026",
      });
    };

    // Track update availability for menu
    let updateAvailable = false;
    let availableVersion: string | null = null;

    // Function to build and set application menu
    const buildMenu = () => {
      const template: Electron.MenuItemConstructorOptions[] = [];

      // App menu (macOS only)
      if (process.platform === "darwin") {
        template.push({
          label: app.name,
          submenu: [
            { role: "about", label: "About BetterCode" },
            {
              label: updateAvailable
                ? `Update to v${availableVersion}...`
                : "Check for Updates...",
              click: () => {
                const win = getWindow();
                if (win) {
                  win.webContents.send("update:manual-check");
                }
                if (updateAvailable) {
                  downloadUpdate();
                } else {
                  checkForUpdates(true);
                }
              },
            },
            { type: "separator" },
            { role: "services" },
            { type: "separator" },
            { role: "hide" },
            { role: "hideOthers" },
            { role: "unhide" },
            { type: "separator" },
            { role: "quit" },
          ],
        });
      }

      // File menu (all platforms)
      const fileSubmenu: Electron.MenuItemConstructorOptions[] = [
        {
          label: "New Chat",
          accelerator: "CmdOrCtrl+N",
          click: () => {
            const win = getWindow();
            if (win) {
              win.webContents.send("shortcut:new-agent");
            }
          },
        },
      ];
      // On Windows/Linux, add quit to File menu
      if (process.platform !== "darwin") {
        fileSubmenu.push(
          { type: "separator" },
          { role: "quit" },
        );
      }
      template.push({ label: "File", submenu: fileSubmenu });

      // Edit menu (all platforms)
      template.push({
        label: "Edit",
        submenu: [
          { role: "undo" },
          { role: "redo" },
          { type: "separator" },
          { role: "cut" },
          { role: "copy" },
          { role: "paste" },
          { role: "selectAll" },
        ],
      });

      // View menu (all platforms)
      template.push({
        label: "View",
        submenu: [
          { role: "reload" },
          { role: "forceReload" },
          { role: "toggleDevTools" },
          { type: "separator" },
          { role: "resetZoom" },
          { role: "zoomIn" },
          { role: "zoomOut" },
          { type: "separator" },
          { role: "togglefullscreen" },
        ],
      });

      // Window menu (platform-aware)
      template.push({
        label: "Window",
        submenu: [
          { role: "minimize" },
          ...(process.platform === "darwin"
            ? [
                { role: "zoom" } as Electron.MenuItemConstructorOptions,
                { type: "separator" } as Electron.MenuItemConstructorOptions,
                { role: "front" } as Electron.MenuItemConstructorOptions,
              ]
            : [{ role: "close" } as Electron.MenuItemConstructorOptions]),
        ],
      });

      // Help menu (all platforms)
      const helpSubmenu: Electron.MenuItemConstructorOptions[] = [
        {
          label: "GitHub",
          click: async () => {
            const { shell } = await import("electron");
            await shell.openExternal("https://github.com");
          },
        },
      ];
      // On Windows/Linux, add update check and about to Help menu
      if (process.platform !== "darwin") {
        helpSubmenu.push(
          { type: "separator" },
          {
            label: updateAvailable
              ? `Update to v${availableVersion}...`
              : "Check for Updates...",
            click: () => {
              const win = getWindow();
              if (win) {
                win.webContents.send("update:manual-check");
              }
              if (updateAvailable) {
                downloadUpdate();
              } else {
                checkForUpdates(true);
              }
            },
          },
          { role: "about", label: "About BetterCode" },
        );
      }
      template.push({ role: "help", submenu: helpSubmenu });

      Menu.setApplicationMenu(Menu.buildFromTemplate(template));
    };

    // Set update state and rebuild menu
    const setUpdateAvailable = (available: boolean, version?: string) => {
      updateAvailable = available;
      availableVersion = version || null;
      buildMenu();
    };

    // Expose setUpdateAvailable globally for auto-updater
    (global as any).__setUpdateAvailable = setUpdateAvailable;

    // Build initial menu
    buildMenu();

    // Initialize database
    try {
      initDatabase();
      console.log("[App] Database initialized");
    } catch (error) {
      console.error("[App] Failed to initialize database:", error);
    }

    // Initialize providers
    try {
      await initializeProviders();
      console.log("[App] Providers initialized");
    } catch (error) {
      console.error("[App] Failed to initialize providers:", error);
    }

    // Create main window
    createMainWindow();

    // Initialize dock menu (macOS only)
    const cleanupDockMenu = initDockMenu();

    // Initialize system tray (all platforms)
    const cleanupTray = initTray();

    // Store cleanup for use in before-quit handler
    (global as any).__cleanupDockMenu = cleanupDockMenu;
    (global as any).__cleanupTray = cleanupTray;

    // Expose updateTrayStatus for renderer to call via IPC
    (global as any).__updateTrayStatus = updateTrayStatus;

    // Deferred startup tasks (run after window is created to improve perceived startup time)
    // Use setImmediate to let the event loop process window rendering first
    setImmediate(() => {
      setupAboutPanel();
    });

    // Initialize auto-updater (production only)
    if (app.isPackaged) {
      await initAutoUpdater(getWindow);
      // Setup update check on window focus (instead of periodic interval)
      setupFocusUpdateCheck(getWindow);
      // Check for updates 30 seconds after startup to let app settle
      // (increased from 5s to avoid network contention during initial load)
      setTimeout(() => {
        checkForUpdates(true);
      }, 30000);
    }

    // macOS: Re-create window when dock icon is clicked
    app.on("activate", () => {
      if (BrowserWindow.getAllWindows().length === 0) {
        createMainWindow();
      }
    });
  });

  // Quit when all windows are closed (except on macOS)
  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
      app.quit();
    }
  });

  // Cleanup before quit
  app.on("before-quit", async () => {
    console.log("[App] Shutting down...");
    // Cleanup dock menu
    if ((global as any).__cleanupDockMenu) {
      (global as any).__cleanupDockMenu();
    }
    // Cleanup system tray
    if ((global as any).__cleanupTray) {
      (global as any).__cleanupTray();
    }
    await branchWatcher.cleanup();
    await shutdownProviders();
    await closeDatabase();
  });

  // Handle uncaught exceptions
  process.on("uncaughtException", (error) => {
    console.error("[App] Uncaught exception:", error);
  });

  process.on("unhandledRejection", (reason, promise) => {
    console.error("[App] Unhandled rejection at:", promise, "reason:", reason);
  });
}
