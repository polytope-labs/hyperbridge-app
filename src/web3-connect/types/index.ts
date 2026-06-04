/**
 * Core Web3 Connect Types
 * Abstracted from bridge app for reusable wallet connection functionality
 */
import type {
  WalletAccount as DefaultWalletAccount,
  Wallet,
} from "@talismn/connect-wallets"
import type { WalletProviderType } from "@/constants"

export type WalletAccount = DefaultWalletAccount & {
  genesisHash?: `0x${string}`
}

export interface EIP1193Provider {
  isStatus?: boolean
  host?: string
  path?: string
  sendAsync?: (
    request: { method: string; params?: Array<unknown> },
    callback: (error: Error | null, response: unknown) => void,
  ) => void
  send?: (
    request: { method: string; params?: Array<unknown> },
    callback: (error: Error | null, response: unknown) => void,
  ) => void
  request: (request: {
    method: string
    params?: Array<unknown>
  }) => Promise<unknown>
}

export interface EIP6963ProviderInfo {
  rdns: string
  uuid: string
  name: string
  icon: string
}

export interface EIP6963ProviderDetail {
  info: EIP6963ProviderInfo
  provider: EIP1193Provider
}

export type EIP6963AnnounceProviderEvent = {
  detail: {
    info: EIP6963ProviderInfo
    provider: Readonly<EIP1193Provider>
  }
}

export const WalletProviderStatus = Object.freeze({
  Connected: "connected",
  Pending: "pending",
  Disconnected: "disconnected",
  Error: "error",
})

export type WalletProviderStatus =
  (typeof WalletProviderStatus)[keyof typeof WalletProviderStatus]

export enum WalletMode {
  Default = "default",
  EVM = "evm",
  Substrate = "substrate",
  SubstrateEVM = "substrate-evm",
  SubstrateH160 = "substrate-h160",
}

export type Account = {
  name: string
  address: string
  displayAddress?: string
  provider: WalletProviderType
  isExternalWalletConnected?: boolean
  delegate?: string
}

export type WalletProviderMeta = {
  chain: string
}

export type WalletProviderEntry = {
  type: WalletProviderType
  status: WalletProviderStatus
}

export type AccountsMap = {
  evm: Account | null
  substrate: Account | null
}

export type WalletProvider = {
  type: WalletProviderType
  wallet: Wallet
}
