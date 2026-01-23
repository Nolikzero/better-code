"use client";

import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  chatProviderOverridesAtom,
  defaultProviderIdAtom,
  lastSelectedModelByProviderAtom,
  type ProviderId,
  subChatProviderOverridesAtom,
} from "../../../lib/atoms";
import { trpc } from "../../../lib/trpc";
import { useProviders } from "../hooks/use-providers";
import { useAgentSubChatStore } from "../stores/sub-chat-store";

export interface UseProviderModelSelectionOptions {
  subChatId: string;
  parentChatId: string;
}

export interface UseProviderModelSelectionReturn {
  // Current state
  effectiveProvider: ProviderId;
  providerModels: Array<{ id: string; name: string; displayName: string }>;
  currentModelId: string;

  // Handlers
  handleProviderChange: (newProvider: ProviderId) => void;
  handleModelChange: (modelId: string) => void;
  handleOpenCodeModelChange: (modelId: string) => void;
}

/**
 * Hook to manage provider and model selection state including:
 * - Computing effective provider (subchat override → chat override → global default)
 * - Fetching available models for the current provider
 * - Handling provider and model changes with optimistic updates
 * - Persisting changes to database via tRPC
 * - Initializing provider from sub-chat metadata on mount
 */
export function useProviderModelSelection(
  options: UseProviderModelSelectionOptions,
): UseProviderModelSelectionReturn {
  const { subChatId, parentChatId } = options;

  // Provider & model selection state
  // Per-subchat override takes priority, then per-chat override, then falls back to global default
  const chatProviderOverrides = useAtomValue(chatProviderOverridesAtom);
  const [subChatProviderOverrides, setSubChatProviderOverrides] = useAtom(
    subChatProviderOverridesAtom,
  );
  const [globalDefaultProvider] = useAtom(defaultProviderIdAtom);
  const [modelByProvider, setModelByProvider] = useAtom(
    lastSelectedModelByProviderAtom,
  );
  const { getModels } = useProviders();

  // Use per-subchat override first, then per-chat override, otherwise global default
  const effectiveProvider = useMemo(
    () =>
      subChatProviderOverrides[subChatId] ||
      chatProviderOverrides[parentChatId] ||
      globalDefaultProvider,
    [
      subChatProviderOverrides,
      subChatId,
      chatProviderOverrides,
      parentChatId,
      globalDefaultProvider,
    ],
  );

  // Mutation to persist provider change to database
  const updateSubChatProviderMutation =
    trpc.chats.updateSubChatProvider.useMutation();

  // Handler for provider change
  const handleProviderChange = useCallback(
    (newProvider: ProviderId) => {
      // Update local state immediately (optimistic update)
      setSubChatProviderOverrides((prev) => ({
        ...prev,
        [subChatId]: newProvider,
      }));

      // Update store
      useAgentSubChatStore
        .getState()
        .updateSubChatProvider(subChatId, newProvider);

      // Persist to database (skip for temp subchats)
      if (!subChatId.startsWith("temp-")) {
        updateSubChatProviderMutation.mutate({
          id: subChatId,
          providerId: newProvider,
        });
      }
    },
    [subChatId, setSubChatProviderOverrides, updateSubChatProviderMutation],
  );

  // Memoized handler for OpenCode model changes (prevents re-render cascade)
  const handleOpenCodeModelChange = useCallback(
    (modelId: string) => {
      setModelByProvider((prev) => ({
        ...prev,
        opencode: modelId,
      }));
    },
    [setModelByProvider],
  );

  // Memoized handler for regular model selector changes
  const handleModelChange = useCallback(
    (modelId: string) => {
      setModelByProvider((prev) => ({
        ...prev,
        [effectiveProvider]: modelId,
      }));
    },
    [setModelByProvider, effectiveProvider],
  );

  // Initialize provider from sub-chat metadata when switching sub-chats
  const lastInitializedProviderRef = useRef<string | null>(null);
  useEffect(() => {
    if (subChatId && subChatId !== lastInitializedProviderRef.current) {
      const subChat = useAgentSubChatStore
        .getState()
        .allSubChats.find((sc) => sc.id === subChatId);

      // Initialize provider from sub-chat metadata (restored from database)
      if (subChat?.providerId) {
        setSubChatProviderOverrides((prev) => ({
          ...prev,
          [subChatId]: subChat.providerId as ProviderId,
        }));
      }

      lastInitializedProviderRef.current = subChatId;
    }
  }, [subChatId, setSubChatProviderOverrides]);

  // Derive current provider models and model from effective provider
  const providerModels = getModels(effectiveProvider);
  const currentModelId =
    modelByProvider[effectiveProvider] || providerModels[0]?.id || "";

  return {
    effectiveProvider,
    providerModels,
    currentModelId,
    handleProviderChange,
    handleModelChange,
    handleOpenCodeModelChange,
  };
}
