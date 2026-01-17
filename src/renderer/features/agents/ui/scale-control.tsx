"use client"

import { cn } from "../../../lib/utils"
import { useRef, useState, useEffect } from "react"
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "../../../components/ui/popover"
import { AGENTS_PREVIEW_CONSTANTS } from "../constants"

interface ScaleControlProps {
  value: number
  onChange: (scale: number) => void
  presets?: readonly number[]
  className?: string
}

export function ScaleControl({
  value,
  onChange,
  presets = AGENTS_PREVIEW_CONSTANTS.SCALE_PRESETS,
  className,
}: ScaleControlProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState(String(value))
  const inputRef = useRef<HTMLInputElement>(null)

  // Sync input value when value prop changes
  useEffect(() => {
    setInputValue(String(value))
  }, [value])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, "")
    setInputValue(raw)
    const num = parseInt(raw)
    if (
      !isNaN(num) &&
      num >= AGENTS_PREVIEW_CONSTANTS.MIN_SCALE &&
      num <= AGENTS_PREVIEW_CONSTANTS.MAX_SCALE
    ) {
      onChange(num)
    }
  }

  const handleCommit = () => {
    const num = parseInt(inputValue)
    if (
      !isNaN(num) &&
      num >= AGENTS_PREVIEW_CONSTANTS.MIN_SCALE &&
      num <= AGENTS_PREVIEW_CONSTANTS.MAX_SCALE
    ) {
      onChange(num)
      setInputValue(String(num))
    } else {
      setInputValue(String(value))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleCommit()
      setIsOpen(false)
      inputRef.current?.blur()
    }
    if (e.key === "Escape") {
      setInputValue(String(value))
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          handleCommit()
          setIsOpen(false)
        }
      }}
    >
      <PopoverAnchor asChild>
        <div
          className={cn(
            "flex items-center h-7 px-1.5 ml-1 rounded-md cursor-text transition-colors",
            "hover:bg-muted",
            isOpen && "bg-muted",
            className,
          )}
          onClick={(e) => {
            // If click is not on input, focus input
            if (e.target !== inputRef.current) {
              inputRef.current?.focus()
            }
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onFocus={(e) => {
              e.target.select()
              if (!isOpen) {
                setIsOpen(true)
              }
            }}
            onKeyDown={handleKeyDown}
            className="w-[3ch] text-xs text-muted-foreground bg-transparent border-none outline-none text-right tabular-nums"
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] min-w-[60px] p-0"
        align="start"
        side="bottom"
        sideOffset={4}
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {presets.map((preset) => (
          <button
            key={preset}
            onClick={() => {
              onChange(preset)
              setInputValue(String(preset))
              setIsOpen(false)
            }}
            className={cn(
              "flex items-center justify-center w-[calc(100%-8px)] mx-1 first:mt-1 last:mb-1 min-h-[32px] text-sm rounded-md transition-colors",
              "dark:hover:bg-neutral-800 hover:bg-accent",
              value === preset && "dark:bg-neutral-800 bg-accent font-medium",
            )}
          >
            {preset}%
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

