import {
  getWallets,
  NovaWallet as NovaWalletPolkadotProxy,
  type Wallet,
} from "@talismn/connect-wallets"
import { SUBSTRATE_H160_PROVIDERS, WalletProviderType } from "@/constants"
import {
  WalletManagerGlobal,
  walletManager,
} from "@/store/wallet-manager-registry"
import type { EIP6963AnnounceProviderEvent, WalletProvider } from "@/types"
import { SubWalletEvm } from "@/wallets/SubWalletEvm"
import { WalletConnectEvm } from "@/wallets/WalletConnectEvm"
import { BraveWallet } from "./BraveWallet"
import { Coinbase } from "./Coinbase"
import { MetaMask } from "./MetaMask"
import { NovaWallet } from "./NovaWallet"
import { NovaWalletEvm } from "./NovaWalletEvm"
import { Phantom } from "./Phantom"
import { SubWallet } from "./SubWallet"
import { Talisman } from "./Talisman"
import { TalismanEvm } from "./TalismanEvm"
import { TrustWallet } from "./TrustWallet"

function onMetaMaskLikeAccountChange(type: WalletProviderType) {
  return WalletManagerGlobal.onMetaMaskLikeAccountChange(type)
}

const wallets = getWallets().filter((wallet) => {
  if (wallet instanceof NovaWalletPolkadotProxy) return false

  // filter out wallet providers that are not supported by Hydration
  return !SUBSTRATE_H160_PROVIDERS.includes(
    wallet.extensionName as WalletProviderType,
  )
})

const novaWallet: Wallet = new NovaWallet()
const novaWalletEvm: Wallet = new NovaWalletEvm({
  onAccountsChanged: onMetaMaskLikeAccountChange(
    WalletProviderType.NovaWalletEvm,
  ),
})

const talisman = new Talisman()
const talismanEvm: Wallet = new TalismanEvm({
  onAccountsChanged: onMetaMaskLikeAccountChange(
    WalletProviderType.TalismanEvm,
  ),
})

const subwallet: Wallet = new SubWallet()
const subwalletEvm: Wallet = new SubWalletEvm({
  onAccountsChanged: onMetaMaskLikeAccountChange(
    WalletProviderType.SubwalletEvm,
  ),
})

const metaMask: Wallet = new MetaMask({
  onAccountsChanged: onMetaMaskLikeAccountChange(WalletProviderType.MetaMask),
})

const coinbase: Wallet = new Coinbase()

const trustWallet: Wallet = new TrustWallet({
  onAccountsChanged: onMetaMaskLikeAccountChange(
    WalletProviderType.TrustWallet,
  ),
})

const phantom: Wallet = new Phantom({
  onAccountsChanged: onMetaMaskLikeAccountChange(WalletProviderType.Phantom),
})

// const walletConnect: Wallet = new WalletConnect({
//   onModalClose: (session) => {
//     if (!session) {
//       walletManager().disconnectProvider(WalletProviderType.WalletConnectEvm)
//     }
//   },
//   onSessionDelete: () => {
//     walletManager().disconnectProvider(WalletProviderType.WalletConnectEvm)
//   },
// })

const walletConnectEvm: Wallet = new WalletConnectEvm({
  onModalClose: (session) => {
    if (!session) {
      walletManager().disconnectProvider(WalletProviderType.WalletConnectEvm)
    }
  },
  onSessionDelete: () => {
    walletManager().disconnectProvider(WalletProviderType.WalletConnectEvm)
  },
})

// const externalWallet: Wallet = new ExternalWallet()

let SUPPORTED_WALLET_PROVIDERS: WalletProvider[] = [
  ...wallets,
  coinbase,
  metaMask,
  talisman,
  talismanEvm,
  subwalletEvm,
  subwallet,
  trustWallet,
  phantom,
  novaWallet,
  novaWalletEvm,
  // walletConnect,
  walletConnectEvm,
  // externalWallet,
].map((wallet) => ({
  wallet,
  type: normalizeProviderType(wallet),
}))

export function normalizeProviderType(wallet: Wallet): WalletProviderType {
  if (wallet instanceof NovaWallet) {
    return WalletProviderType.NovaWallet
  }

  if (wallet instanceof NovaWalletEvm) {
    return WalletProviderType.NovaWalletEvm
  }

  return wallet.extensionName as WalletProviderType
}

export function getSupportedWallets() {
  return SUPPORTED_WALLET_PROVIDERS
}

const eip6963ProvidersByRdns = new Map([
  ["io.metamask", { Wallet: MetaMask, type: WalletProviderType.MetaMask }],
  [
    "io.metamask.mobile",
    { Wallet: MetaMask, type: WalletProviderType.MetaMask },
  ],
  [
    "xyz.talisman",
    { Wallet: TalismanEvm, type: WalletProviderType.TalismanEvm },
  ],
  [
    "com.brave.wallet",
    { Wallet: BraveWallet, type: WalletProviderType.BraveWallet },
  ],
  ["app.phantom", { Wallet: Phantom, type: WalletProviderType.Phantom }],
])

function syncSupportedWalletProviders(wallet: Wallet) {
  const type = normalizeProviderType(wallet)

  // @TODO:  Be cautions of this Mutation
  SUPPORTED_WALLET_PROVIDERS = [
    ...SUPPORTED_WALLET_PROVIDERS.filter((provider) => provider.type !== type),
    {
      wallet,
      type,
    },
  ]
}

/**
 * From Hydration
 * Handles the event of EIP-6963 standard to announce injected Wallet Providers
 * For more information, refer to https://eips.ethereum.org/EIPS/eip-6963
 */
export function handleAnnounceProvider(event: EIP6963AnnounceProviderEvent) {
  const provider = eip6963ProvidersByRdns.get(event.detail.info.rdns)

  if (provider) {
    syncSupportedWalletProviders(
      new provider.Wallet({
        provider: event.detail.provider,
        onAccountsChanged: onMetaMaskLikeAccountChange(provider.type),
      }),
    )
  }
}
