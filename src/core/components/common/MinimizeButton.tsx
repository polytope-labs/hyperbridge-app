import { Button } from "@hyperbridge/ui"
import { MinusIcon } from "lucide-react"

export function MinimizeButton(props: React.ComponentProps<"button">) {
  return (
    <Button
      {...props}
      size="icon"
      variant="level_1"
      className="hover:bg-brand-black-500 bg-brand-black-350 group absolute end-4 top-4 gap-0 rounded-full p-2"
    >
      <MinusIcon />
      <span className="inline-block w-0 overflow-hidden text-xs tracking-wider transition-[width] group-hover:w-[8ch] group-focus:w-[8ch]">
        Minimize
      </span>
    </Button>
  )
}
