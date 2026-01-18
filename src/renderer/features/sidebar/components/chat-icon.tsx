import { FolderGit2 } from "lucide-react";
import React from "react";
import { Checkbox } from "../../../components/ui/checkbox";
import { LoadingDot } from "../../../components/ui/icons";
import { cn } from "../../../lib/utils";

export interface ChatIconProps {
  isSelected: boolean;
  isLoading: boolean;
  hasUnseenChanges?: boolean;
  hasPendingPlan?: boolean;
  isMultiSelectMode?: boolean;
  isChecked?: boolean;
  onCheckboxClick?: (e: React.MouseEvent) => void;
  gitOwner?: string | null;
  gitProvider?: string | null;
}

/**
 * Icon component for workspace/chat items in the sidebar.
 * Shows GitHub avatar if available, otherwise a folder icon.
 * Supports multi-select mode with checkbox overlay and status badges.
 */
export const ChatIcon = React.memo(function ChatIcon({
  isSelected,
  isLoading,
  hasUnseenChanges = false,
  hasPendingPlan = false,
  isMultiSelectMode = false,
  isChecked = false,
  onCheckboxClick,
  gitOwner,
  gitProvider,
}: ChatIconProps) {
  // Show GitHub avatar if available, otherwise blank project icon
  const renderMainIcon = () => {
    if (gitOwner && gitProvider === "github") {
      return (
        <img
          src={`https://github.com/${gitOwner}.png?size=64`}
          alt={gitOwner}
          className="h-4 w-4 rounded-sm flex-shrink-0"
        />
      );
    }
    return (
      <FolderGit2
        className={cn(
          "h-4 w-4 flex-shrink-0 transition-colors",
          isSelected ? "text-foreground" : "text-muted-foreground",
        )}
      />
    );
  };

  return (
    <div className="relative flex-shrink-0 w-4 h-4">
      {/* Checkbox slides in from left, icon slides out */}
      <div
        className={cn(
          "absolute inset-0 flex items-center justify-center transition-[opacity,transform] duration-150 ease-out",
          isMultiSelectMode
            ? "opacity-100 scale-100"
            : "opacity-0 scale-95 pointer-events-none",
        )}
        onClick={onCheckboxClick}
      >
        <Checkbox
          checked={isChecked}
          className="cursor-pointer h-4 w-4"
          tabIndex={isMultiSelectMode ? 0 : -1}
        />
      </div>
      {/* Main icon fades out when multi-select is active */}
      <div
        className={cn(
          "transition-[opacity,transform] duration-150 ease-out",
          isMultiSelectMode
            ? "opacity-0 scale-95 pointer-events-none"
            : "opacity-100 scale-100",
        )}
      >
        {renderMainIcon()}
      </div>
      {/* Badge in bottom-right corner: loader -> amber dot -> blue dot - hidden during multi-select */}
      {(isLoading || hasUnseenChanges || hasPendingPlan) &&
        !isMultiSelectMode && (
          <div
            className={cn(
              "absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center",
              isSelected
                ? "bg-[#E8E8E8] dark:bg-[#1B1B1B]"
                : "bg-[#F4F4F4] group-hover:bg-[#E8E8E8] dark:bg-[#101010] dark:group-hover:bg-[#1B1B1B]",
            )}
          >
            {/* Priority: loader > amber dot (pending plan) > blue dot (unseen) */}
            {isLoading ? (
              <LoadingDot
                isLoading={true}
                className="w-2.5 h-2.5 text-muted-foreground"
              />
            ) : hasPendingPlan ? (
              <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            ) : (
              <LoadingDot
                isLoading={false}
                className="w-2.5 h-2.5 text-muted-foreground"
              />
            )}
          </div>
        )}
    </div>
  );
});
