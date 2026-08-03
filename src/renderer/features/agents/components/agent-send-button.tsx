"use client";

import { ArrowUp, Plus } from "lucide-react";
import { memo } from "react";
import { Button } from "../../../components/ui/button";
import { EnterIcon, IconSpinner } from "../../../components/ui/icons";
import { Kbd } from "../../../components/ui/kbd";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip";

interface AgentSendButtonProps {
  /** Whether the system is currently streaming */
  isStreaming?: boolean;
  /** Whether the system is currently submitting/generating */
  isSubmitting?: boolean;
  /** Whether the button should be disabled */
  disabled?: boolean;
  /** Main click handler */
  onClick: () => void;
  /** Optional stop handler for streaming state */
  onStop?: () => void;
  /** Additional CSS classes */
  className?: string;
  /** Button size */
  size?: "sm" | "default" | "lg";
  /** Custom aria-label */
  ariaLabel?: string;
  /** Whether this is plan mode (orange styling) */
  isPlanMode?: boolean;
  /** Whether the button should show "Queue" mode (streaming but has content) */
  isQueueMode?: boolean;
  /** Number of messages currently in queue */
  queueCount?: number;
}

export const AgentSendButton = memo(function AgentSendButton({
  isStreaming = false,
  isSubmitting = false,
  disabled = false,
  onClick,
  onStop,
  className = "",
  size = "sm",
  ariaLabel,
  isPlanMode = false,
  isQueueMode = false,
  queueCount = 0,
}: AgentSendButtonProps) {
  // Note: Enter shortcut is now handled by input components directly

  // Determine the actual click handler based on state
  const handleClick = () => {
    if (isQueueMode) {
      // Queue mode: clicking sends/queues the message, not stop
      onClick();
    } else if (isStreaming && onStop) {
      onStop();
    } else {
      onClick();
    }
  };

  // Determine if button should be disabled
  const isDisabled = isStreaming ? false : disabled;

  // Determine icon to show
  const getIcon = () => {
    if (isQueueMode) {
      return <Plus className="size-4" />;
    }
    if (isStreaming) {
      return (
        <div className="w-2.5 h-2.5 bg-current rounded-[2px] shrink-0 mx-auto" />
      );
    }
    if (isSubmitting) {
      return <IconSpinner className="size-4" />;
    }
    return <ArrowUp className="size-4" />;
  };

  // Determine tooltip content
  const getTooltipContent = () => {
    if (isQueueMode) {
      return (
        <span className="flex items-center">
          将消息加入队列
          {queueCount > 0 && (
            <span className="ml-1 text-muted-foreground">
              ({queueCount} 条待处理）
            </span>
          )}
          <Kbd className="-me-1 ms-1">
            <EnterIcon className="size-2.5 inline" />
          </Kbd>
        </span>
      );
    }
    if (isStreaming)
      return (
        <span className="flex items-center gap-1">
          停止
          <Kbd className="ms-0.5">Esc</Kbd>
          <span className="text-muted-foreground/60">或</span>
          <Kbd className="-me-1">Ctrl C</Kbd>
        </span>
      );
    if (isSubmitting) return "正在生成…";
    return (
      <span className="flex items-center">
        发送
        <Kbd className="-me-1 ms-1">
          <EnterIcon className="size-2.5 inline" />
        </Kbd>
      </span>
    );
  };

  // Determine aria-label
  const getAriaLabel = () => {
    if (ariaLabel) return ariaLabel;
    if (isQueueMode) return "将消息加入队列";
    if (isStreaming) return "停止生成";
    if (isSubmitting) return "正在生成…";
    return "发送消息";
  };

  // Apply glow effect when button is active and ready to send
  const shouldShowGlow = !isStreaming && !isSubmitting && !disabled;

  const glowClass = shouldShowGlow
    ? "ring-2 ring-background outline outline-1 outline-ring/20"
    : undefined;

  // Mode-specific styling (agent=foreground, plan=orange)
  const modeClass = isPlanMode
    ? "!bg-plan-mode hover:!bg-plan-mode/90 !text-background !shadow-none"
    : "!bg-foreground hover:!bg-foreground/90 !text-background !shadow-none";

  return (
    <Tooltip delayDuration={1_000}>
      <TooltipTrigger asChild>
        <Button
          size={size}
          className={`h-7 w-7 rounded-full transition-[background-color,transform,opacity] duration-150 ease-out active:scale-[0.97] flex items-center justify-center ${glowClass || ""} ${modeClass} ${className}`}
          disabled={isDisabled}
          type="button"
          onClick={handleClick}
          aria-label={getAriaLabel()}
        >
          {getIcon()}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="left">{getTooltipContent()}</TooltipContent>
    </Tooltip>
  );
});
