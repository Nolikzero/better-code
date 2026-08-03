import type {
  ApiProviderProtocol,
  ProviderId,
  ProviderModel,
} from "@shared/types";
import { useMemo } from "react";
import { trpc } from "../../../lib/trpc";

export type { ProviderModel } from "@shared/types";

export type ProviderInfo = {
  readonly id: ProviderId;
  readonly name: string;
  readonly description: string;
  readonly protocol: ApiProviderProtocol;
  readonly baseUrl: string;
  readonly contextWindow: number;
  readonly enabled: boolean;
  readonly hasApiKey: boolean;
  readonly available: boolean;
  readonly authStatus: {
    readonly authenticated: boolean;
    readonly method?: "oauth" | "api-key";
    readonly error?: string;
  };
  readonly models: ProviderModel[];
};

function isProviderModel(value: unknown): value is ProviderModel {
  if (!value || typeof value !== "object") return false;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "displayName" in value &&
    typeof value.displayName === "string"
  );
}

function isProviderInfo(value: unknown): value is ProviderInfo {
  if (!value || typeof value !== "object") return false;
  if (!("protocol" in value)) return false;
  const protocol = value.protocol;
  return (
    "id" in value &&
    typeof value.id === "string" &&
    "name" in value &&
    typeof value.name === "string" &&
    "description" in value &&
    typeof value.description === "string" &&
    (protocol === "openai-compatible" || protocol === "anthropic-compatible") &&
    "baseUrl" in value &&
    typeof value.baseUrl === "string" &&
    "contextWindow" in value &&
    typeof value.contextWindow === "number" &&
    "enabled" in value &&
    typeof value.enabled === "boolean" &&
    "hasApiKey" in value &&
    typeof value.hasApiKey === "boolean" &&
    "available" in value &&
    typeof value.available === "boolean" &&
    "models" in value &&
    Array.isArray(value.models) &&
    value.models.every(isProviderModel)
  );
}

export function normalizeProvidersList(value: unknown): ProviderInfo[] {
  if (Array.isArray(value)) return value.filter(isProviderInfo);

  if (value && typeof value === "object" && "json" in value) {
    const jsonValue = value.json;
    if (Array.isArray(jsonValue)) return jsonValue.filter(isProviderInfo);
  }

  return [];
}

export function useProviders() {
  const query = trpc.providers.list.useQuery(undefined, {
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });
  const providers = useMemo(
    () => normalizeProvidersList(query.data),
    [query.data],
  );

  const getModels = (providerId: ProviderId): ProviderModel[] =>
    providers.find((provider) => provider.id === providerId)?.models ?? [];
  const getProvider = (providerId: ProviderId): ProviderInfo | undefined =>
    providers.find((provider) => provider.id === providerId);

  return {
    providers,
    enabledProviders: providers.filter((provider) => provider.enabled),
    availableProviderIds: providers.map((provider) => provider.id),
    getModels,
    getProvider,
    isProviderReady: (providerId: ProviderId): boolean => {
      const provider = getProvider(providerId);
      return provider?.available === true && provider.models.length > 0;
    },
    isLoading: query.isLoading,
    error: query.error,
    refetch: query.refetch,
  };
}
