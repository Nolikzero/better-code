"use client"

import * as React from "react"
import { cn } from "../../lib/utils"

interface ButtonGroupProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
}

const ButtonGroup = React.forwardRef<HTMLDivElement, ButtonGroupProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex rounded-md shadow-sm",
          "[&>button]:rounded-none",
          "[&>button:first-child]:rounded-l-md",
          "[&>button:last-child]:rounded-r-md",
          "[&>button:not(:first-child)]:-ml-px",
          className
        )}
        {...props}
      >
        {children}
      </div>
    )
  }
)
ButtonGroup.displayName = "ButtonGroup"

export { ButtonGroup }
