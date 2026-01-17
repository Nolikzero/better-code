import * as React from "react"
import { cn } from "../../lib/utils"

interface LogoProps extends React.SVGProps<SVGSVGElement> {
  className?: string
  fill?: string
}

export function Logo({ fill = "currentColor", className, ...props }: LogoProps) {
  return (
    <svg
      viewBox="30 110 452 292"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("w-full h-full", className)}
      aria-label="BetterCode logo"
      {...props}
    >
      {/* Left Brace { */}
      <path
        d="M130 120 C 130 120 70 120 70 200 C 70 240 40 256 40 256 C 40 256 70 272 70 312 C 70 392 130 392 130 392"
        stroke={fill}
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Right Brace } */}
      <path
        d="M382 120 C 382 120 442 120 442 200 C 442 240 472 256 472 256 C 472 256 442 272 442 312 C 442 392 382 392 382 392"
        stroke={fill}
        strokeWidth="40"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Letter B */}
      <path
        d="M170 130 H 270 C 325.228 130 350 160 350 200 C 350 230 330 250 300 256 C 340 262 360 290 360 326 C 360 370 325.228 382 270 382 H 170 V 130 Z M 230 180 V 230 H 270 C 290 230 300 220 300 205 C 300 190 290 180 270 180 H 230 Z M 230 280 V 332 H 270 C 295 332 310 320 310 306 C 310 290 295 280 270 280 H 230 Z"
        fill={fill}
      />
    </svg>
  )
}
