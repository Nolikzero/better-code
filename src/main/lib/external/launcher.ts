import { spawn } from "node:child_process";
import type { ExternalApp } from "@shared/types/external-app.types";
import { getShellEnvironment } from "../git/shell-env";

/** Open a path (file or directory) in the specified app */
export async function openInApp(
  app: ExternalApp,
  targetPath: string,
): Promise<void> {
  let env: NodeJS.ProcessEnv;
  try {
    env = await getShellEnvironment();
  } catch {
    env = process.env;
  }

  const args = app.args.map((arg) => arg.replaceAll("{path}", targetPath));

  const child = spawn(app.command, args, {
    detached: true,
    stdio: "ignore",
    env: { ...process.env, ...env },
    ...(app.useCwd ? { cwd: targetPath } : {}),
  });
  child.unref();
}
