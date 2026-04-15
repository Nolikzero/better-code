import type { ProviderId } from "@shared/types";
import { useMemo } from "react";
import { trpc } from "../../../lib/trpc";

export interface ProviderModel {
  id: string;
  name: string;
  displayName: string;
}

export interface ProviderInfo {
  id: ProviderId;
  name: string;
  description: string;
  available: boolean;
  authStatus: {
    authenticated: boolean;
    method?: "oauth" | "api-key";
    error?: string;
  };
  models: ProviderModel[];
}

function isProviderInfo(value: unknown): value is ProviderInfo {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<ProviderInfo>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    typeof candidate.available === "boolean" &&
    Array.isArray(candidate.models)
  );
}

export function normalizeProvidersList(value: unknown): ProviderInfo[] {
  if (Array.isArray(value)) {
    return value.filter(isProviderInfo);
  }

  if (value && typeof value === "object" && "json" in value) {
    const jsonValue = (value as { json?: unknown }).json;
    if (Array.isArray(jsonValue)) {
      return jsonValue.filter(isProviderInfo);
    }
  }

  return [];
}

/**
 * Hook to fetch all providers and their models via tRPC.
 * Centralizes provider/model logic - supports dynamic models (e.g., OpenCode).
 *
 * Usage:
 * ```tsx
 * const { providers, getModels, isLoading } = useProviders();
 * const models = getModels("opencode"); // Returns dynamic models from server
 * ```
 */
export function useProviders() {
  const {
    data: providers,
    isLoading,
    error,
    refetch,
  } = trpc.providers.list.useQuery(undefined, {
    staleTime: 60_000, // Cache for 1 minute
    refetchOnWindowFocus: false,
  });

  const providerList = useMemo(
    () => normalizeProvidersList(providers),
    [providers],
  );

  // Helper to get models for a specific provider
  const getModels = useMemo(() => {
    return (providerId: ProviderId): ProviderModel[] => {
      const provider = providerList.find((p) => p.id === providerId);
      return provider?.models ?? [];
    };
  }, [providerList]);

  // Helper to get provider info
  const getProvider = useMemo(() => {
    return (providerId: ProviderId): ProviderInfo | undefined => {
      return providerList.find((p) => p.id === providerId);
    };
  }, [providerList]);

  // List of available provider IDs (for dropdowns)
  const availableProviderIds = useMemo(() => {
    return providerList.map((p) => p.id);
  }, [providerList]);

  // Check if a provider is ready (available + authenticated)
  const isProviderReady = useMemo(() => {
    return (providerId: ProviderId): boolean => {
      const provider = providerList.find((p) => p.id === providerId);
      return (
        provider?.available === true &&
        provider?.authStatus?.authenticated === true
      );
    };
  }, [providerList]);

  return {
    providers: providerList,
    getModels,
    getProvider,
    availableProviderIds,
    isProviderReady,
    isLoading,
    error,
    refetch,
  };
}
