import { spawn } from "node:child_process";
import { shell } from "electron";
import { z } from "zod";
import {
  clearDetectionCache,
  detectInstalledApps,
  openInApp,
} from "../../external";
import { publicProcedure, router } from "../index";

/**
 * External router for shell operations (open in finder, open in editor, etc.)
 */
export const externalRouter = router({
  openInFinder: publicProcedure
    .input(z.string())
    .mutation(async ({ input: path }) => {
      shell.showItemInFolder(path);
      return { success: true };
    }),

  openFileInEditor: publicProcedure
    .input(
      z.object({
        path: z.string(),
        cwd: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const { path, cwd } = input;

      // Try common code editors in order of preference
      const editors = [
        { cmd: "code", args: [path] }, // VS Code
        { cmd: "cursor", args: [path] }, // Cursor
        { cmd: "subl", args: [path] }, // Sublime Text
        { cmd: "atom", args: [path] }, // Atom
        { cmd: "open", args: ["-t", path] }, // macOS default text editor
      ];

      for (const editor of editors) {
        try {
          const child = spawn(editor.cmd, editor.args, {
            cwd: cwd || undefined,
            detached: true,
            stdio: "ignore",
          });
          child.unref();
          return { success: true, editor: editor.cmd };
        } catch {}
      }

      // Fallback: use shell.openPath which opens with default app
      await shell.openPath(path);
      return { success: true, editor: "default" };
    }),

  openExternal: publicProcedure
    .input(z.string())
    .mutation(async ({ input: url }) => {
      await shell.openExternal(url);
      return { success: true };
    }),

  /** Detect installed apps that can open files/folders */
  getInstalledApps: publicProcedure.query(async () => {
    const apps = await detectInstalledApps();
    return { apps };
  }),

  /** Open a path in a specific detected app */
  openInSpecificApp: publicProcedure
    .input(
      z.object({
        appId: z.string(),
        path: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      const apps = await detectInstalledApps();
      const app = apps.find((a) => a.id === input.appId);
      if (!app) {
        throw new Error(`App "${input.appId}" not found or not installed`);
      }
      await openInApp(app, input.path);
      return { success: true };
    }),

  /** Force refresh of detected apps cache */
  refreshInstalledApps: publicProcedure.mutation(async () => {
    clearDetectionCache();
    const apps = await detectInstalledApps();
    return { apps };
  }),
});
