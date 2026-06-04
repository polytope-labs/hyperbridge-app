import type { Address } from "viem"
import type { ChainId } from "@/types"

/** Burn/mint on remote chains; lock/unlock on the token home chain */
export type HftTokenType = "hft" | "wrapped-hft"

export type HftDeployment = {
  chainId: ChainId
  address: Address
  type: HftTokenType
  /** Underlying ERC20 for wrapped-hft tokens (e.g. WBNB on BSC) */
  underlying?: Address
}

/**
 * Partner-facing token definition. Each entry describes one bridged asset
 * and its deployments across chains. The registry builder derives
 * `recipientNetworks` automatically from deployments.
 */
export type HftTokenDefinition = {
  /** Ticker shown in the UI (must be unique across all HFT tokens) */
  symbol: string
  name: string
  decimals: number
  /** Set true to keep in registry but hide from bridge UI */
  disabled?: boolean
  /**
   * Relayer fee in fee-token whole units (e.g. "5" = 5 fee tokens).
   * Used when on-chain quote is unavailable on testnet hosts.
   */
  defaultRelayerFee: string
  /** ISMP request timeout in seconds */
  defaultTimeout: number
  deployments: HftDeployment[]
}

export type HftTokenMeta = {
  type: HftTokenType
  underlying?: Address
  defaultRelayerFee: string
  defaultTimeout: number
}
