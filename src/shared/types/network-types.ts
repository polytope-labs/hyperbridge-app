import type { HexString } from "@hyperbridge/sdk"
/**
 * ChainId or StateMachineId
 */
export type ChainId = number | string

export type StrictChainId = WagmiChainId | StateMachineId

export type WagmiChainId = number

export type RpcUrl = `${"https://" | "wss://"}${string}`

export type ConsensusStateId =
  | "ETH0"
  | "BSC0"
  | "DOT0"
  | "GNO0"
  | "PAS0"
  | "POLY"
  | "UNI0"

export type StateMachineId =
  | `SUBSTRATE-${string}`
  | `EVM-${string}`
  | `POLKADOT-${string}`
  | `KUSAMA-${string}`

export type UnifiedMatchers<TArg, TOut> = {
  evm?: (value: TArg) => TOut
  substrate?: (value: TArg) => TOut
  relay?: (value: TArg) => TOut
  assetHub?: (value: TArg) => TOut
  _?: (chainId: TArg) => TOut
  none: () => TOut
}

interface NetworkBaseConfig {
  name: string
  logo: string
  rpcUrls: RpcUrl[]
  estimatedTransferTime: string
  disabled?: boolean
  networkType: "mainnet" | "testnet"
  /**
   * @deprecated change to explorer.transaction_url
   */
  transaction?: {
    url: `${string}/[txHash]${string | ""}`
  }
  explorer?: {
    transaction_url: `${string}/[txHash]${string | ""}`
    contract_url?: `${string}/[reference]${string | ""}`
  }
  /**
   * @description Hyperbridge features that are supported by the network
   */
  featureSupported?: Array<"bridge">
}

export interface AssetHubChainConfig extends NetworkBaseConfig {
  group: "assetHub"
  chainId: number
}

export interface RelayChainConfig extends NetworkBaseConfig {
  group: "relay"
  chainId: number
  stateMachineId: StateMachineId
  rpcUrls: RpcUrl[]
  consensus: {
    layer: "Relay"
    stateId: ConsensusStateId
  }
}

export interface SubstrateChainConfig extends NetworkBaseConfig {
  group: "substrate"
  chainId: StateMachineId
  consensus: {
    layer: string
    stateId: string
  }
}

type EVMNetworkConfigTags = "opstack"

export interface EVMChainConfig extends NetworkBaseConfig {
  group: "evm"
  name: string
  logo: string
  chainId: WagmiChainId
  stateMachineId: StateMachineId
  rpcUrls: RpcUrl[]
  networkType: "mainnet" | "testnet"
  estimatedTransferTime: string
  ismpHost: HexString
  consensus: {
    layer: string
    stateId: ConsensusStateId
  }
  intentGatewayV2?: {
    gatewayAddress: HexString
    bundlerUrl?: string
  }
  // @todo: Move to Token Registry
  assets?: Record<string, HexString>
  tags?: EVMNetworkConfigTags[]
}

export type NetworkConfig =
  | EVMChainConfig
  | RelayChainConfig
  | AssetHubChainConfig
  | SubstrateChainConfig

export type Maybe<T> = T | undefined | null

export type NetworkTag = "substrate" | "evm" | "relay" | "assetHub"

export type NetworkTagSimple = "evm" | "substrate"
