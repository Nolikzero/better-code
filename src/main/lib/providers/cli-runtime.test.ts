import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  buildEnvironmentFromPaths,
  findBinaryInPath,
  mergePathEntries,
  resolveCliBinary,
  runCliCommand,
} from "./cli-runtime";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createTempDirectory(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "sambettercode-cli-"),
  );
  tempDirectories.push(directory);
  return directory;
}

describe("mergePathEntries", () => {
  test("按 Machine、User、进程顺序合并并对 Windows 路径大小写不敏感去重", () => {
    expect(
      mergePathEntries(
        [String.raw`C:\Windows\System32`, String.raw`C:\Tools`],
        [String.raw`c:\tools`, String.raw`C:\Users\Tester\.grok\bin`],
        [String.raw`C:\Program Files\Git\cmd`],
        "win32",
      ),
    ).toEqual([
      String.raw`C:\Windows\System32`,
      String.raw`C:\Tools`,
      String.raw`C:\Users\Tester\.grok\bin`,
      String.raw`C:\Program Files\Git\cmd`,
    ]);
  });
});

describe("buildEnvironmentFromPaths", () => {
  test("在 Windows 同步 Path 与 PATH", () => {
    const env = buildEnvironmentFromPaths(
      {
        USERPROFILE: String.raw`C:\Users\Tester`,
        Path: String.raw`C:\Process`,
      },
      String.raw`C:\Windows`,
      String.raw`C:\Users\Tester\.grok\bin`,
      "win32",
    );

    expect(env.Path).toBe(
      String.raw`C:\Windows;C:\Users\Tester\.grok\bin;C:\Process`,
    );
    expect(env.PATH).toBe(env.Path);
  });
});

describe("findBinaryInPath", () => {
  test("可从用户 PATH 发现 Grok 原生可执行文件", () => {
    const grokDirectory = createTempDirectory();
    const grokPath = path.join(grokDirectory, "grok.exe");
    fs.writeFileSync(grokPath, "fixture");

    expect(findBinaryInPath("grok", [grokDirectory], "win32")).toBe(grokPath);
  });

  test("可发现 npm 顶层 cmd shim", () => {
    const npmDirectory = createTempDirectory();
    const shimPath = path.join(npmDirectory, "claude.cmd");
    fs.writeFileSync(shimPath, "@echo off\r\n");

    expect(findBinaryInPath("claude", [npmDirectory], "win32")).toBe(shimPath);
  });
});

describe("resolveCliBinary", () => {
  test("发现 cmd shim 后优先解析 npm 包内原生 exe", () => {
    const appData = createTempDirectory();
    const npmDirectory = path.join(appData, "npm");
    const nativePath = path.join(
      npmDirectory,
      "node_modules",
      "@anthropic-ai",
      "claude-code",
      "bin",
      "claude.exe",
    );
    fs.mkdirSync(path.dirname(nativePath), { recursive: true });
    fs.writeFileSync(path.join(npmDirectory, "claude.cmd"), "@echo off\r\n");
    fs.writeFileSync(nativePath, "fixture");

    const result = resolveCliBinary({
      id: "claude",
      commandName: "claude",
      environment: { APPDATA: appData, PATH: npmDirectory, Path: npmDirectory },
      platform: "win32",
      npmNativeRelativePaths: [
        path.join("@anthropic-ai", "claude-code", "bin", "claude.exe"),
      ],
    });

    expect(result).toEqual({ path: nativePath, source: "npm-global" });
  });

  test("负结果不缓存，安装后第二次立即可发现", () => {
    const directory = createTempDirectory();
    const spec = {
      id: "grok",
      commandName: "grok",
      environment: { PATH: directory, Path: directory },
      platform: "win32" as const,
    };

    expect(resolveCliBinary(spec)).toBeNull();
    const binaryPath = path.join(directory, "grok.exe");
    fs.writeFileSync(binaryPath, "fixture");
    expect(resolveCliBinary(spec)).toEqual({
      path: binaryPath,
      source: "environment-path",
    });
  });
});

describe("runCliCommand", () => {
  const bunBinary = {
    path: process.execPath,
    source: "known-install",
  } as const;

  test("保留成功命令的 stdout、stderr 和退出码", () => {
    const result = runCliCommand(bunBinary, [
      "-e",
      'process.stdout.write("ok"); process.stderr.write("warn")',
    ]);

    expect(result).toEqual({ stdout: "ok", stderr: "warn", exitCode: 0 });
  });

  test("非零退出码不抛异常并保留错误输出", () => {
    const result = runCliCommand(bunBinary, [
      "-e",
      'process.stderr.write("not authenticated"); process.exit(7)',
    ]);

    expect(result.stdout).toBe("");
    expect(result.stderr).toBe("not authenticated");
    expect(result.exitCode).toBe(7);
    expect(result.error).toBeUndefined();
  });
});
