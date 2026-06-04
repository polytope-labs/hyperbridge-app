import { configure } from "safe-stable-stringify"

export function safeJSONParse<T>(value: string, defaultValue: T): T {
  try {
    return JSON.parse(value)
  } catch {
    return defaultValue
  }
}

export const stringifyBigInt = configure({
  bigint: true,
})
