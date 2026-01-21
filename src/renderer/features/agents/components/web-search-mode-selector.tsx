import { useAtom } from "jotai";
import { GlobeIcon } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import { CheckIcon, IconChevronDown } from "../../../components/ui/icons";
import { codexWebSearchModeAtom, type WebSearchMode } from "../../../lib/atoms";

const WEB_SEARCH_OPTIONS: {
  value: WebSearchMode;
  label: string;
  description: string;
}[] = [
  { value: "disabled", label: "Web Off", description: "No web search" },
  {
    value: "cached",
    label: "Cached",
    description: "Use cached results + live fallback",
  },
  { value: "live", label: "Live", description: "Always search live" },
];

interface WebSearchModeSelectorProps {
  disabled?: boolean;
}

/**
 * Dropdown component for selecting Codex web search mode.
 * Only shown when Codex provider is selected.
 */
export function WebSearchModeSelector({
  disabled = false,
}: WebSearchModeSelectorProps) {
  const [webSearchMode, setWebSearchMode] = useAtom(codexWebSearchModeAtom);

  const currentOption =
    WEB_SEARCH_OPTIONS.find((o) => o.value === webSearchMode) ||
    WEB_SEARCH_OPTIONS[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <GlobeIcon className="h-3.5 w-3.5" />
        <span>{currentOption.label}</span>
        <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        {WEB_SEARCH_OPTIONS.map((option) => {
          const isSelected = webSearchMode === option.value;
          return (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setWebSearchMode(option.value)}
              className="gap-2 justify-between"
            >
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-xs text-muted-foreground">
                  {option.description}
                </span>
              </div>
              {isSelected && <CheckIcon className="h-3.5 w-3.5 shrink-0" />}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
