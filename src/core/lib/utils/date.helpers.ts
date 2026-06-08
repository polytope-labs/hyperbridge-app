import { Duration, flow } from "effect"
import humanizeDuration from "humanize-duration"

export function formatDuration(num: number) {
  return humanizeDuration(num, {
    round: true,
  })
}

export function formatDurationApproximation(num: number) {
  return humanizeDuration(num, {
    round: true,
    largest: 1,
    units: ["y", "mo", "d", "h", "m", "s"],
    language: "en",
    fallbacks: ["en"],
  })
}

export function toMilliseconds(timestamp: number) {
  // If timestamp is in seconds (less than year 2001 in milliseconds)
  if (String(timestamp).length < 11) {
    return timestamp * 1000
  }

  return timestamp
}

export function toSeconds(timestamp: number) {
  if (String(timestamp).length >= 11) {
    return Math.floor(timestamp / 1000)
  }

  return timestamp
}

export function normalizeTimestampToMs(
  timestamp?: bigint | number | string | null,
): number | undefined {
  if (typeof timestamp === "bigint") {
    return toMilliseconds(Number(timestamp))
  }

  if (typeof timestamp === "number") {
    return toMilliseconds(timestamp)
  }

  if (typeof timestamp === "string") {
    const parsed = Number.parseInt(timestamp, 10)
    if (Number.isFinite(parsed)) {
      return toMilliseconds(parsed)
    }
  }

  return undefined
}

export const ms = flow(Duration.decode, Duration.toMillis)
