import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import {
  AgentIcon,
  CheckIcon,
  IconChevronDown,
  PlanIcon,
} from "../../../components/ui/icons";

interface ModeToggleDropdownProps {
  isPlanMode: boolean;
  onModeChange: (isPlanMode: boolean) => void;
  disabled?: boolean;
}

/**
 * Dropdown component for toggling between Agent and Plan modes.
 * Includes delayed tooltip on hover to explain each mode.
 */
export function ModeToggleDropdown({
  isPlanMode,
  onModeChange,
  disabled = false,
}: ModeToggleDropdownProps) {
  // Dropdown open state
  const [isOpen, setIsOpen] = useState(false);

  // Mode tooltip state (floating tooltip with delay)
  const [modeTooltip, setModeTooltip] = useState<{
    visible: boolean;
    position: { top: number; left: number };
    mode: "agent" | "plan";
  } | null>(null);
  const tooltipTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasShownTooltipRef = useRef(false);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      // Clear tooltip state when dropdown closes
      if (tooltipTimeoutRef.current) {
        clearTimeout(tooltipTimeoutRef.current);
        tooltipTimeoutRef.current = null;
      }
      setModeTooltip(null);
      hasShownTooltipRef.current = false;
    }
  };

  const handleSelectMode = (planMode: boolean) => {
    // Clear tooltip before closing dropdown (onMouseLeave won't fire)
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setModeTooltip(null);
    onModeChange(planMode);
    setIsOpen(false);
  };

  const handleMouseEnter = (
    e: React.MouseEvent<HTMLDivElement>,
    mode: "agent" | "plan",
  ) => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const showTooltip = () => {
      setModeTooltip({
        visible: true,
        position: {
          top: rect.top,
          left: rect.right + 8,
        },
        mode,
      });
      hasShownTooltipRef.current = true;
      tooltipTimeoutRef.current = null;
    };
    // Show immediately if tooltip was already shown once, otherwise delay
    if (hasShownTooltipRef.current) {
      showTooltip();
    } else {
      tooltipTimeoutRef.current = setTimeout(showTooltip, 1000);
    }
  };

  const handleMouseLeave = () => {
    if (tooltipTimeoutRef.current) {
      clearTimeout(tooltipTimeoutRef.current);
      tooltipTimeoutRef.current = null;
    }
    setModeTooltip(null);
  };

  return (
    <DropdownMenu open={isOpen} onOpenChange={handleOpenChange}>
      <DropdownMenuTrigger
        disabled={disabled}
        className="flex items-center gap-1.5 px-2 py-1 text-sm text-muted-foreground hover:text-foreground transition-[background-color,color] duration-150 ease-out rounded-md hover:bg-muted/50 outline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring/70 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isPlanMode ? (
          <PlanIcon className="h-3.5 w-3.5" />
        ) : (
          <AgentIcon className="h-3.5 w-3.5" />
        )}
        <span>{isPlanMode ? "Plan" : "Agent"}</span>
        <IconChevronDown className="h-3 w-3 shrink-0 opacity-50" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="!min-w-[116px] !w-[116px]"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {/* Agent mode option */}
        <DropdownMenuItem
          onClick={() => handleSelectMode(false)}
          className="justify-between gap-2"
          onMouseEnter={(e) => handleMouseEnter(e, "agent")}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-2">
            <AgentIcon className="w-4 h-4 text-muted-foreground" />
            <span>Agent</span>
          </div>
          {!isPlanMode && (
            <CheckIcon className="h-3.5 w-3.5 ml-auto shrink-0" />
          )}
        </DropdownMenuItem>

        {/* Plan mode option */}
        <DropdownMenuItem
          onClick={() => handleSelectMode(true)}
          className="justify-between gap-2"
          onMouseEnter={(e) => handleMouseEnter(e, "plan")}
          onMouseLeave={handleMouseLeave}
        >
          <div className="flex items-center gap-2">
            <PlanIcon className="w-4 h-4 text-muted-foreground" />
            <span>Plan</span>
          </div>
          {isPlanMode && <CheckIcon className="h-3.5 w-3.5 ml-auto shrink-0" />}
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Floating tooltip rendered via portal */}
      {modeTooltip?.visible &&
        createPortal(
          <div
            className="fixed z-[100000]"
            style={{
              top: modeTooltip.position.top + 14,
              left: modeTooltip.position.left,
              transform: "translateY(-50%)",
            }}
          >
            <div
              data-tooltip="true"
              className="relative rounded-sm bg-popover px-2.5 py-1.5 text-xs text-popover-foreground dark max-w-[150px]"
            >
              <span>
                {modeTooltip.mode === "agent"
                  ? "Apply changes directly without a plan"
                  : "Create a plan before making changes"}
              </span>
            </div>
          </div>,
          document.body,
        )}
    </DropdownMenu>
  );
}
