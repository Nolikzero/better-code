"use client";

import { useAtom, useAtomValue } from "jotai";
import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  chatProviderOverridesAtom,
  defaultProviderIdAtom,
  lastSelectedModelByProviderAtom,
  type ProviderId,
  subChatModelOverridesAtom,
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
  const [subChatModelOverrides, setSubChatModelOverrides] = useAtom(
    subChatModelOverridesAtom,
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

  // Mutations to persist provider/model changes to database
  const updateSubChatProviderMutation =
    trpc.chats.updateSubChatProvider.useMutation();
  const updateSubChatModelMutation =
    trpc.chats.updateSubChatModel.useMutation();

  // Handler for provider change
  const handleProviderChange = useCallback(
    (newProvider: ProviderId) => {
      // Update local state immediately (optimistic update)
      setSubChatProviderOverrides((prev) => ({
        ...prev,
        [subChatId]: newProvider,
      }));

      // Clear per-subchat model override since provider changed
      // The new provider's default model will be used via fallback
      setSubChatModelOverrides((prev) => {
        const { [subChatId]: _, ...rest } = prev;
        return rest;
      });

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
    [
      subChatId,
      setSubChatProviderOverrides,
      setSubChatModelOverrides,
      updateSubChatProviderMutation,
    ],
  );

  // Memoized handler for OpenCode model changes (prevents re-render cascade)
  const handleOpenCodeModelChange = useCallback(
    (modelId: string) => {
      setSubChatModelOverrides((prev) => ({
        ...prev,
        [subChatId]: modelId,
      }));

      setModelByProvider((prev) => ({
        ...prev,
        opencode: modelId,
      }));

      // Update store
      useAgentSubChatStore.getState().updateSubChatModel(subChatId, modelId);

      // Persist to database (skip for temp subchats)
      if (!subChatId.startsWith("temp-")) {
        updateSubChatModelMutation.mutate({
          id: subChatId,
          modelId,
        });
      }
    },
    [
      subChatId,
      setSubChatModelOverrides,
      setModelByProvider,
      updateSubChatModelMutation,
    ],
  );

  // Memoized handler for regular model selector changes
  const handleModelChange = useCallback(
    (modelId: string) => {
      // Update per-subchat model override (optimistic)
      setSubChatModelOverrides((prev) => ({
        ...prev,
        [subChatId]: modelId,
      }));

      // Also update global "last selected" for this provider (for new sub-chat defaults)
      setModelByProvider((prev) => ({
        ...prev,
        [effectiveProvider]: modelId,
      }));

      // Update store
      useAgentSubChatStore.getState().updateSubChatModel(subChatId, modelId);

      // Persist to database (skip for temp subchats)
      if (!subChatId.startsWith("temp-")) {
        updateSubChatModelMutation.mutate({
          id: subChatId,
          modelId,
        });
      }
    },
    [
      subChatId,
      setSubChatModelOverrides,
      setModelByProvider,
      effectiveProvider,
      updateSubChatModelMutation,
    ],
  );

  // Initialize provider and model from sub-chat metadata when switching sub-chats
  const lastInitializedRef = useRef<string | null>(null);
  useEffect(() => {
    if (subChatId && subChatId !== lastInitializedRef.current) {
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

      // Initialize model from sub-chat metadata (restored from database)
      if (subChat?.modelId) {
        setSubChatModelOverrides((prev) => ({
          ...prev,
          [subChatId]: subChat.modelId!,
        }));
      }

      lastInitializedRef.current = subChatId;
    }
  }, [subChatId, setSubChatProviderOverrides, setSubChatModelOverrides]);

  // Derive current provider models and model from effective provider
  const providerModels = getModels(effectiveProvider);
  // Priority: subchat model override -> global lastSelectedModelByProvider -> first model
  const currentModelId =
    subChatModelOverrides[subChatId] ||
    modelByProvider[effectiveProvider] ||
    providerModels[0]?.id ||
    "";

  return {
    effectiveProvider,
    providerModels,
    currentModelId,
    handleProviderChange,
    handleModelChange,
    handleOpenCodeModelChange,
  };
}
