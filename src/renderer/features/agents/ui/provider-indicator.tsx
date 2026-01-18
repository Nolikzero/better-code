"use client";

import { useAtomValue } from "jotai";
import { memo, useMemo } from "react";
import { Button } from "../../../components/ui/button";
import { ClaudeCodeIcon, CodexIcon } from "../../../components/ui/icons";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";
import {
  chatProviderOverridesAtom,
  defaultProviderIdAtom,
  lastSelectedModelByProviderAtom,
  PROVIDER_INFO,
  PROVIDER_MODELS,
} from "../../../lib/atoms";
import { cn } from "../../../lib/utils";

interface ProviderIndicatorProps {
  chatId: string;
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
  className,
}: ProviderIndicatorProps) {
  const defaultProvider = useAtomValue(defaultProviderIdAtom);
  const chatOverrides = useAtomValue(chatProviderOverridesAtom);
  const modelsByProvider = useAtomValue(lastSelectedModelByProviderAtom);

  // Determine effective provider (per-chat override or global default)
  const effectiveProvider = useMemo(() => {
    return chatOverrides[chatId] || defaultProvider;
  }, [chatOverrides, chatId, defaultProvider]);

  // Get provider info
  const providerInfo = PROVIDER_INFO[effectiveProvider];
  const models = PROVIDER_MODELS[effectiveProvider];
  const selectedModel = modelsByProvider[effectiveProvider];
  const modelInfo = models?.find((m) => m.id === selectedModel);

  // Get the appropriate icon
  const ProviderIcon =
    effectiveProvider === "codex" ? CodexIcon : ClaudeCodeIcon;

  // Check if this chat has an override
  const hasOverride = chatId in chatOverrides;

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
          aria-label={`AI Provider: ${providerInfo.name}`}
        >
          <ProviderIcon className="h-3.5 w-3.5" aria-hidden="true" />
          <span>{modelInfo?.displayName || selectedModel}</span>
          {hasOverride && (
            <span
              className="w-1.5 h-1.5 rounded-full bg-blue-500"
              aria-label="Custom provider"
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom" className="max-w-[250px]">
        <div className="space-y-1">
          <div className="font-medium">{providerInfo.name}</div>
          <div className="text-xs text-muted-foreground">
            Model: {modelInfo?.displayName || selectedModel}
          </div>
          {hasOverride && (
            <div className="text-xs text-blue-400">
              Using custom provider for this chat
            </div>
          )}
        </div>
      </TooltipContent>
    </Tooltip>
  );
});
