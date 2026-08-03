"use client";

import { useAtomValue } from "jotai";
import { memo, useMemo } from "react";
import { Button } from "../../../components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import {
  chatProviderOverridesAtom,
  defaultProviderIdAtom,
  lastSelectedModelByProviderAtom,
  subChatProviderOverridesAtom,
} from "../../../lib/atoms";
import { cn } from "../../../lib/utils";
import { useProviders } from "../hooks/use-providers";
import { resolveProviderDisplayName } from "../lib/provider-display";
import { getProviderIcon } from "./provider-icons";

interface ProviderIndicatorProps {
  chatId: string;
  subChatId?: string;
  className?: string;
}

/**
 * Provider Indicator
 *
 * Shows the current AI provider for a chat.
 * Displays the provider icon and name with a tooltip showing more details.
 */
export const ProviderIndicator = memo(function ProviderIndicator({
  chatId,
  subChatId,
  className,
}: ProviderIndicatorProps) {
  const defaultProvider = useAtomValue(defaultProviderIdAtom);
  const chatOverrides = useAtomValue(chatProviderOverridesAtom);
  const subChatOverrides = useAtomValue(subChatProviderOverridesAtom);
  const modelsByProvider = useAtomValue(lastSelectedModelByProviderAtom);
  const { getModels, providers } = useProviders();

  // Determine effective provider (per-subchat override -> per-chat override -> global default)
  const effectiveProvider = useMemo(() => {
    if (subChatId && subChatOverrides[subChatId]) {
      return subChatOverrides[subChatId];
    }
    return chatOverrides[chatId] || defaultProvider;
  }, [subChatOverrides, subChatId, chatOverrides, chatId, defaultProvider]);

  const providerName = resolveProviderDisplayName(effectiveProvider, providers);
  const models = getModels(effectiveProvider);
  const selectedModel = modelsByProvider[effectiveProvider] ?? "";
  const activeModelId = models.some((model) => model.id === selectedModel)
    ? selectedModel
    : (models[0]?.id ?? selectedModel);
  const modelInfo = models.find((model) => model.id === activeModelId);

  // Get the appropriate icon
  const providerIcon = getProviderIcon(effectiveProvider, "h-3.5 w-3.5");

  // Check if this subchat or chat has an override
  const hasOverride =
    (subChatId && subChatId in subChatOverrides) || chatId in chatOverrides;

  return (
    <Tooltip delayDuration={500}>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-6 px-2 gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors rounded-md",
            className,
          )}
          aria-label={`AI 提供商：${providerName}`}
        >
          {providerIcon}
          <span>{modelInfo?.displayName || activeModelId}</span>
          {hasOverride && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-500"
              aria-label="自定义提供商"
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[250px]">
        <div className="space-y-1">
          <div className="font-medium">{providerName}</div>
          <div className="text-xs text-muted-foreground">
            模型： {modelInfo?.displayName || activeModelId}
          </div>
          {hasOverride && (
            <div className="text-xs text-blue-400">
              此对话正在使用自定义提供商
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
