import { useVirtualizer } from "@tanstack/react-virtual";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { CheckIcon, IconChevronDown } from "../../../components/ui/icons";
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "../../../components/ui/model-selector";
import { trpc } from "../../../lib/trpc";
import { cn } from "../../../lib/utils";
import { getProviderIcon } from "../ui/provider-icons";

const ITEM_HEIGHT = 32;
const HEADER_HEIGHT = 28;
const OVERSCAN = 5;
const MAX_VISIBLE_HEIGHT = 300;

type FlatItem =
  | {
      type: "header";
      providerId: string;
      providerName: string;
      connected: boolean;
    }
  | {
      type: "model";
      providerId: string;
      modelId: string;
      displayName: string;
      connected: boolean;
    };

interface OpenCodeModelSelectorProps {
  /** Current model ID in format "providerId/modelId" */
  currentModelId: string;
  /** Callback when model is selected */
  onModelChange: (modelId: string) => void;
  /** Disable the selector */
  disabled?: boolean;
}

/**
 * Model selector for OpenCode provider that groups models by underlying provider
 * and shows connection status for each provider.
 */
export const OpenCodeModelSelector = memo(function OpenCodeModelSelector({
  currentModelId,
  onModelChange,
  disabled = false,
}: OpenCodeModelSelectorProps) {
  const [open, setOpen] = useState(false);

  // Use ref to avoid onModelChange in useEffect dependencies (prevents re-render cascade)
  const onModelChangeRef = useRef(onModelChange);
  onModelChangeRef.current = onModelChange;

  const { data: providersData, isLoading } =
    trpc.providers.getOpenCodeProviders.useQuery(undefined, {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    });

  // Auto-select first model from first connected provider if current selection is invalid
  useEffect(() => {
    if (!providersData?.providers?.length) return;

    // Find first connected provider with models
    const firstConnectedProvider = providersData.providers.find(
      (p) => p.connected && p.models.length > 0,
    );

    if (!firstConnectedProvider) return;

    // Check if current model is valid (exists and provider is connected)
    const isCurrentModelValid = (() => {
      if (!currentModelId) return false;
      const [providerId, modelId] = currentModelId.split("/", 2);
      const provider = providersData.providers.find((p) => p.id === providerId);
      if (!provider?.connected) return false;
      return provider.models.some((m) => m.id === modelId);
    })();

    // If current model is invalid, select first model from first connected provider
    if (!isCurrentModelValid) {
      const defaultModel = `${firstConnectedProvider.id}/${firstConnectedProvider.models[0].id}`;
      // Guard: only call if the model actually needs to change
      if (defaultModel !== currentModelId) {
        onModelChangeRef.current(defaultModel);
      }
    }
  }, [providersData, currentModelId]); // onModelChange removed from deps

  // Memoized display name to avoid recalculation on every render
  const currentModelDisplay = useMemo(() => {
    if (!providersData?.providers || !currentModelId) {
      return currentModelId || "Select model...";
    }

    // Model ID is in format "providerId/modelId"
    const [providerId, modelId] = currentModelId.split("/", 2);
    const provider = providersData.providers.find((p) => p.id === providerId);
    const model = provider?.models.find((m) => m.id === modelId);

    return model?.displayName || model?.name || currentModelId;
  }, [currentModelId, providersData]);

  const [searchQuery, setSearchQuery] = useState("");
  const listRef = useRef<HTMLDivElement>(null);

  // Reset search query when dialog opens
  useEffect(() => {
    if (open) {
      setSearchQuery("");
    }
  }, [open]);

  // Flatten providers and models into a single array for virtualization
  const flatItems = useMemo((): FlatItem[] => {
    if (!providersData?.providers?.length) return [];

    const items: FlatItem[] = [];
    const query = searchQuery.toLowerCase();

    for (const provider of providersData.providers) {
      // Filter models by search query
      const filteredModels = query
        ? provider.models.filter(
            (m) =>
              m.name.toLowerCase().includes(query) ||
              (m.displayName?.toLowerCase().includes(query) ?? false),
          )
        : provider.models;

      // Skip provider if no models match
      if (filteredModels.length === 0) continue;

      // Add header
      items.push({
        type: "header",
        providerId: provider.id,
        providerName: provider.name,
        connected: provider.connected,
      });

      // Add models
      for (const model of filteredModels) {
        items.push({
          type: "model",
          providerId: provider.id,
          modelId: model.id,
          displayName: model.displayName || model.name,
          connected: provider.connected,
        });
      }
    }

    return items;
  }, [providersData, searchQuery]);

  const rowVirtualizer = useVirtualizer({
    count: flatItems.length,
    getScrollElement: () => listRef.current,
    estimateSize: (index) =>
      flatItems[index]?.type === "header" ? HEADER_HEIGHT : ITEM_HEIGHT,
    overscan: OVERSCAN,
  });

  // Force virtualizer to re-measure when dialog opens or items change
  useEffect(() => {
    if (open && flatItems.length > 0) {
      rowVirtualizer.measure();
    }
  }, [open, flatItems.length, rowVirtualizer]);

  // Calculate fallback virtual items for initial render before virtualizer measures
  const fallbackVirtualItems = useMemo(() => {
    let offset = 0;
    return flatItems.map((item, index) => {
      const size = item.type === "header" ? HEADER_HEIGHT : ITEM_HEIGHT;
      const virtualItem = { index, start: offset, size };
      offset += size;
      return virtualItem;
    });
  }, [flatItems]);

  const fallbackHeight =
    fallbackVirtualItems.length > 0
      ? fallbackVirtualItems[fallbackVirtualItems.length - 1].start +
        fallbackVirtualItems[fallbackVirtualItems.length - 1].size
      : 0;

  const handleSelect = (providerId: string, modelId: string) => {
    onModelChange(`${providerId}/${modelId}`);
    setOpen(false);
  };

  return (
    <ModelSelector open={open} onOpenChange={setOpen}>
      <ModelSelectorTrigger
        disabled={disabled || isLoading}
        className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getProviderIcon("opencode", "h-3.5 w-3.5")}
        <span>{currentModelDisplay}</span>
        <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </ModelSelectorTrigger>

      <ModelSelectorContent title="Select Model" shouldFilter={false}>
        <ModelSelectorInput
          placeholder="Search models..."
          value={searchQuery}
          onValueChange={setSearchQuery}
        />
        <ModelSelectorList
          ref={listRef}
          className="overflow-y-auto"
          style={{ maxHeight: MAX_VISIBLE_HEIGHT }}
        >
          {isLoading ? (
            <ModelSelectorEmpty>Loading providers...</ModelSelectorEmpty>
          ) : !providersData?.providers?.length ? (
            <ModelSelectorEmpty>No providers available</ModelSelectorEmpty>
          ) : flatItems.length === 0 ? (
            <ModelSelectorEmpty>No models found</ModelSelectorEmpty>
          ) : (
            <div
              style={{
                height: `${rowVirtualizer.getTotalSize() || fallbackHeight}px`,
                width: "100%",
                position: "relative",
              }}
            >
              {(rowVirtualizer.getVirtualItems().length > 0
                ? rowVirtualizer.getVirtualItems()
                : fallbackVirtualItems
              ).map((virtualRow) => {
                const item = flatItems[virtualRow.index];
                if (!item) return null;

                if (item.type === "header") {
                  return (
                    <div
                      key={`header-${item.providerId}`}
                      className="absolute top-0 left-0 w-full px-2 py-1.5 text-xs font-medium text-muted-foreground flex items-center gap-2"
                      style={{
                        height: `${HEADER_HEIGHT}px`,
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      <ModelSelectorLogo
                        provider={item.providerId}
                        className="size-3"
                      />
                      <span>{item.providerName}</span>
                      <span
                        className={cn(
                          "ml-auto size-2 rounded-full",
                          item.connected
                            ? "bg-green-500"
                            : "bg-muted-foreground/30",
                        )}
                        title={item.connected ? "Connected" : "Not connected"}
                      />
                    </div>
                  );
                }

                const fullModelId = `${item.providerId}/${item.modelId}`;
                const isSelected = currentModelId === fullModelId;

                return (
                  <ModelSelectorItem
                    key={`model-${fullModelId}`}
                    value={fullModelId}
                    onSelect={() => handleSelect(item.providerId, item.modelId)}
                    disabled={!item.connected}
                    className={cn(
                      "absolute top-0 left-0 w-full justify-between pl-6",
                      !item.connected && "opacity-50 cursor-not-allowed",
                    )}
                    style={{
                      height: `${ITEM_HEIGHT}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                  >
                    <ModelSelectorName>{item.displayName}</ModelSelectorName>
                    {isSelected && (
                      <CheckIcon className="h-3.5 w-3.5 shrink-0" />
                    )}
                  </ModelSelectorItem>
                );
              })}
            </div>
          )}
        </ModelSelectorList>
      </ModelSelectorContent>
    </ModelSelector>
  );
});
