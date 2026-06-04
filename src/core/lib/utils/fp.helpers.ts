/* eslint-disable no-debugger */
import { Effect } from "effect"

export { flow, pipe } from "effect"
export * as Arr from "effect/Array"
export * as E from "effect/Either"
export * as O from "effect/Option"

export const debuggerEffect = Effect.tapBoth({
  onSuccess: (v) => {
    // biome-ignore lint/suspicious/noDebugger: Intentional
    debugger
    return Effect.logInfo("Success", v)
  },
  onFailure: (err) => {
    // biome-ignore lint/suspicious/noDebugger: Intentional
    debugger
    return Effect.logError("Success", err)
  },
})

export function pointfree_log(
  message: string,
  log: (..._: unknown[]) => void = console.debug,
) {
  return <T = unknown>(any: T): T => {
    log(message, any)

    return any
  }
}
