import React from "react"
import { VariableSizeList as List } from "react-window"
import { cn } from "@/lib/utils"

type TList<T> = React.ComponentProps<typeof List<T>>

interface ScrollWindowingAreaProps<T> extends TList<T> {
  ref?: TList<T>["outerRef"]
}

export function ScrollWindowingArea<T>(props: ScrollWindowingAreaProps<T>) {
  const { ref, ...PROPS } = props
  const scrollListEl = React.useRef<HTMLDivElement>(null)

  React.useImperativeHandle(ref, () => {
    return scrollListEl.current
  })

  return (
    <List
      {...PROPS}
      outerRef={(ref) => {
        if (ref) {
          ref.classList.add("no-scrollbar")
        }
      }}
      innerRef={(ref) => {
        if (ref && !scrollListEl.current) {
          scrollListEl.current = ref
        }
      }}
    />
  )
}

type Dimension = { width: number; height: number }

export function AutoSizer(
  props: Omit<React.ComponentProps<"div">, "children"> & {
    children: (props: Dimension) => React.ReactNode
  },
) {
  const debug = false
  const ref = React.useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = React.useState<Dimension>({
    width: 0,
    height: 0,
  })

  React.useLayoutEffect(() => {
    function resize() {
      if (!ref.current) return

      const { width } = getComputedStyle(ref.current)
      const rect = ref.current.getBoundingClientRect()

      setDimensions({
        width: Number.parseFloat(width),
        height: rect.height || ref.current.offsetHeight || 400,
      })
    }

    const abort = new AbortController()
    resize()

    window.addEventListener("resize", resize, { signal: abort.signal })

    return () => abort.abort()
  }, [])

  return (
    <div
      ref={ref}
      {...props}
      className={cn(props.className, "relative flex-1")}
    >
      <div
        className={cn("relative inset-0", {
          "bg-blue-500/50": debug,
        })}
      >
        {props.children(dimensions)}
      </div>
    </div>
  )
}
