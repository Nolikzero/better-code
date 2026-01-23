import { memo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { CheckIcon, IconChevronDown } from "../../../components/ui/icons";
import type { ProviderId } from "../../../lib/atoms";
import { getProviderIcon } from "../ui/provider-icons";

interface ModelOption {
  id: string;
  name: string;
  displayName: string;
}

interface ModelSelectorDropdownProps {
  providerId: ProviderId;
  models: ModelOption[];
  currentModelId: string;
  onModelChange: (modelId: string) => void;
  disabled?: boolean;
  /** Optional controlled open state */
  open?: boolean;
  /** Optional callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Dropdown component for selecting a model from a provider's available models.
 */
export const ModelSelectorDropdown = memo(function ModelSelectorDropdown({
  providerId,
  models,
  currentModelId,
  onModelChange,
  disabled = false,
  open,
  onOpenChange,
}: ModelSelectorDropdownProps) {
  const currentModel = models.find((m) => m.id === currentModelId) || models[0];

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getProviderIcon(providerId, "h-3.5 w-3.5")}
        <span>{currentModel?.displayName || currentModel?.name}</span>
        <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px]">
        {models.map((model) => {
          const isSelected = currentModelId === model.id;
          return (
            <DropdownMenuItem
              key={model.id}
              onClick={() => onModelChange(model.id)}
              className="gap-2 justify-between"
            >
              <div className="flex items-center gap-1.5">
                {getProviderIcon(
                  providerId,
                  "h-3.5 w-3.5 text-muted-foreground shrink-0",
                )}
                <span>{model.displayName || model.name}</span>
              </div>
              {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
});
