import * as React from "react"
import { Tooltip, TooltipTrigger, TooltipContent } from "./tooltip"
import { Button, type ButtonProps } from "./button"

interface IconButtonProps extends ButtonProps {
  tooltip: string
  tooltipSide?: "top" | "right" | "bottom" | "left"
}

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ tooltip, tooltipSide = "top", ...props }, ref) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button ref={ref} aria-label={tooltip} {...props} />
      </TooltipTrigger>
      <TooltipContent side={tooltipSide}>{tooltip}</TooltipContent>
    </Tooltip>
  )
)
IconButton.displayName = "IconButton"

export { IconButton }
export type { IconButtonProps }
