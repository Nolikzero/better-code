import type { BrowserWindow } from "electron";
import { createGitRouter } from "../../git";
import { router } from "../index";
import { agentsRouter } from "./agents";
import { chatRouter } from "./chat";
import { chatsRouter } from "./chats";
import { debugRouter } from "./debug";
import { externalRouter } from "./external";
import { filesRouter } from "./files";
import { projectsRouter } from "./projects";
import { providersRouter } from "./providers";
import { skillsRouter } from "./skills";
import { terminalRouter } from "./terminal";
import { windowRouter } from "./window";
import { worktreeInitRouter } from "./worktree-init";

/**
 * Create the main app router
 * Uses getter pattern to avoid stale window references
 */
export function createAppRouter(_getWindow: () => BrowserWindow | null) {
  return router({
    projects: projectsRouter,
    chats: chatsRouter,
    chat: chatRouter,
    terminal: terminalRouter,
    external: externalRouter,
    files: filesRouter,
    debug: debugRouter,
    skills: skillsRouter,
    agents: agentsRouter,
    window: windowRouter,
    providers: providersRouter,
    worktreeInit: worktreeInitRouter,
    // Git operations - named "changes" to match Superset API
    changes: createGitRouter(),
  });
}

/**
 * Export the router type for client usage
 */
export type AppRouter = ReturnType<typeof createAppRouter>;
