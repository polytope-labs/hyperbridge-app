import { Slot } from "@radix-ui/react-slot"
import type { HTMLAttributes } from "react"
import React from "react"

export function NumPad(props: React.ComponentProps<"input">) {
  const InputDirectives = React.useMemo(() => {
    return {
      numbersOnly: {
        inputMode: "numeric",
        onKeyDown: (e) => {
          if (e.code === "") return
          if (["Backspace", "Tab", "Period"].includes(e.code)) {
            if (e.code !== "Period") return

            // @ts-expect-error Value may not exists
            const value = e.currentTarget?.value
            if (value.length !== 0) return
          }
          if ((e.code || "").includes("Arrow")) return
          if (/\d+?/.test(e.code)) return

          e.preventDefault()
        },
      },
    } satisfies Record<"numbersOnly", HTMLAttributes<HTMLElement>>
  }, [])

  return <Slot {...props} {...InputDirectives.numbersOnly} />
}
