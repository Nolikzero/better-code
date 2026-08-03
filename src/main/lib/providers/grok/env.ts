import os from "node:os";
import path from "node:path";
import { app } from "electron";
import {
  buildCliEnvironment,
  type CliBinaryResult,
  resolveCliBinary,
} from "../cli-runtime";

export type GrokBinaryResult = CliBinaryResult;

function getBundledGrokBinaryPath(): string {
  const resourcesPath = app.isPackaged
    ? path.join(process.resourcesPath, "bin")
    : path.join(
        app.getAppPath(),
        "resources",
        "bin",
        `${process.platform}-${process.arch}`,
      );
  return path.join(
    resourcesPath,
    process.platform === "win32" ? "grok.exe" : "grok",
  );
}

function getKnownGrokPaths(): string[] {
  const home = os.homedir();
  const binaryName = process.platform === "win32" ? "grok.exe" : "grok";
  const candidates = [
    path.join(home, ".grok", "bin", binaryName),
    path.join(home, ".local", "bin", binaryName),
  ];
  if (process.platform === "darwin") {
    candidates.push("/opt/homebrew/bin/grok", "/usr/local/bin/grok");
  } else if (process.platform === "linux") {
    candidates.push("/usr/local/bin/grok");
  }
  return candidates;
}

export function getGrokBinaryPath(): GrokBinaryResult | null {
  const environment = buildCliEnvironment();
  const result = resolveCliBinary({
    id: "grok",
    commandName: "grok",
    environment,
    knownCandidates: getKnownGrokPaths(),
    bundledCandidates: [getBundledGrokBinaryPath()],
  });
  if (result) {
    console.log(
      `[grok-binary] 使用真实 CLI：${result.path} (${result.source})`,
    );
  } else {
    console.error("[grok-binary] 未找到 Grok Build CLI");
  }
  return result;
}

export function buildGrokEnv(
  customEnv?: Readonly<Record<string, string>>,
): Record<string, string> {
  const environment = buildCliEnvironment();
  if (customEnv) {
    for (const [key, value] of Object.entries(customEnv)) {
      if (value.length === 0) delete environment[key];
      else environment[key] = value;
    }
  }
  return environment;
}

export function logGrokEnv(
  environment: Readonly<Record<string, string>>,
  prefix = "",
): void {
  console.log(`${prefix}[grok-env] HOME: ${environment.HOME}`);
  console.log(`${prefix}[grok-env] USER: ${environment.USER}`);
  console.log(`${prefix}[grok-env] PATH: ${environment.PATH}`);
}
