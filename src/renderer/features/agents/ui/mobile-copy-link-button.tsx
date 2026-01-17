"use client"

import { useState } from "react"
import { Button } from "../../../components/ui/button"
import {
  LinkIcon,
  CheckIcon,
} from "../../../components/ui/icons"
import { cn } from "../../../lib/utils"
import { useHaptic } from "../hooks/use-haptic"

interface MobileCopyLinkButtonProps {
  url: string
}

export function MobileCopyLinkButton({ url }: MobileCopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)
  const { trigger: triggerHaptic } = useHaptic()

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      triggerHaptic("medium")
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error("Failed to copy:", error)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleCopy}
      className="h-7 w-7 p-0 hover:bg-foreground/10 transition-[background-color,transform] duration-150 ease-out active:scale-[0.97] flex-shrink-0 rounded-md"
    >
      <div className="relative w-3.5 h-3.5">
        <LinkIcon
          className={cn(
            "absolute inset-0 w-3.5 h-3.5 transition-[opacity,transform] duration-200 ease-out",
            copied ? "opacity-0 scale-50" : "opacity-100 scale-100",
          )}
        />
        <CheckIcon
          className={cn(
            "absolute inset-0 w-3.5 h-3.5 transition-[opacity,transform] duration-200 ease-out",
            copied ? "opacity-100 scale-100" : "opacity-0 scale-50",
          )}
        />
      </div>
      <span className="sr-only">{copied ? "Copied!" : "Copy link"}</span>
    </Button>
  )
}
