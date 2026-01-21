import { desc, eq, isNull } from "drizzle-orm";
import { app, Menu, nativeImage, Tray } from "electron";
import { join } from "path";
import { createMainWindow, getWindow } from "../windows/main";
import { chats, getDatabase, projects } from "./db";

const MAX_RECENT_CHATS = 10;
const REFRESH_INTERVAL_MS = 30000; // 30 seconds

// State
let tray: Tray | null = null;

interface RecentChat {
  id: string;
  name: string;
  projectName: string;
}

/**
 * Get tray icon path based on platform
 */
function getTrayIconPath(): string {
  const isDev = !app.isPackaged;
  const basePath = isDev
    ? join(app.getAppPath(), "build")
    : join(process.resourcesPath, "icons");

  if (process.platform === "darwin") {
    return join(basePath, "trayTemplate.png");
  } else if (process.platform === "win32") {
    // Windows: use PNG (could be .ico if available)
    return join(basePath, "tray.png");
  } else {
    return join(basePath, "tray.png");
  }
}

/**
 * Get recent chats with project info for tray menu
 */
function getRecentChats(): RecentChat[] {
  try {
    const db = getDatabase();

    const rows = db
      .select({
        chatId: chats.id,
        chatName: chats.name,
        chatBranch: chats.branch,
        projectName: projects.name,
      })
      .from(chats)
      .leftJoin(projects, eq(projects.id, chats.projectId))
      .where(isNull(chats.archivedAt))
      .orderBy(desc(chats.updatedAt))
      .limit(MAX_RECENT_CHATS)
      .all();

    return rows.map((row) => ({
      id: row.chatId,
      name: row.chatName || row.chatBranch || "Untitled",
      projectName: row.projectName || "Unknown Project",
    }));
  } catch (error) {
    console.error("[Tray] Failed to get recent chats:", error);
    return [];
  }
}

/**
 * Navigate to a specific chat
 */
function navigateToChat(chatId: string): void {
  const win = getWindow();
  if (win) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    win.webContents.send("tray:navigate-to-chat", { chatId });
  } else {
    // No window exists, create one and navigate after ready
    const newWin = createMainWindow();
    newWin.once("ready-to-show", () => {
      newWin.webContents.send("tray:navigate-to-chat", { chatId });
    });
  }
}

/**
 * Toggle window visibility
 */
function toggleWindowVisibility(): void {
  const win = getWindow();
  if (!win) {
    createMainWindow();
    return;
  }

  if (win.isVisible() && win.isFocused()) {
    win.hide();
  } else {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
  }
}

/**
 * Create new chat
 */
function createNewChat(): void {
  const win = getWindow();
  if (!win) {
    const newWin = createMainWindow();
    newWin.once("ready-to-show", () => {
      newWin.webContents.send("shortcut:new-agent");
    });
    return;
  }

  win.show();
  win.focus();
  win.webContents.send("shortcut:new-agent");
}

/**
 * Open preferences
 */
function openPreferences(): void {
  const win = getWindow();
  if (!win) {
    const newWin = createMainWindow();
    newWin.once("ready-to-show", () => {
      newWin.webContents.send("tray:open-preferences");
    });
    return;
  }

  win.show();
  win.focus();
  win.webContents.send("tray:open-preferences");
}

/**
 * Build and set the tray context menu
 */
export function buildTrayMenu(): void {
  if (!tray) return;

  const recentChats = getRecentChats();
  const win = getWindow();
  const isWindowVisible = win?.isVisible() && win?.isFocused();

  const template: Electron.MenuItemConstructorOptions[] = [
    // Show/Hide Window
    {
      label: isWindowVisible ? "Hide Window" : "Show BetterCode",
      click: toggleWindowVisibility,
    },
    { type: "separator" },

    // New Chat
    {
      label: "New Chat",
      click: createNewChat,
    },
    { type: "separator" },

    // Recent Chats submenu
    {
      label: "Recent Chats",
      submenu:
        recentChats.length > 0
          ? recentChats.map((chat) => ({
              label: `${chat.name} - ${chat.projectName}`,
              click: () => navigateToChat(chat.id),
            }))
          : [{ label: "No recent chats", enabled: false }],
    },
    { type: "separator" },

    // Preferences
    {
      label: "Preferences...",
      click: openPreferences,
    },
    { type: "separator" },

    // Quit
    {
      label: "Quit BetterCode",
      click: () => app.quit(),
    },
  ];

  const contextMenu = Menu.buildFromTemplate(template);
  tray.setContextMenu(contextMenu);
}

/**
 * Update tray status indicator for active sessions
 */
export function updateTrayStatus(activeCount: number): void {
  if (!tray) return;

  // Update tooltip to show active sessions
  const tooltip =
    activeCount > 0
      ? `BetterCode - ${activeCount} active session${activeCount > 1 ? "s" : ""}`
      : "BetterCode";
  tray.setToolTip(tooltip);

  // On macOS, use setTitle for menubar text
  if (process.platform === "darwin") {
    tray.setTitle(activeCount > 0 ? String(activeCount) : "");
  }
}

/**
 * Initialize system tray
 * Returns cleanup function
 */
export function initTray(): () => void {
  console.log("[Tray] Initializing system tray");

  try {
    // Create tray icon
    const iconPath = getTrayIconPath();
    console.log("[Tray] Loading icon from:", iconPath);

    const icon = nativeImage.createFromPath(iconPath);

    // On macOS, mark as template image for automatic dark/light handling
    if (process.platform === "darwin") {
      icon.setTemplateImage(true);
    }

    tray = new Tray(icon);
    tray.setToolTip("BetterCode");

    // Platform-specific click behavior
    if (process.platform === "win32") {
      // Windows: left-click shows window
      tray.on("click", () => {
        toggleWindowVisibility();
      });
    }
    // macOS & Linux: clicking shows context menu (default behavior)

    // Build initial menu
    buildTrayMenu();

    // Refresh menu periodically (matches dock menu pattern)
    const intervalId = setInterval(buildTrayMenu, REFRESH_INTERVAL_MS);

    // Also refresh when window visibility changes
    const win = getWindow();
    if (win) {
      win.on("show", buildTrayMenu);
      win.on("hide", buildTrayMenu);
      win.on("focus", buildTrayMenu);
      win.on("blur", buildTrayMenu);
    }

    console.log("[Tray] System tray initialized successfully");

    // Return cleanup function
    return () => {
      console.log("[Tray] Cleaning up system tray");
      clearInterval(intervalId);
      if (tray) {
        tray.destroy();
        tray = null;
      }
    };
  } catch (error) {
    console.error("[Tray] Failed to initialize system tray:", error);
    return () => {}; // No-op cleanup
  }
}

/**
 * Get the tray instance
 */
export function getTray(): Tray | null {
  return tray;
}
