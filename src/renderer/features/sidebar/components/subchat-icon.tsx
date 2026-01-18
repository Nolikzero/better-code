import React from "react";
import { Checkbox } from "../../../components/ui/checkbox";
import {
  AgentIcon,
  LoadingDot,
  PlanIcon,
  QuestionIcon,
} from "../../../components/ui/icons";
import { cn } from "../../../lib/utils";

interface SubChatIconProps {
  mode: "agent" | "plan";
  isActive: boolean;
  isLoading: boolean;
  hasUnseenChanges?: boolean;
  hasPendingPlan?: boolean;
  hasPendingQuestion?: boolean;
  isMultiSelectMode?: boolean;
  isChecked?: boolean;
  onCheckboxClick?: (e: React.MouseEvent) => void;
}

/**
 * Icon component for sub-chat items in the sidebar.
 * Shows mode-based icons (Agent, Plan, Question).
 * Supports multi-select mode with checkbox overlay and status badges.
 */
export const SubChatIcon = React.memo(function SubChatIcon({
  mode,
  isActive,
  isLoading,
  hasUnseenChanges = false,
  hasPendingPlan = false,
  hasPendingQuestion = false,
  isMultiSelectMode = false,
  isChecked = false,
  onCheckboxClick,
}: SubChatIconProps) {
  return (
    <div className="pt-0.5 shrink-0 w-4 h-4 flex items-center justify-center relative">
      {/* Checkbox - shown in multi-select mode */}
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
      {/* Mode icon or Question icon - hidden in multi-select mode */}
      <div
        className={cn(
          "transition-[opacity,transform] duration-150 ease-out",
          isMultiSelectMode
            ? "opacity-0 scale-95 pointer-events-none"
            : "opacity-100 scale-100",
        )}
      >
        {hasPendingQuestion ? (
          <QuestionIcon className="w-4 h-4 text-blue-500" />
        ) : mode === "plan" ? (
          <PlanIcon className="w-4 h-4 text-muted-foreground" />
        ) : (
          <AgentIcon className="w-4 h-4 text-muted-foreground" />
        )}
      </div>
      {/* Badge in bottom-right corner - hidden in multi-select mode and when pending question */}
      {(isLoading || hasUnseenChanges || hasPendingPlan) &&
        !isMultiSelectMode &&
        !hasPendingQuestion && (
          <div
            className={cn(
              "absolute -bottom-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center",
              isActive
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
