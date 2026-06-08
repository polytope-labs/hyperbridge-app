import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { isEvmAddress } from "@hyperbridge-fe/shared/lib"
import { resolveNetworkGroupByProvider } from "@hyperbridge-fe/web3-connect/helpers"
import type { WalletProviderType } from "@hyperbridge-fe/web3-connect/constants"
import { computed, observable, observe, runInAction } from "mobx"
import {
  getAccount,
  getConnections,
  watchConnections,
  watchAccount,
} from "@wagmi/core"
import { WagmiConfig } from "@/config/wagmi"
import { NETWORKS } from "@/config/constant"
import { WalletManager } from "@/lib/wallet-manager"
import type { Account, NetworkTagSimple } from "@/types"

const CONNECTOR_ID_TO_PROVIDER: Record<string, WalletProviderType> = {
  "io.metamask": "metamask",
  "io.metamask.mobile": "metamask",
  "com.trustwallet.app": "trustwallet",
  "app.phantom": "phantom",
  "xyz.talisman": "talisman-evm",
  "app.subwallet": "subwallet-evm",
  coinbaseWalletSDK: "coinbase",
  walletConnect: "walletconnect-evm",
  "com.brave.wallet": "bravewallet",
}

type DrawerState = "closed" | "networks" | "wallets"

type WalletConnState = {
  drawerState: DrawerState
  lastViewedTab: keyof typeof SidebarTabs
  selectedNetwork: NetworkTagSimple | null
  accounts: Account[]
}

export const SidebarTabs = Object.freeze({
  assets: "assets",
  history: "history",
  active: "active",
})

export const walletConnectionState = observable<WalletConnState>({
  accounts: [],
  lastViewedTab: "assets",
  drawerState: "closed",
  selectedNetwork: null,
})

/**
 * Check if provider is Nova Wallet
 */
// biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
function isNovaWallet(connector: any): boolean {
  // Check connector provider first
  if (connector?.provider?.isNovaWallet === true) {
    return true
  }

  // Fallback: check window global
  if (typeof window !== "undefined") {
    // @ts-expect-error Checking for Nova wallet global
    return window.walletExtension?.isNovaWallet === true
  }
  return false
}

/**
 * Check if provider is Trust Wallet
 */
// biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
function isTrustWallet(connector: any): boolean {
  const provider = connector?.provider
  return !!(provider?.isTrust && provider?.isMetaMask)
}

/**
 * Check if provider is MetaMask (not Trust Wallet)
 */
// biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
function isMetaMask(connector: any): boolean {
  const provider = connector?.provider
  return !!(provider?.isMetaMask && !provider?.isTrust)
}

/**
 * Get provider type from connector
 */
// biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
function getProviderType(connection: any): WalletProviderType {
  const connector = connection.connector
  // const hasEvmAddress = connection.accounts?.some((addr: string) =>
  //   isEvmAddress(addr),
  // )

  if (isNovaWallet(connector)) {
    // return hasEvmAddress ? "nova-wallet-evm" : "nova-wallet"
    return "nova-wallet"
  }

  if (isTrustWallet(connector)) return "trustwallet"

  if (
    isMetaMask(connector) ||
    connector.id === "io.metamask" ||
    connector.id === "io.metamask.mobile"
  ) {
    return "metamask"
  }

  return (
    CONNECTOR_ID_TO_PROVIDER[connector.id] ||
    (connector.id as WalletProviderType)
  )
}

/**
 * Update wallet connection state from Wagmi and WalletManager
 */
function updateWalletConnectionState(): void {
  const accounts: Account[] = []

  const wagmiAccount = getAccount(WagmiConfig)
  const wagmiConnections = getConnections(WagmiConfig)

  const activeAddress =
    wagmiAccount.address && isEvmAddress(wagmiAccount.address)
      ? wagmiAccount.address
      : null

  let evmAccount: Account | null = null
  const evmAccounts: Account[] = []

  for (const connection of wagmiConnections) {
    const providerType = getProviderType(connection)

    for (const address of connection.accounts) {
      if (isEvmAddress(address)) {
        const account: Account = {
          address,
          provider: providerType,
          name: connection.connector.name || providerType,
        }

        if (address === activeAddress) {
          evmAccount = account
        }

        evmAccounts.push(account)
      }
    }
  }

  if (!evmAccount && evmAccounts.length > 0) {
    evmAccount = evmAccounts[0]
  }

  if (evmAccount) {
    accounts.push(evmAccount)
  }

  const existingSubstrateAccounts = walletConnectionState.accounts.filter(
    (acc) => acc && !isEvmAddress(acc.address),
  )

  accounts.push(...existingSubstrateAccounts)

  runInAction(() => {
    walletConnectionState.accounts = accounts

    if (evmAccount) {
      const currentEvm = WalletManager.accounts.evm
      if (
        !currentEvm ||
        currentEvm.address !== evmAccount.address ||
        currentEvm.provider !== evmAccount.provider
      ) {
        WalletManager.accounts.evm = evmAccount
      }
    } else if (WalletManager.accounts.evm !== null) {
      WalletManager.accounts.evm = null
    }
  })
}

// Watch for connection changes
if (typeof window !== "undefined") {
  updateWalletConnectionState()

  watchConnections(WagmiConfig, {
    onChange: updateWalletConnectionState,
  })

  watchAccount(WagmiConfig, {
    onChange: updateWalletConnectionState,
  })

  // Watch for Polkadot account changes (debounced)
  let updateTimeout: ReturnType<typeof setTimeout> | null = null
  observe(WalletManager.accounts, (change) => {
    if (change.name === "substrate") {
      if (updateTimeout) clearTimeout(updateTimeout)
      updateTimeout = setTimeout(() => {
        updateWalletConnectionState()
        updateTimeout = null
      }, 100)
    }
  })
}

// Computed values
const connectedAccounts = computed(() => WalletManager.connectedAccounts)

export const activeAccounts = computed(() => walletConnectionState.accounts)

export const accountGrouped = computed(() => {
  const accounts = walletConnectionState.accounts
  const grouped = Object.groupBy(accounts, (account) =>
    isEvmAddress(account.address) ? "evm" : "polkadot",
  )

  return {
    evm: (grouped.evm || []).filter((acc) => acc !== null),
    polkadot: (grouped.polkadot || []).filter((acc) => acc !== null),
  }
})

export const viewMode = computed(() => {
  const { drawerState, selectedNetwork } = walletConnectionState

  const selectedNetworkConfig = selectedNetwork
    ? NETWORKS.find((n) => NetworkImpl.group(n) === selectedNetwork)
    : null

  const hasConnectedAccounts = connectedAccounts.get().length > 0
  const hasSavedAccounts = activeAccounts.get().length > 0

  const show_content =
    drawerState === "wallets" &&
    (hasSavedAccounts || hasConnectedAccounts) &&
    !selectedNetworkConfig

  return show_content ? "wallet_info" : drawerState
})

// UI Actions
export const handleNetworkSelect = (networkId: NetworkTagSimple) => {
  runInAction(() => {
    walletConnectionState.selectedNetwork = networkId
    walletConnectionState.drawerState = "wallets"
  })
}

export const handleCloseDrawer = () => {
  runInAction(() => {
    walletConnectionState.drawerState = "closed"
    walletConnectionState.selectedNetwork = null
    walletConnectionState.lastViewedTab = "assets"
  })
}

export const handleConnectWalletClick = () => {
  const hasConnectedAccounts = connectedAccounts.get().length > 0
  runInAction(() => {
    walletConnectionState.drawerState = hasConnectedAccounts
      ? "wallets"
      : "networks"
  })
}

export const handleBackToNetworks = () => {
  runInAction(() => {
    if (activeAccounts.get().length > 0) {
      walletConnectionState.drawerState = "wallets"
      walletConnectionState.selectedNetwork = null
    } else {
      walletConnectionState.drawerState = "networks"
    }
  })
}

export function switchToNextAvailableAccount(accounts: Account[]) {
  const entry = Object.groupBy(accounts, (e) =>
    resolveNetworkGroupByProvider(e.provider),
  )

  runInAction(() => {
    if (WalletManager.accounts.evm === null && entry.evm?.[0]) {
      WalletManager.accounts.evm = entry.evm[0]
    }

    if (WalletManager.accounts.substrate === null && entry.substrate?.[0]) {
      WalletManager.accounts.substrate = entry.substrate[0]
    }
  })
}
