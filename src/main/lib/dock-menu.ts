import { desc, eq, isNull } from "drizzle-orm";
import { app, Menu } from "electron";
import { getWindow } from "../windows/main";
import { chats, getDatabase, projects } from "./db";

const MAX_RECENT_CHATS = 10;
const REFRESH_INTERVAL_MS = 30000; // 30 seconds

interface RecentChat {
  id: string;
  name: string;
  projectName: string;
}

/**
 * Get recent chats with project info for dock menu
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
    console.error("[DockMenu] Failed to get recent chats:", error);
    return [];
  }
}

/**
 * Navigate to a specific chat
 */
function navigateToChat(chatId: string): void {
  const win = getWindow();
  if (win) {
    // Focus window first
    if (win.isMinimized()) win.restore();
    win.focus();

    // Send navigation event to renderer
    win.webContents.send("dock:navigate-to-chat", { chatId });
  }
}

/**
 * Build and set the dock menu
 */
export function buildDockMenu(): void {
  // Only on macOS
  if (process.platform !== "darwin") {
    console.log("[DockMenu] Not macOS, skipping");
    return;
  }

  if (!app.dock) {
    console.log("[DockMenu] app.dock not available");
    return;
  }

  const recentChats = getRecentChats();
  console.log("[DockMenu] Found", recentChats.length, "recent chats");

  const template: Electron.MenuItemConstructorOptions[] = [];

  if (recentChats.length > 0) {
    // Add chat items directly (no header needed for dock menu)
    for (const chat of recentChats) {
      template.push({
        label: `${chat.name} - ${chat.projectName}`,
        click: () => navigateToChat(chat.id),
      });
    }
  } else {
    template.push({
      label: "No recent chats",
      enabled: false,
    });
  }

  const dockMenu = Menu.buildFromTemplate(template);
  app.dock.setMenu(dockMenu);
  console.log("[DockMenu] Menu set with", template.length, "items");
}

/**
 * Initialize dock menu and set up refresh interval
 * Returns cleanup function
 */
export function initDockMenu(): () => void {
  if (process.platform !== "darwin") {
    return () => {}; // No-op cleanup for non-macOS
  }

  console.log("[DockMenu] Initializing dock menu");

  // Build initial menu
  buildDockMenu();

  // Refresh periodically to keep menu updated
  const intervalId = setInterval(buildDockMenu, REFRESH_INTERVAL_MS);

  return () => {
    console.log("[DockMenu] Cleaning up dock menu");
    clearInterval(intervalId);
  };
}
