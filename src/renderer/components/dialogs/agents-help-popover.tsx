import * as React from "react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "../ui/popover"
import { KeyboardIcon } from "../../icons"

interface AgentsHelpPopoverProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  isMobile?: boolean
  children: React.ReactNode
}

export function AgentsHelpPopover({
  open,
  onOpenChange,
  isMobile = false,
  children,
}: AgentsHelpPopoverProps) {
  const menuItems = [
    {
      icon: KeyboardIcon,
      label: "Shortcuts",
      onClick: () => {
        // Open shortcuts dialog
        console.log("Open shortcuts dialog")
      },
    },
  ]

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-1"
        sideOffset={8}
      >
        {menuItems.map((item) => (
          <button
            key={item.label}
            onClick={() => {
              item.onClick()
              onOpenChange(false)
            }}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md hover:bg-muted transition-colors text-left"
          >
            <item.icon className="h-4 w-4 text-muted-foreground" />
            <span>{item.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}
