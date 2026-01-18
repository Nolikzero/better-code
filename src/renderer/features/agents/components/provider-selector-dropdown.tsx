import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { CheckIcon, IconChevronDown } from "../../../components/ui/icons";
import type { ProviderId } from "../../../lib/atoms";
import { PROVIDERS, getProviderIcon } from "../ui/provider-icons";

interface ProviderSelectorDropdownProps {
  providerId: ProviderId;
  onProviderChange: (providerId: ProviderId) => void;
  disabled?: boolean;
  /** Optional controlled open state */
  open?: boolean;
  /** Optional callback when open state changes */
  onOpenChange?: (open: boolean) => void;
}

/**
 * Dropdown component for selecting an AI provider (Claude, Codex, etc.)
 */
export function ProviderSelectorDropdown({
  providerId,
  onProviderChange,
  disabled = false,
  open,
  onOpenChange,
}: ProviderSelectorDropdownProps) {
  const currentProvider =
    PROVIDERS.find((p) => p.id === providerId) || PROVIDERS[0];

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {getProviderIcon(providerId, "h-3.5 w-3.5")}
        <span>{currentProvider.name}</span>
        <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[180px]">
        {PROVIDERS.map((provider) => {
          const isSelected = providerId === provider.id;
          return (
            <DropdownMenuItem
              key={provider.id}
              onClick={() => onProviderChange(provider.id)}
              className="gap-2 justify-between"
            >
              <div className="flex items-center gap-1.5">
                {getProviderIcon(
                  provider.id,
                  "h-3.5 w-3.5 text-muted-foreground shrink-0",
                )}
                <span>{provider.name}</span>
              </div>
              {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
