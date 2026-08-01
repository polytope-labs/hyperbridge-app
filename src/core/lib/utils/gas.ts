import { estimateFeesPerGas } from "@wagmi/core"
import { parseGwei } from "viem"
import { WagmiConfig } from "@/config/wagmi"
import { rootLogger } from "@/lib/logger"

const logger = rootLogger.withTag("Gas")

/**
 * Bor (Polygon) chains reject transactions with a priority fee below 25 gwei,
 * and wallet estimators regularly undershoot it (MetaMask suggests 1.5 gwei),
 * failing broadcasts with "transaction gas price below minimum".
 */
const MIN_PRIORITY_FEE: Record<number, bigint> = {
  137: parseGwei("25"),
  80002: parseGwei("25"),
}

export type FeeOverrides = {
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
}

/** Raises the priority fee to the floor, keeping the base-fee headroom intact. */
export function clampToMinPriorityFee(
  fees: { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint },
  minPriorityFee: bigint,
): Required<FeeOverrides> {
  const tip =
    fees.maxPriorityFeePerGas >= minPriorityFee
      ? fees.maxPriorityFeePerGas
      : minPriorityFee
  const basePortion = fees.maxFeePerGas - fees.maxPriorityFeePerGas

  return { maxPriorityFeePerGas: tip, maxFeePerGas: basePortion + tip }
}

/**
 * Explicit fee fields for chains whose minimum priority fee wallets undershoot.
 * Returns {} elsewhere so the wallet keeps estimating on its own.
 */
export async function evmFeeOverrides(chainId: number): Promise<FeeOverrides> {
  const floor = MIN_PRIORITY_FEE[chainId]
  if (!floor) return {}

  try {
    const fees = await estimateFeesPerGas(WagmiConfig, { chainId })
    return clampToMinPriorityFee(fees, floor)
  } catch (err) {
    logger.warn(`Fee estimation failed for Chain(${chainId})`, err)
    return {}
  }
}
