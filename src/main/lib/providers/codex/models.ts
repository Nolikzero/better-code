import fs from "node:fs";
import path from "node:path";
import TOML from "@iarna/toml";
import type { ProviderModel } from "@shared/types";
import { z } from "zod";

const modelIdSchema = z.string().trim().min(1);

const codexConfigSchema = z
  .object({
    model: modelIdSchema.optional(),
    model_catalog_json: modelIdSchema.optional(),
  })
  .passthrough();

const modelCatalogEntrySchema = z.object({
  slug: modelIdSchema,
  display_name: modelIdSchema.optional(),
  description: modelIdSchema.optional(),
  visibility: z.string().optional(),
  priority: z.number().optional(),
});

const modelCatalogSchema = z.object({
  models: z.array(modelCatalogEntrySchema),
});

const FALLBACK_MODELS: ProviderModel[] = [
  {
    id: "gpt-5.3-codex",
    name: "gpt-5.3-codex",
    displayName: "GPT-5.3 Codex",
  },
  {
    id: "gpt-5.2-codex",
    name: "gpt-5.2-codex",
    displayName: "GPT-5.2 Codex",
  },
  {
    id: "gpt-5.1-codex-max",
    name: "gpt-5.1-codex-max",
    displayName: "GPT-5.1 Codex Max",
  },
  {
    id: "gpt-5.1-codex-mini",
    name: "gpt-5.1-codex-mini",
    displayName: "GPT-5.1 Codex Mini",
  },
  { id: "gpt-5.2", name: "gpt-5.2", displayName: "GPT-5.2" },
];

function parseTomlFile(
  filePath: string,
): z.infer<typeof codexConfigSchema> | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return (
      codexConfigSchema.safeParse(TOML.parse(fs.readFileSync(filePath, "utf8")))
        .data ?? null
    );
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[codex] 无法读取模型配置 ${filePath}: ${error.message}`);
      return null;
    }
    throw error;
  }
}

function parseCatalogFile(
  filePath: string,
): z.infer<typeof modelCatalogSchema> | null {
  if (!fs.existsSync(filePath)) return null;

  try {
    return (
      modelCatalogSchema.safeParse(
        JSON.parse(fs.readFileSync(filePath, "utf8")),
      ).data ?? null
    );
  } catch (error) {
    if (error instanceof Error) {
      console.warn(`[codex] 无法读取模型目录 ${filePath}: ${error.message}`);
      return null;
    }
    throw error;
  }
}

function toProviderModel(
  model: z.infer<typeof modelCatalogEntrySchema>,
): ProviderModel {
  return {
    id: model.slug,
    name: model.slug,
    displayName: model.display_name ?? model.description ?? model.slug,
  };
}

function modelFromId(id: string): ProviderModel {
  return { id, name: id, displayName: id };
}

function resolveCatalogPath(codexHome: string, catalogFile: string): string {
  return path.isAbsolute(catalogFile)
    ? catalogFile
    : path.join(codexHome, catalogFile);
}

export function loadCodexModels(codexHome: string): ProviderModel[] {
  const config = parseTomlFile(path.join(codexHome, "config.toml"));
  if (!config) return [...FALLBACK_MODELS];

  const models: ProviderModel[] = [];
  const indexesById = new Map<string, number>();
  const addModel = (model: ProviderModel): void => {
    const existingIndex = indexesById.get(model.id);
    if (existingIndex === undefined) {
      indexesById.set(model.id, models.length);
      models.push(model);
      return;
    }
    models[existingIndex] = model;
  };

  if (config.model) addModel(modelFromId(config.model));

  if (config.model_catalog_json) {
    const catalog = parseCatalogFile(
      resolveCatalogPath(codexHome, config.model_catalog_json),
    );
    if (catalog) {
      const visibleModels = catalog.models
        .filter((model) => model.visibility !== "hidden")
        .sort(
          (left, right) =>
            (left.priority ?? Number.MAX_SAFE_INTEGER) -
            (right.priority ?? Number.MAX_SAFE_INTEGER),
        );
      for (const model of visibleModels) addModel(toProviderModel(model));
    }
  }

  return models.length > 0 ? models : [...FALLBACK_MODELS];
}
