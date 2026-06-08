import { NETWORK_ENV } from "@hyperbridge-fe/shared"
import {
  Arbitrum,
  BscTestnet,
  Optimism,
  Sepolia,
} from "@hyperbridge-fe/shared/config"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import type { NetworkConfig } from "@hyperbridge-fe/shared/types"
import { type ClassValue, clsx } from "clsx"
import { isNil } from "lodash-es"
import { twMerge } from "tailwind-merge"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { SubstrateApiStore } from "@/config/services/substrate-api.ts"
import { safeStr } from "@/lib/data.helpers"
import { O } from "@/lib/utils/fp.helpers"
import type { ChainId } from "@/types"
import { rootLogger } from "./logger"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// value for a zero address
export const DEFAULT_ADDRESS = "0x0000000000000000000000000000000000000000"
export const DEFAULT_HASH =
  "0x0000000000000000000000000000000000000000000000000000000000000000"

export const safeRpcURL = (type: "https" | "ws", url: string) => {
  const _url = trimProtocol(safeStr(url).trim())
  if (type === "ws") return `wss://${_url}`
  return `https://${_url}`

  function trimProtocol(url: string) {
    return safeStr(url).split("//")[1]
  }
}

export function truncateText(_text: string, _length = 8) {
  if (_text.length <= _length) return _text
  return `${_text.slice(0, _length)}...`
}

/** Function to derive faucet url depending on the user's selected chain  */
export function faucetUrl(_chainName: ChainId) {
  switch (_chainName) {
    case Arbitrum.chainId:
      return "https://faucet.quicknode.com/arbitrum/sepolia"
    case Sepolia.chainId:
      return "https://faucet.quicknode.com/base/sepolia"
    case Optimism.chainId:
      return "https://faucet.quicknode.com/optimism/sepolia"
    case BscTestnet.chainId:
      return "https://www.bnbchain.org/en/testnet-faucet"
    default:
      return "https://faucet.quicknode.com/ethereum/sepolia"
  }
}

export function getNetworkName(chainId?: ChainId): string {
  if (isNil(chainId)) return "--"

  const network = getNetworkConfig(chainId)
  if (!network) return "--"

  return network.name
}

export function getNetworkConfig(chainId: ChainId) {
  const entry = gatewayConfig.getNetwork(chainId)

  if (!entry) {
    rootLogger.warn(
      `[TTActivity] Network(${chainId}) missing. Ensure you're in the right environment. Current Env(${NETWORK_ENV})`,
    )
  }

  return entry
}

export function safeNetworkConfig(chainId: ChainId) {
  return O.fromNullable(getNetworkConfig(chainId))
}

export function resolveApiPromise(network: NetworkConfig) {
  return NetworkImpl.match(network, {
    relay: () => SubstrateApiStore.relay,
    substrate: (network) => SubstrateApiStore.get(network.chainId),
    _: () => Promise.reject(new Error("Api Promise doesn't exist")),
  })
}

/**
 * Finds an item in a list based on a predicate, with an offset from the first matching item.
 * If no matching item is found, returns the last item in the list.
 *
 * @param offset - The offset from the first matching item (negative values go backwards)
 * @param predicate - Function to test each item in the list
 * @param list - Array of items to search through
 * @returns The item at the calculated position or the last item if no match is found
 * @throws Error if the list is empty or if the calculated index is out of bounds
 */
export function findNOrLast<T>(
  offset: number,
  predicate: (item: T) => boolean,
  list: T[],
) {
  const not_found_error = new Error("No matching item found")
  const missing_event_index = list.findIndex((event) => predicate(event))

  if (list.length === 0) {
    throw not_found_error
  }

  // if all events are present
  if (missing_event_index === -1)
    // return the last one
    return list.at(-1) as T

  const prev_event_index = missing_event_index + offset
  if (prev_event_index < 0) throw not_found_error

  return list[prev_event_index]
}

/**
 * Creates a cached version of an async function.
 * The first time the cached function is called, it calls the original function and caches the result.
 * Subsequent calls will return the cached result without calling the original function again.
 * If multiple calls are made while the first call is still pending, they will all await the same promise.
 * If the original function throws an error, the cache is not populated, and subsequent calls will retry the operation.
 *
 * @todo: Introduce a TTL for cached result
 * @param promise The async function to cache.
 * @returns A new function that returns the cached promise result.
 */
export function cachePromiseResult<
  // biome-ignore lint/suspicious/noExplicitAny: Need for type to be inferred correctly
  TFn extends (...args: any[]) => Promise<unknown>,
>(promise: TFn): TFn {
  let pendingPromise: ReturnType<TFn> | undefined
  let cachedResult: Awaited<ReturnType<TFn>> | undefined

  return (async (...args: Parameters<TFn>) => {
    if (cachedResult) {
      return cachedResult
    }

    if (pendingPromise) {
      return await pendingPromise
    }

    pendingPromise = promise(...args) as ReturnType<TFn>

    try {
      const result = await pendingPromise
      cachedResult = result
      return result
    } catch (e) {
      // On failure, reset the pending promise to allow for retries on subsequent calls.
      pendingPromise = undefined
      throw e
    }
  }) as TFn
}

/**
 * Generate exactly `count` intermediary cumulative values that reach `target`
 * using exponential (geometric) growth of increments.
 *
 * It finds the ratio r > 1 such that:
 *   target ≈ firstStep * (r^count - 1) / (r - 1)
 * and then builds cumulative sums of the geometric series.
 *
 * @param {number} target - Final target sum (e.g., 1_000_000_000).
 * @param {number} firstStep - The first increment (e.g., 50_000).
 * @param {number} count - Number of increments to reach target (integer).
 * @returns {number[]} cumulative values up to target, length = count (last value equals target).
 */
export function generateGeometricCumulative(
  target: number,
  firstStep: number,
  count: number,
) {
  if (
    !Number.isFinite(target) ||
    !Number.isFinite(firstStep) ||
    !Number.isFinite(count)
  ) {
    throw new Error("All inputs must be finite numbers.")
  }
  if (target <= 0) return [0]
  if (firstStep <= 0) throw new Error("firstStep must be > 0")
  if (!Number.isInteger(count) || count <= 0)
    throw new Error("count must be a positive integer.")

  // Check if it's even possible to reach target
  // Minimum sum is firstStep * count (when r = 1)
  if (firstStep * count > target) {
    throw new Error(
      "Impossible: firstStep * count exceeds target. No geometric series can reach target.",
    )
  }

  // Special case: if firstStep * count equals target, use ratio 1 (constant increments)
  if (Math.abs(firstStep * count - target) < 1e-9) {
    const cumulative = new Array(count)
    for (let i = 0; i < count; i++) {
      cumulative[i] = firstStep * (i + 1)
    }
    cumulative[count - 1] = target
    return cumulative
  }

  // Binary search for ratio r > 1 such that the geometric sum equals target
  // Geometric sum for r > 1: S = a * (r^n - 1) / (r - 1)
  let lo = 1.0
  let hi = (target / firstStep) ** (1 / count) * 2 // Upper bound estimate

  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2

    // Calculate geometric sum
    let sum: number
    if (Math.abs(mid - 1) < 1e-12) {
      // When r ≈ 1, use limit formula: a * n
      sum = firstStep * count
    } else {
      // Standard formula for r > 1
      const rPowN = mid ** count
      if (!Number.isFinite(rPowN)) {
        // Overflow - ratio too large
        hi = mid
        continue
      }
      sum = (firstStep * (rPowN - 1)) / (mid - 1)
    }

    if (!Number.isFinite(sum)) {
      // Overflow, reduce ratio
      hi = mid
    } else if (sum < target) {
      // Sum too small, need larger ratio
      lo = mid
    } else {
      // Sum too large, reduce ratio
      hi = mid
    }

    // Check for convergence
    if (Math.abs(hi - lo) < 1e-12) break
  }

  const r = (lo + hi) / 2

  // Build cumulative sequence
  const cumulative = new Array(count)
  let running = 0
  let term = firstStep

  for (let i = 0; i < count; i++) {
    running += term
    cumulative[i] = +running.toFixed(0)
    term *= r
  }

  // Ensure the final value is exactly target
  cumulative[count - 1] = target

  return cumulative
}

export type RankInfo = {
  currRank: number
  progress: number
  totalRanks: number
  nextTargetPoint: number
}

export function computeRankPos(currPts: number): RankInfo {
  const target = 1_000_000_000
  const firstStep = 50_000
  const count = 100

  const seq = generateGeometricCumulative(target, firstStep, count)

  const getProgress = (points: number, nextPoint: number) => {
    return (points / nextPoint) * 100
  }

  let nextTargetPoint = seq[0]

  const fallback = {
    currRank: 1,
    totalRanks: seq.length,
    progress: getProgress(currPts, nextTargetPoint),
    nextTargetPoint: nextTargetPoint,
  } satisfies RankInfo

  if (nextTargetPoint > currPts) {
    return fallback
  }

  for (const index in seq) {
    const value = seq[index]

    if (value >= currPts) {
      nextTargetPoint = seq[+index + 1]

      if (!nextTargetPoint) {
        nextTargetPoint = target
      }

      return {
        currRank: +index,
        totalRanks: seq.length,
        progress: +getProgress(currPts, nextTargetPoint).toFixed(0),
        nextTargetPoint,
      }
    }
  }

  return fallback
}
