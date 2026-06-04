import { Slot } from "@radix-ui/react-slot"
import { rootLogger } from "@/lib/logger"

/**
 * @description - Logs input to the console for debugging. Hold SHIFT and Click
 * @param props
 * @returns
 */
export function DebugClick(props: {
  disabled?: boolean
  input: () => unknown
  onClick?: (event: React.MouseEvent<HTMLElement, MouseEvent>) => void
  children: React.ReactNode
  ref?: React.RefObject<HTMLDivElement>
}) {
  const { children, input: fn } = props
  const logger = rootLogger.withTag("DebugClick")

  if (props.disabled) return children

  return (
    <Slot
      title="[Shift] + [Click] to see output in console"
      onClickCapture={(evt) => {
        console.log("holding shift", evt.shiftKey)
        if (evt.shiftKey === false) {
          return props.onClick?.(evt)
        }
        evt.preventDefault()
        evt.stopPropagation()
        logger.log(fn())
      }}
    >
      {children}
    </Slot>
  )
}
