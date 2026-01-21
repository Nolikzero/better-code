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

  // Helper to get models for a specific provider
  const getModels = useMemo(() => {
    return (providerId: ProviderId): ProviderModel[] => {
      if (!providers) return [];
      const provider = providers.find((p) => p.id === providerId);
      return provider?.models ?? [];
    };
  }, [providers]);

  // Helper to get provider info
  const getProvider = useMemo(() => {
    return (providerId: ProviderId): ProviderInfo | undefined => {
      return providers?.find((p) => p.id === providerId);
    };
  }, [providers]);

  // List of available provider IDs (for dropdowns)
  const availableProviderIds = useMemo(() => {
    if (!providers) return [] as ProviderId[];
    return providers.map((p) => p.id);
  }, [providers]);

  // Check if a provider is ready (available + authenticated)
  const isProviderReady = useMemo(() => {
    return (providerId: ProviderId): boolean => {
      const provider = providers?.find((p) => p.id === providerId);
      return (
        provider?.available === true &&
        provider?.authStatus?.authenticated === true
      );
    };
  }, [providers]);

  return {
    providers: providers ?? [],
    getModels,
    getProvider,
    availableProviderIds,
    isProviderReady,
    isLoading,
    error,
    refetch,
  };
}
