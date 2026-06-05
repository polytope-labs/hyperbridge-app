import type { NetworkTagSimple } from "@hyperbridge-fe/shared"
import { resolvePublicUrl } from "@hyperbridge-fe/shared/lib"
import { EVM_PROVIDERS, type WalletProviderType } from "@/constants"

export { resolveNetworkGroup as resolveNetworkGroupByChain } from "@hyperbridge-fe/shared"

export function resolveNetworkGroupByProvider(
  providerType: WalletProviderType,
): NetworkTagSimple {
  return EVM_PROVIDERS.includes(providerType) ? "evm" : "substrate"
}

export function isEvmProvider(provider?: WalletProviderType | null): boolean {
  return !!provider && EVM_PROVIDERS.includes(provider)
}

export const formatAddress = (address: string, length = 6): string => {
  if (!address || address.length <= length * 2) return address
  return `${address.slice(0, length)}...${address.slice(-length)}`
}

export const getProviderIcon = (provider: WalletProviderType): string => {
  const iconMap: Record<WalletProviderType, string> = {
    metamask: "/wallets/metamask.svg",
    talisman: "/wallets/talisman.svg",
    "talisman-evm": "/wallets/talisman.svg",
    "subwallet-js": "/wallets/subwallet.svg",
    "subwallet-evm": "/wallets/subwallet.svg",
    "polkadot-js": "/wallets/polkadot-js.svg",
    "nova-wallet": "/wallets/nova.svg",
    "nova-wallet-evm": "/wallets/nova.svg",
    trustwallet: "/wallets/trust.svg",
    bravewallet: "/wallets/brave.svg",
    phantom: "/wallets/phantom.svg",
    enkrypt: "/wallets/enkrypt.svg",
    "manta-wallet-js": "/wallets/manta.svg",
    "fearless-wallet": "/wallets/fearless.svg",
    polkagate: "/wallets/polkagate.svg",
    "aleph-zero": "/wallets/aleph-zero.svg",
    walletconnect: "/wallets/walletconnect.svg",
    "walletconnect-evm": "/wallets/walletconnect.svg",
    external: "/wallets/external.svg",
    coinbase: "/wallets/coinbase.svg",
  }

  return resolvePublicUrl(iconMap[provider] || "/tokens/unknown.svg")
}

export const getProviderName = (provider: WalletProviderType): string => {
  const nameMap: Record<WalletProviderType, string> = {
    metamask: "MetaMask",
    talisman: "Talisman",
    "talisman-evm": "Talisman EVM",
    "subwallet-js": "SubWallet",
    "subwallet-evm": "SubWallet EVM",
    "polkadot-js": "Polkadot.js",
    "nova-wallet": "Nova Wallet",
    "nova-wallet-evm": "Nova Wallet (EVM)",
    trustwallet: "Trust Wallet",
    bravewallet: "Brave Wallet",
    phantom: "Phantom",
    enkrypt: "Enkrypt",
    "manta-wallet-js": "Manta Wallet",
    "fearless-wallet": "Fearless Wallet",
    polkagate: "Polkagate",
    "aleph-zero": "Aleph Zero",
    walletconnect: "WalletConnect",
    "walletconnect-evm": "WalletConnect EVM",
    external: "External Wallet",
    coinbase: "Coinbase",
  }

  return nameMap[provider] || provider
}

/**
 * Check if wallet provider is available in browser
 * Trust Wallet detection: MUST check isTrust AND isMetaMask together
 * MetaMask detection: MUST check isMetaMask AND !isTrust
 */
export const isProviderAvailable = (provider: WalletProviderType): boolean => {
  if (typeof window === "undefined") return false

  // biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
  const w = window as any

  switch (provider) {
    case "trustwallet":
      return !!(w.ethereum?.isTrust && w.ethereum?.isMetaMask)

    case "metamask":
      return !!(w.ethereum?.isMetaMask && !w.ethereum?.isTrust)

    case "talisman":
    case "talisman-evm":
      return !!w.talismanEth

    case "subwallet-js":
    case "subwallet-evm":
      return !!w.SubWallet

    case "polkadot-js":
      return !!(
        w.injectedWeb3?.["polkadot-js"] && !w.walletExtension?.isNovaWallet
      )

    case "nova-wallet":
      return !!(
        w.injectedWeb3?.["polkadot-js"] && w.walletExtension?.isNovaWallet
      )

    // case "nova-wallet-evm":
    //   return !!(w.walletExtension?.isNovaWallet && w.ethereum)

    case "bravewallet":
      return !!w.ethereum?.isBraveWallet

    case "phantom":
      return !!w.phantom?.ethereum

    case "enkrypt":
      return !!w.enkrypt

    case "manta-wallet-js":
      return !!w.mantaWallet

    case "fearless-wallet":
      return !!w.fearlessWallet

    case "polkagate":
      return !!w.injectedWeb3?.polkagate

    case "aleph-zero":
      return !!w.alephZero

    case "coinbase":
      return !!w.ethereum?.isCoinbaseWallet

    case "walletconnect":
    case "walletconnect-evm":
    case "external":
      return true

    default:
      return false
  }
}
