import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  shell,
} from "electron";
import { join } from "path";
import { createIPCHandler } from "trpc-electron/main";
import { initLiquidGlass } from "../lib/liquid-glass";
import { createAppRouter } from "../lib/trpc/routers";

// Register IPC handlers for window operations (only once)
let ipcHandlersRegistered = false;

function registerIpcHandlers(getWindow: () => BrowserWindow | null): void {
  if (ipcHandlersRegistered) return;
  ipcHandlersRegistered = true;

  // App info
  ipcMain.handle("app:version", () => app.getVersion());
  // Note: Update checking is now handled by auto-updater module (lib/auto-updater.ts)
  ipcMain.handle("app:set-badge", (_event, count: number | null) => {
    if (process.platform === "darwin" && app.dock) {
      app.dock.setBadge(count ? String(count) : "");
    }
  });
  ipcMain.handle(
    "app:show-notification",
    (
      _event,
      options: {
        title: string;
        body: string;
        chatId?: string;
        subChatId?: string;
      },
    ) => {
      const { Notification } = require("electron");
      const notification = new Notification({
        title: options.title,
        body: options.body,
      });

      notification.on("click", () => {
        const win = getWindow();
        if (win) {
          win.focus();
          if (options.chatId || options.subChatId) {
            win.webContents.send("notification:clicked", {
              chatId: options.chatId,
              subChatId: options.subChatId,
            });
          }
        }
      });

      notification.show();
    },
  );

  // Window controls
  ipcMain.handle("window:minimize", () => getWindow()?.minimize());
  ipcMain.handle("window:maximize", () => {
    const win = getWindow();
    if (win?.isMaximized()) {
      win.unmaximize();
    } else {
      win?.maximize();
    }
  });
  ipcMain.handle("window:close", () => getWindow()?.close());
  ipcMain.handle(
    "window:is-maximized",
    () => getWindow()?.isMaximized() ?? false,
  );
  ipcMain.handle("window:toggle-fullscreen", () => {
    const win = getWindow();
    if (win) {
      win.setFullScreen(!win.isFullScreen());
    }
  });
  ipcMain.handle(
    "window:is-fullscreen",
    () => getWindow()?.isFullScreen() ?? false,
  );

  // Traffic light visibility control (for hybrid native/custom approach)
  // Uses setWindowButtonVisibility (Electron 40+) to show/hide native traffic lights
  ipcMain.handle(
    "window:set-traffic-light-visibility",
    (_event, visible: boolean) => {
      const win = getWindow();
      if (win && process.platform === "darwin") {
        // In fullscreen, always show native traffic lights
        win.setWindowButtonVisibility(visible || win.isFullScreen());
      }
    },
  );

  // Zoom controls
  ipcMain.handle("window:zoom-in", () => {
    const win = getWindow();
    if (win) {
      const zoom = win.webContents.getZoomFactor();
      win.webContents.setZoomFactor(Math.min(zoom + 0.1, 3));
    }
  });
  ipcMain.handle("window:zoom-out", () => {
    const win = getWindow();
    if (win) {
      const zoom = win.webContents.getZoomFactor();
      win.webContents.setZoomFactor(Math.max(zoom - 0.1, 0.5));
    }
  });
  ipcMain.handle("window:zoom-reset", () => {
    getWindow()?.webContents.setZoomFactor(1);
  });
  ipcMain.handle(
    "window:get-zoom",
    () => getWindow()?.webContents.getZoomFactor() ?? 1,
  );

  // DevTools
  ipcMain.handle("window:toggle-devtools", () => {
    const win = getWindow();
    if (win) {
      win.webContents.toggleDevTools();
    }
  });

  // Shell
  ipcMain.handle("shell:open-external", (_event, url: string) =>
    shell.openExternal(url),
  );

  // Clipboard
  ipcMain.handle("clipboard:write", (_event, text: string) =>
    clipboard.writeText(text),
  );
  ipcMain.handle("clipboard:read", () => clipboard.readText());

  // Dialog
  ipcMain.handle(
    "dialog:showOpenDialog",
    async (
      _event,
      options: {
        title?: string;
        properties?: Array<
          | "openFile"
          | "openDirectory"
          | "multiSelections"
          | "showHiddenFiles"
          | "createDirectory"
          | "promptToCreate"
          | "noResolveAliases"
          | "treatPackageAsDirectory"
          | "dontAddToRecent"
        >;
      },
    ) => {
      const window = getWindow();
      if (!window) {
        return { canceled: true, filePaths: [] };
      }
      return dialog.showOpenDialog(window, options);
    },
  );

  // Tray status update
  ipcMain.handle("tray:update-status", (_event, activeCount: number) => {
    const updateTrayStatus = (global as any).__updateTrayStatus;
    if (updateTrayStatus) {
      updateTrayStatus(activeCount);
    }
  });
}

// Current window reference
let currentWindow: BrowserWindow | null = null;

// Singleton IPC handler (prevents duplicate handlers on macOS window recreation)
let ipcHandler: ReturnType<typeof createIPCHandler> | null = null;

/**
 * Get the current window reference
 * Used by tRPC procedures that need window access
 */
export function getWindow(): BrowserWindow | null {
  return currentWindow;
}

/**
 * Create the main application window
 */
export function createMainWindow(): BrowserWindow {
  // Register IPC handlers before creating window
  registerIpcHandlers(getWindow);

  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 500, // Allow narrow mobile-like mode
    minHeight: 600,
    show: false,
    title: "BetterCode",
    // Transparent background required for macOS vibrancy effect
    // The actual background color is controlled by themes/CSS
    transparent: true,
    backgroundColor: "#00000000",
    // hiddenInset shows native traffic lights inset in the window
    // Traffic lights start hidden via setWindowButtonVisibility, position is for when they're visible
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    trafficLightPosition:
      process.platform === "darwin" ? { x: 15, y: 12 } : undefined,
    webPreferences: {
      preload: join(__dirname, "../preload/preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false, // Required for electron-trpc
      webSecurity: true,
      partition: "persist:main", // Use persistent session for cookies
    },
  });

  // Update current window reference
  currentWindow = window;

  // Setup tRPC IPC handler (singleton pattern)
  if (ipcHandler) {
    // Reuse existing handler, just attach new window
    ipcHandler.attachWindow(window);
  } else {
    // Create new handler with context
    ipcHandler = createIPCHandler({
      router: createAppRouter(getWindow),
      windows: [window],
      createContext: async () => ({
        getWindow,
      }),
    });
  }

  // Show window when ready
  window.on("ready-to-show", () => {
    console.log("[Main] Window ready to show");
    // Hide native traffic lights initially - React TrafficLights component controls visibility
    if (process.platform === "darwin") {
      window.setWindowButtonVisibility(false);
    }
    window.show();
  });

  // Emit fullscreen change events and manage traffic lights
  window.on("enter-full-screen", () => {
    // Always show native traffic lights in fullscreen
    if (process.platform === "darwin") {
      window.setWindowButtonVisibility(true);
    }
    window.webContents.send("window:fullscreen-change", true);
  });
  window.on("leave-full-screen", () => {
    // Hide native traffic lights when exiting fullscreen - React TrafficLights component will show custom ones
    if (process.platform === "darwin") {
      window.setWindowButtonVisibility(false);
    }
    window.webContents.send("window:fullscreen-change", false);
  });

  // Emit focus change events
  window.on("focus", () => {
    window.webContents.send("window:focus-change", true);
  });
  window.on("blur", () => {
    window.webContents.send("window:focus-change", false);
  });

  // Handle external links
  window.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  // Handle window close
  window.on("closed", () => {
    currentWindow = null;
  });

  // Load the renderer - always load main app (no auth check)
  console.log("[Main] Loading main app...");
  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
    window.webContents.openDevTools();
  } else {
    window.loadFile(join(__dirname, "../renderer/index.html"));
  }

  // Page load handler - native traffic lights stay hidden, React controls visibility
  window.webContents.on("did-finish-load", () => {
    console.log("[Main] Page finished loading");

    // Initialize liquid glass module (macOS 26+ Tahoe)
    // The actual enable/disable is controlled by theme via tRPC
    initLiquidGlass();
  });
  window.webContents.on(
    "did-fail-load",
    (_event, errorCode, errorDescription) => {
      console.error("[Main] Page failed to load:", errorCode, errorDescription);
    },
  );

  return window;
}
