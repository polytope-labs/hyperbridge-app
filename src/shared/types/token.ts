import type { HexString } from "@hyperbridge/sdk"
import type { Address } from "viem"
import type { ChainId, NetworkConfig } from "./network-types"
import type { Prettify } from "./utils"

export type TokenBaseStruct = {
  name: string
  symbol: string
  decimals: number
  logo: string
  disabled: boolean
} & Record<string, unknown>

type ExtendRegistryToken<T> = Prettify<
  T & {
    readonly type?: "evm" | "substrate"
    readonly name: string
    readonly symbol: string
    readonly decimals: number
    readonly isNative?: boolean
    /** Scale-encoded asset ID */
    readonly disabled?: boolean
    readonly existentialDeposit?: number
    /**
     * @description  list of networks that can receive this token
     */
    recipientNetworks: Pick<NetworkConfig, "chainId" | "disabled">[]
  }
>

export type LookupParams = {
  source: ChainId
  destination: ChainId
  token_symbol: TokenSymbol
}

export type RegistryToken =
  | ExtendRegistryToken<{
      readonly address: string
      readonly hft?: HftTokenMeta
    }>
  | ExtendRegistryToken<{
      readonly assetId: string
      readonly balance: {
        pallet_prefix: "Balances" | "Ownership" | "Tokens" | "Assets" | "System"
        pallet_name: "pallet-balances" | "pallet-assets" | "orml-tokens"
      }
    }>

export type HftTokenMeta = {
  type: "hft" | "wrapped-hft"
  underlying?: Address
  defaultRelayerFee: string
  defaultTimeout: number
}

export interface EVMToken extends TokenBaseStruct {
  readonly __type: "evm"
  address: Address
  existentialDeposit: number
  recipientNetworks: IRecipientNetwork[]
  /** Present for HyperFungibleToken bridged assets */
  hft?: HftTokenMeta
}

type IRecipientNetwork = { chainId: string | number }

export interface Token extends TokenBaseStruct {
  chainId: ChainId
  address: Address
  recipientNetworks: IRecipientNetwork[]
}

export interface SubstrateToken extends TokenBaseStruct {
  readonly __type: "substrate"
  /**
   * The Scale-encoded asset ID on Substrate Chain.
   */
  assetId: HexString
  recipientNetworks: IRecipientNetwork[]
  existentialDeposit: number
  balance: {
    pallet_prefix: "Balances" | "Ownership" | "System"
    pallet_name: "pallet-balances" | "pallet-assets" | "orml-tokens"
  }
}

export type TokenSymbol = string

export type AnyToken = EVMToken | SubstrateToken

export type ChainTokenRegistry = Record<ChainId, RegistryToken[]>
