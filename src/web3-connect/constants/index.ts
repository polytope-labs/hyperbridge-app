/**
 * Web3 Connect Constants
 * Abstracted from bridge app for wallet provider configurations
 */

export const WalletProviderType = Object.freeze({
  MetaMask: "metamask",
  Talisman: "talisman",
  TalismanEvm: "talisman-evm",
  SubwalletJS: "subwallet-js",
  SubwalletEvm: "subwallet-evm",
  PolkadotJS: "polkadot-js",
  NovaWallet: "nova-wallet",
  NovaWalletEvm: "nova-wallet-evm",
  TrustWallet: "trustwallet",
  BraveWallet: "bravewallet",
  Phantom: "phantom",
  Enkrypt: "enkrypt",
  MantaWallet: "manta-wallet-js",
  FearlessWallet: "fearless-wallet",
  Polkagate: "polkagate",
  AlephZero: "aleph-zero",
  WalletConnect: "walletconnect",
  WalletConnectEvm: "walletconnect-evm",
  ExternalWallet: "external",
  Coinbase: "coinbase",
})

export type ValuesOf<T extends Record<string, string>> = T[keyof T]

export type WalletProviderType = ValuesOf<typeof WalletProviderType>

export const MOBILE_ONLY_PROVIDERS = new Set<WalletProviderType>([
  WalletProviderType.NovaWallet,
  WalletProviderType.NovaWalletEvm,
])

export const DESKTOP_ONLY_PROVIDERS = new Set<WalletProviderType>([
  WalletProviderType.PolkadotJS,
])

export const EVM_PROVIDERS: WalletProviderType[] = [
  WalletProviderType.MetaMask,
  WalletProviderType.TalismanEvm,
  WalletProviderType.SubwalletEvm,
  WalletProviderType.NovaWalletEvm,
  WalletProviderType.TrustWallet,
  WalletProviderType.BraveWallet,
  WalletProviderType.Phantom,
  WalletProviderType.WalletConnectEvm,
  WalletProviderType.Coinbase,
]

export const SUBSTRATE_PROVIDERS: WalletProviderType[] = [
  WalletProviderType.Talisman,
  WalletProviderType.SubwalletJS,
  WalletProviderType.Enkrypt,
  WalletProviderType.PolkadotJS,
  WalletProviderType.NovaWallet,
  WalletProviderType.MantaWallet,
  WalletProviderType.FearlessWallet,
  WalletProviderType.Polkagate,
  WalletProviderType.AlephZero,
  WalletProviderType.WalletConnect,
]

export const SUBSTRATE_H160_PROVIDERS: WalletProviderType[] = [
  WalletProviderType.SubwalletJS,
  WalletProviderType.Talisman,
]

export const ALTERNATIVE_PROVIDERS: WalletProviderType[] = [
  WalletProviderType.ExternalWallet,
]

// Provider detection helpers
export const isEVMProvider = (provider: WalletProviderType): boolean =>
  EVM_PROVIDERS.includes(provider)

export const isSubstrateProvider = (provider: WalletProviderType): boolean =>
  SUBSTRATE_PROVIDERS.includes(provider)

export const isMobileOnlyProvider = (provider: WalletProviderType): boolean =>
  MOBILE_ONLY_PROVIDERS.has(provider)

export const isDesktopOnlyProvider = (provider: WalletProviderType): boolean =>
  DESKTOP_ONLY_PROVIDERS.has(provider)
