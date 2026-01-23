import { execFile } from "node:child_process";
import { access } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { ExternalApp } from "@shared/types/external-app.types";
import { getShellEnvironment } from "../git/shell-env";
import {
  APP_REGISTRY,
  type AppDefinition,
  type AppDetection,
} from "./app-registry";

const execFileAsync = promisify(execFile);

let cachedApps: ExternalApp[] | null = null;
let cacheTimestamp = 0;
let pendingDetection: Promise<ExternalApp[]> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

/** Clear the detection cache */
export function clearDetectionCache(): void {
  cachedApps = null;
  cacheTimestamp = 0;
  pendingDetection = null;
}

/** Detect which registered apps are installed on this system */
export async function detectInstalledApps(): Promise<ExternalApp[]> {
  const now = Date.now();
  if (cachedApps && now - cacheTimestamp < CACHE_TTL_MS) {
    return cachedApps;
  }

  if (pendingDetection) {
    return pendingDetection;
  }

  pendingDetection = doDetection();
  try {
    return await pendingDetection;
  } finally {
    pendingDetection = null;
  }
}

async function doDetection(): Promise<ExternalApp[]> {
  const now = Date.now();
  const platform = process.platform as "darwin" | "win32" | "linux";
  let env: NodeJS.ProcessEnv;
  try {
    env = await getShellEnvironment();
  } catch {
    env = process.env;
  }

  const platformApps = APP_REGISTRY.filter((def) =>
    def.platforms.includes(platform),
  );

  const detectionResults = await Promise.allSettled(
    platformApps.map(async (def) => {
      const isInstalled = await checkAppInstalled(def, platform, env);
      return { def, isInstalled };
    }),
  );

  const results: ExternalApp[] = [];
  for (const result of detectionResults) {
    if (result.status === "fulfilled" && result.value.isInstalled) {
      const { def } = result.value;
      const launch = def.launch[platform];
      if (launch) {
        results.push({
          id: def.id,
          name: def.name,
          category: def.category,
          command: launch.command,
          args: launch.args,
          useCwd: launch.useCwd,
          platforms: def.platforms,
        });
      }
    }
  }

  cachedApps = results;
  cacheTimestamp = now;
  return results;
}

async function checkAppInstalled(
  def: AppDefinition,
  platform: "darwin" | "win32" | "linux",
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  const detection = def.detection[platform];
  if (!detection) return false;

  switch (platform) {
    case "darwin":
      return checkMacOS(detection, env);
    case "win32":
      return checkWindows(detection, env);
    case "linux":
      return checkLinux(detection, env);
    default:
      return false;
  }
}

async function checkMacOS(
  detection: AppDetection,
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  if (detection.appBundles) {
    for (const bundle of detection.appBundles) {
      try {
        await access(join("/Applications", bundle));
        return true;
      } catch {}
      try {
        const home = process.env.HOME || "";
        await access(join(home, "Applications", bundle));
        return true;
      } catch {}
    }
  }

  if (detection.cliCommands) {
    for (const cmd of detection.cliCommands) {
      try {
        await execFileAsync("which", [cmd], { env, timeout: 3000 });
        return true;
      } catch {}
    }
  }

  return false;
}

async function checkWindows(
  detection: AppDetection,
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  if (detection.exeNames) {
    for (const exe of detection.exeNames) {
      try {
        await execFileAsync("where", [exe], { env, timeout: 3000 });
        return true;
      } catch {}
    }
  }

  if (detection.programFilesPaths) {
    const programFiles = process.env.ProgramFiles || "C:\\Program Files";
    const programFilesX86 =
      process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    for (const subPath of detection.programFilesPaths) {
      try {
        await access(join(programFiles, subPath));
        return true;
      } catch {}
      try {
        await access(join(programFilesX86, subPath));
        return true;
      } catch {}
    }
  }

  return false;
}

async function checkLinux(
  detection: AppDetection,
  env: NodeJS.ProcessEnv,
): Promise<boolean> {
  if (detection.cliCommands) {
    for (const cmd of detection.cliCommands) {
      try {
        await execFileAsync("which", [cmd], { env, timeout: 3000 });
        return true;
      } catch {}
    }
  }

  return false;
}
