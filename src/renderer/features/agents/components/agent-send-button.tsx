"use client"

import { Button } from "../../../components/ui/button"
import { ArrowUp } from "lucide-react"
import {
  EnterIcon,
  IconSpinner,
} from "../../../components/ui/icons"
import { Kbd } from "../../../components/ui/kbd"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "../../../components/ui/tooltip"

interface AgentSendButtonProps {
  /** Whether the system is currently streaming */
  isStreaming?: boolean
  /** Whether the system is currently submitting/generating */
  isSubmitting?: boolean
  /** Whether the button should be disabled */
  disabled?: boolean
  /** Main click handler */
  onClick: () => void
  /** Optional stop handler for streaming state */
  onStop?: () => void
  /** Additional CSS classes */
  className?: string
  /** Button size */
  size?: "sm" | "default" | "lg"
  /** Custom aria-label */
  ariaLabel?: string
  /** Whether this is plan mode (orange styling) */
  isPlanMode?: boolean
}

export function AgentSendButton({
  isStreaming = false,
  isSubmitting = false,
  disabled = false,
  onClick,
  onStop,
  className = "",
  size = "sm",
  ariaLabel,
  isPlanMode = false,
}: AgentSendButtonProps) {
  // Note: Enter shortcut is now handled by input components directly

  // Determine the actual click handler based on state
  const handleClick = () => {
    if (isStreaming && onStop) {
      onStop()
    } else {
      onClick()
    }
  }

  // Determine if button should be disabled
  const isDisabled = isStreaming ? false : disabled

  // Determine icon to show
  const getIcon = () => {
    if (isStreaming) {
      return (
        <div className="w-2.5 h-2.5 bg-current rounded-[2px] flex-shrink-0 mx-auto" />
      )
    }
    if (isSubmitting) {
      return <IconSpinner className="size-4" />
    }
    return <ArrowUp className="size-4" />
  }

  // Determine tooltip content
  const getTooltipContent = () => {
    if (isStreaming)
      return (
        <span className="flex items-center gap-1">
          Stop
          <Kbd className="ms-0.5">Esc</Kbd>
          <span className="text-muted-foreground/60">or</span>
          <Kbd className="-me-1">Ctrl C</Kbd>
        </span>
      )
    if (isSubmitting) return "Generating..."
    return (
      <span className="flex items-center">
        Send
        <Kbd className="-me-1 ms-1">
          <EnterIcon className="size-2.5 inline" />
        </Kbd>
      </span>
    )
  }

  // Determine aria-label
  const getAriaLabel = () => {
    if (ariaLabel) return ariaLabel
    if (isStreaming) return "Stop generation"
    if (isSubmitting) return "Generating..."
    return "Send message"
  }

  // Apply glow effect when button is active and ready to send
  const shouldShowGlow = !isStreaming && !isSubmitting && !disabled

  const glowClass = shouldShowGlow
    ? "shadow-[0_0_0_2px_white,0_0_0_4px_rgba(0,0,0,0.06)] dark:shadow-[0_0_0_2px_#1a1a1a,0_0_0_4px_rgba(255,255,255,0.08)]"
    : undefined

  // Mode-specific styling (agent=foreground, plan=orange)
  const modeClass = isPlanMode
    ? "!bg-plan-mode hover:!bg-plan-mode/90 !text-background !shadow-none"
    : "!bg-foreground hover:!bg-foreground/90 !text-background !shadow-none"

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
  )
}

