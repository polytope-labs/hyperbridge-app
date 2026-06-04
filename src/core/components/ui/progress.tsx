import * as ProgressPrimitive from "@radix-ui/react-progress"
import * as React from "react"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    className={cn(
      "bg-brand-black-100/20 relative h-2 w-full overflow-hidden rounded-full",
      className,
    )}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="animate-gradient h-full w-full flex-1 rounded-[72px] transition-all"
      style={{
        transform: `translateX(-${100 - (value || 0)}%)`,
        backgroundImage:
          "linear-gradient(90deg, #E7FF30, #5126FF, #FF00D4, #00FF98, #E7FF30)",
        backgroundSize: "200% 100%",
      }}
    />
  </ProgressPrimitive.Root>
))
Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
