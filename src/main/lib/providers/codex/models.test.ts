import { afterEach, describe, expect, test } from "bun:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { loadCodexModels } from "./models";

const tempDirectories: string[] = [];

afterEach(() => {
  for (const directory of tempDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function createTempDirectory(): string {
  const directory = fs.mkdtempSync(
    path.join(os.tmpdir(), "sambettercode-codex-"),
  );
  tempDirectories.push(directory);
  return directory;
}

describe("loadCodexModels", () => {
  test("uses the configured default and local CLI catalog instead of stale built-in models", () => {
    const codexHome = createTempDirectory();
    fs.writeFileSync(
      path.join(codexHome, "config.toml"),
      ['model = "gpt-5.6-sol"', 'model_catalog_json = "models.json"'].join(
        "\n",
      ),
    );
    fs.writeFileSync(
      path.join(codexHome, "models.json"),
      JSON.stringify({
        models: [
          {
            slug: "gpt-5.6-terra",
            display_name: "GPT-5.6 Terra",
            visibility: "list",
            priority: 20,
          },
          {
            slug: "gpt-5.6-sol",
            display_name: "GPT-5.6 Sol",
            visibility: "list",
            priority: 10,
          },
          {
            slug: "hidden-model",
            display_name: "Hidden model",
            visibility: "hidden",
            priority: 1,
          },
        ],
      }),
    );

    expect(loadCodexModels(codexHome)).toEqual([
      { id: "gpt-5.6-sol", name: "gpt-5.6-sol", displayName: "GPT-5.6 Sol" },
      {
        id: "gpt-5.6-terra",
        name: "gpt-5.6-terra",
        displayName: "GPT-5.6 Terra",
      },
    ]);
  });

  test("keeps a configured model usable when its catalog is unavailable", () => {
    const codexHome = createTempDirectory();
    fs.writeFileSync(
      path.join(codexHome, "config.toml"),
      'model = "gpt-5.6-sol"',
    );

    expect(loadCodexModels(codexHome)).toEqual([
      { id: "gpt-5.6-sol", name: "gpt-5.6-sol", displayName: "gpt-5.6-sol" },
    ]);
  });
});
