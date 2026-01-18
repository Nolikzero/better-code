import type { RefObject } from "react";
import { Input } from "../../../components/ui/input";
import { cn } from "../../../lib/utils";

export interface SidebarSearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onNavigateUp?: () => void;
  onNavigateDown?: () => void;
  onSelect?: () => void;
  onCancel?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  className?: string;
  isMobile?: boolean;
}

/**
 * Search input component with keyboard navigation support.
 * Handles arrow keys for navigation, Enter for selection, Escape to cancel.
 */
export function SidebarSearchInput({
  value,
  onChange,
  placeholder = "Search...",
  onNavigateUp,
  onNavigateDown,
  onSelect,
  onCancel,
  inputRef,
  className,
  isMobile = false,
}: SidebarSearchInputProps) {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      inputRef?.current?.blur();
      onCancel?.();
      return;
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      onNavigateDown?.();
      return;
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      onNavigateUp?.();
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      onSelect?.();
      return;
    }
  };

  return (
    <div className="relative">
      <Input
        ref={inputRef}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full rounded-lg text-sm bg-muted border border-input placeholder:text-muted-foreground/40",
          isMobile ? "h-10" : "h-7",
          className,
        )}
      />
    </div>
  );
}
