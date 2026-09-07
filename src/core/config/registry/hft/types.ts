import type { Address } from "viem"
import type { ChainId, RegistryToken } from "@/types"

/** Burn/mint on remote chains; lock/unlock on the token home chain */
export type HftTokenType = "hft" | "wrapped-hft"

type HftDeploymentBase = {
  chainId: ChainId
  /** Override the token precision on this deployment. */
  decimals?: number
  /** Override the automatically derived peer deployments for one-way routes. */
  recipientChainIds?: ChainId[]
}

export type HftEvmDeployment = HftDeploymentBase & {
  address: Address
  type: HftTokenType
  /** Underlying ERC20 for wrapped-hft tokens (e.g. WBNB on BSC) */
  underlying?: Address
  /**
   * True when the wrapped-hft wraps the chain's WETH-style native wrapper
   * (contract isWeth() == true). Sends spend the native token via msg.value
   * and balances are read from the native balance, not an ERC20.
   */
  weth?: boolean
}

type SubstrateRegistryToken = Extract<RegistryToken, { assetId: string }>

export type HftSubstrateDeployment = HftDeploymentBase &
  Pick<
    SubstrateRegistryToken,
    "assetId" | "balance" | "existentialDeposit" | "isNative"
  > & {
    type: "substrate"
  }

export type HftDeployment = HftEvmDeployment | HftSubstrateDeployment

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
  /** Defaults to true. Set false when this token must always be relayer-delivered. */
  selfDelivery?: boolean
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
  /** Wrapped-hft wraps native via WETH semantics; send/balance use native value */
  weth?: boolean
  defaultRelayerFee: string
  defaultTimeout: number
}
