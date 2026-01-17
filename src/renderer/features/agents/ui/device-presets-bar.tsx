"use client"

import { motion } from "motion/react"
import { useState, useEffect } from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../../../components/ui/select"
import { Input } from "../../../components/ui/input"
import { DEVICE_PRESETS, AGENTS_PREVIEW_CONSTANTS } from "../constants"

interface DevicePresetsBarProps {
  selectedPreset: string
  width: number
  height: number
  onPresetChange: (preset: string) => void
  onWidthChange: (width: number) => void
  maxWidth: number
  className?: string
}

export function DevicePresetsBar({
  selectedPreset,
  width,
  height,
  onPresetChange,
  onWidthChange,
  maxWidth,
  className,
}: DevicePresetsBarProps) {
  const [widthInputValue, setWidthInputValue] = useState(String(width))

  // Sync input value when width prop changes
  useEffect(() => {
    setWidthInputValue(String(width))
  }, [width])

  const handleWidthInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWidthInputValue(e.target.value)
  }

  const handleWidthBlur = () => {
    const value = parseInt(widthInputValue)

    // Apply any valid positive number, clamp to reasonable bounds
    if (!isNaN(value) && value > 0) {
      const clampedValue = Math.max(
        AGENTS_PREVIEW_CONSTANTS.MIN_WIDTH,
        Math.min(maxWidth, value),
      )
      setWidthInputValue(String(clampedValue))
      onWidthChange(clampedValue)
    } else {
      // Invalid input - reset to current width
      setWidthInputValue(String(width))
    }
  }

  return (
    <motion.div
      key="device-presets-above"
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{
        opacity: {
          duration: 0.15,
          ease: "easeInOut",
        },
        height: {
          duration: 0.2,
          ease: "easeInOut",
        },
      }}
      className={className}
    >
      <div className="flex items-center justify-center gap-2 px-4 py-2">
        <Select value={selectedPreset} onValueChange={onPresetChange}>
          <SelectTrigger className="h-7 text-xs px-2 w-auto">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="!w-36">
            {DEVICE_PRESETS.map((preset) => (
              <SelectItem
                key={preset.name}
                value={preset.name}
                className="whitespace-nowrap"
              >
                {preset.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium">W</span>
          <Input
            type="number"
            value={widthInputValue}
            onChange={handleWidthInputChange}
            onBlur={handleWidthBlur}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.currentTarget.blur()
              }
            }}
            className="h-7 w-auto min-w-9 text-xs px-1.5 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
            style={{
              width: `${Math.max(widthInputValue.length || 1, 3) + 2}ch`,
            }}
            min={AGENTS_PREVIEW_CONSTANTS.MIN_WIDTH}
            max={maxWidth}
          />
        </div>

        <div className="flex items-center gap-1">
          <span className="text-xs text-muted-foreground font-medium">H</span>
          <Input
            type="number"
            value={height}
            disabled
            className="h-7 w-auto min-w-[3ch] text-xs px-1.5 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
            style={{
              width: `${String(height).length + 2}ch`,
            }}
            min={AGENTS_PREVIEW_CONSTANTS.MIN_HEIGHT}
            max={AGENTS_PREVIEW_CONSTANTS.MAX_HEIGHT}
          />
        </div>
      </div>
    </motion.div>
  )
}

