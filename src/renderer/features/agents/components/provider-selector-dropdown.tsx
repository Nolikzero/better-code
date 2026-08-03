import { useAtomValue } from "jotai";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { CheckIcon, IconChevronDown } from "../../../components/ui/icons";
import { enabledProviderIdsAtom, type ProviderId } from "../../../lib/atoms";
import { useProviders } from "../hooks/use-providers";
import { getProviderIcon } from "../ui/provider-icons";

interface ProviderSelectorDropdownProps {
  readonly providerId: ProviderId;
  readonly onProviderChange: (providerId: ProviderId) => void;
  readonly disabled?: boolean;
  readonly open?: boolean;
  readonly onOpenChange?: (open: boolean) => void;
}

export function ProviderSelectorDropdown({
  providerId,
  onProviderChange,
  disabled = false,
  open,
  onOpenChange,
}: ProviderSelectorDropdownProps) {
  const enabledProviderIds = useAtomValue(enabledProviderIdsAtom);
  const { providers, isLoading } = useProviders();
  const availableProviders = providers.filter(
    (provider) => provider.enabled && enabledProviderIds.includes(provider.id),
  );
  const currentProvider = availableProviders.find(
    (provider) => provider.id === providerId,
  );
  const triggerLabel = currentProvider?.name ?? "选择服务商";

  return (
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
      <DropdownMenuTrigger
        disabled={disabled || isLoading || availableProviders.length === 0}
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground transition-[background-color,color] duration-150 ease-out hover:bg-muted/50 hover:text-foreground outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {getProviderIcon(providerId, "h-3.5 w-3.5")}
        <span className="max-w-40 truncate">{triggerLabel}</span>
        <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[220px] max-w-[90vw]">
        {availableProviders.map((provider) => {
          const isSelected = providerId === provider.id;
          return (
            <DropdownMenuItem
              key={provider.id}
              onClick={() => onProviderChange(provider.id)}
              className="gap-2 justify-between"
            >
              <div className="flex min-w-0 items-center gap-1.5">
                {getProviderIcon(
                  provider.id,
                  "h-3.5 w-3.5 text-muted-foreground shrink-0",
                )}
                <span className="truncate">{provider.name}</span>
              </div>
              {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
