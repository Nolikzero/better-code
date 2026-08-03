import {
  API_PROVIDER_PROTOCOLS,
  type ApiProviderProtocol,
  type ApiProviderSettings,
  type ProviderId,
  type ProviderModel,
} from "@shared/types";
import { eq, inArray } from "drizzle-orm";
import { safeStorage } from "electron";
import { z } from "zod";
import { getDatabase } from "../../db";
import { apiProviders } from "../../db/schema";

const storedModelsSchema = z.array(z.string().trim().min(1).max(200)).max(200);
const protocolSchema = z.enum(API_PROVIDER_PROTOCOLS);

export type ApiProviderRecord = ApiProviderSettings & {
  readonly apiKey: string;
};

export type SaveApiProviderInput = {
  readonly name: string;
  readonly protocol: ApiProviderProtocol;
  readonly baseUrl: string;
  readonly apiKey?: string;
  readonly models: readonly string[];
  readonly contextWindow: number;
  readonly enabled: boolean;
};

export class ApiKeyStorageError extends Error {
  readonly name = "ApiKeyStorageError";
}

function encryptApiKey(apiKey: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new ApiKeyStorageError("当前系统无法安全保存 API Key");
  }
  return safeStorage.encryptString(apiKey).toString("base64");
}

function decryptApiKey(value: string): string {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new ApiKeyStorageError("当前系统无法读取已保存的 API Key");
  }

  try {
    return safeStorage.decryptString(Buffer.from(value, "base64"));
  } catch (error) {
    throw new ApiKeyStorageError("已保存的 API Key 无法解密", { cause: error });
  }
}

function parseModels(value: string): ProviderModel[] {
  try {
    const parsedJson: unknown = JSON.parse(value);
    const parsed = storedModelsSchema.safeParse(parsedJson);
    if (!parsed.success) return [];
    return parsed.data.map((model) => ({
      id: model,
      name: model,
      displayName: model,
    }));
  } catch (error) {
    if (error instanceof SyntaxError) return [];
    throw error;
  }
}

function parseProtocol(value: string): ApiProviderProtocol {
  const parsed = protocolSchema.safeParse(value);
  return parsed.success ? parsed.data : "openai-compatible";
}

function toSettings(
  row: typeof apiProviders.$inferSelect,
): ApiProviderSettings {
  return {
    id: row.id,
    name: row.name,
    protocol: parseProtocol(row.protocol),
    baseUrl: row.baseUrl,
    models: parseModels(row.models),
    contextWindow: row.contextWindow,
    enabled: row.enabled,
    hasApiKey: row.encryptedApiKey.length > 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listApiProviderSettings(): ApiProviderSettings[] {
  return getDatabase().select().from(apiProviders).all().map(toSettings);
}

export function getApiProviderSettings(
  providerId: ProviderId,
): ApiProviderSettings | null {
  const row = getDatabase()
    .select()
    .from(apiProviders)
    .where(eq(apiProviders.id, providerId))
    .get();
  return row ? toSettings(row) : null;
}

export function getApiProviderRecord(
  providerId: ProviderId,
): ApiProviderRecord | null {
  const row = getDatabase()
    .select()
    .from(apiProviders)
    .where(eq(apiProviders.id, providerId))
    .get();
  if (!row) return null;
  return {
    ...toSettings(row),
    apiKey: decryptApiKey(row.encryptedApiKey),
  };
}

export function createApiProvider(
  input: SaveApiProviderInput,
): ApiProviderSettings {
  const apiKey = input.apiKey?.trim() ?? "";
  if (apiKey.length === 0) {
    throw new ApiKeyStorageError("API Key 不能为空");
  }

  const id = `api:${crypto.randomUUID()}`;
  getDatabase()
    .insert(apiProviders)
    .values({
      id,
      name: input.name.trim(),
      protocol: input.protocol,
      baseUrl: input.baseUrl.trim(),
      encryptedApiKey: encryptApiKey(apiKey),
      models: JSON.stringify(input.models),
      contextWindow: input.contextWindow,
      enabled: input.enabled,
      createdAt: new Date(),
      updatedAt: new Date(),
    })
    .run();

  const created = getApiProviderSettings(id);
  if (!created) {
    throw new ApiKeyStorageError("服务商保存后无法读取");
  }
  return created;
}

export function updateApiProvider(
  providerId: ProviderId,
  input: SaveApiProviderInput,
): ApiProviderSettings | null {
  const existing = getApiProviderRecord(providerId);
  if (!existing) return null;
  const nextApiKey = input.apiKey?.trim();

  getDatabase()
    .update(apiProviders)
    .set({
      name: input.name.trim(),
      protocol: input.protocol,
      baseUrl: input.baseUrl.trim(),
      encryptedApiKey:
        nextApiKey && nextApiKey.length > 0
          ? encryptApiKey(nextApiKey)
          : encryptApiKey(existing.apiKey),
      models: JSON.stringify(input.models),
      contextWindow: input.contextWindow,
      enabled: input.enabled,
      updatedAt: new Date(),
    })
    .where(eq(apiProviders.id, providerId))
    .run();

  return getApiProviderSettings(providerId);
}

export function deleteApiProvider(providerId: ProviderId): boolean {
  const result = getDatabase()
    .delete(apiProviders)
    .where(eq(apiProviders.id, providerId))
    .run();
  return result.changes > 0;
}

export function setApiProvidersEnabled(
  providerIds: readonly ProviderId[],
): void {
  const database = getDatabase();
  database.update(apiProviders).set({ enabled: false }).run();
  if (providerIds.length === 0) return;
  database
    .update(apiProviders)
    .set({ enabled: true })
    .where(inArray(apiProviders.id, [...providerIds]))
    .run();
}
