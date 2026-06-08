import type { NetworkTagSimple } from "@hyperbridge-fe/shared"
import type { SubscriptionFn, WalletAccount } from "@talismn/connect-wallets"
import type { WalletProviderType } from "@/constants"
import { resolveNetworkGroupByProvider } from "@/helpers"
import { type Account, WalletMode, type WalletProviderEntry } from "@/types"
import type { Web3ConnManager } from "./wallet-manager"

class WalletManagerRegistry {
  mode: WalletMode = WalletMode.Default

  instance: Web3ConnManager | null = null

  onMetaMaskLikeAccountChange =
    (type: WalletProviderType): SubscriptionFn =>
    (_accounts?: WalletAccount[]) => {
      const accounts: WalletAccount[] = Array.isArray(_accounts)
        ? _accounts
        : []

      console.assert(
        !(accounts.length > 1),
        `Expected a maximum size of 1 Wallet account. But got (${accounts.length} accounts) on account switch`,
      )

      if (accounts.length === 0) return this.disconnect(type)

      const [{ address, name }] = accounts
      const account = {
        address: address,
        displayAddress: address,
        provider: type,
        name: name ?? "",
        isExternalWalletConnected: false,
      }
      const networkGroup = resolveNetworkGroupByProvider(type)
      this.setAccount(networkGroup, account)
    }

  register(instance: Web3ConnManager) {
    this.instance = instance
  }

  setAccount(chain: NetworkTagSimple, account: Account): void {
    if (this.instance) {
      this.instance.setAccount(chain, account)
    }
  }

  get recentProvider() {
    return this.instance?.recentProvider || null
  }

  set recentProvider(value: WalletProviderType | null) {
    if (this.instance) {
      this.instance.recentProvider = value
    }
  }

  get providers() {
    return this.instance?.providers || []
  }

  set providers(value: WalletProviderEntry[]) {
    if (this.instance) {
      this.instance.providers = value
    }
  }

  getProviderByType(type: WalletProviderType) {
    if (this.instance) {
      return this.instance?.getProviderByType(type)
    }

    return {
      wallet: null,
      type: null,
    }
  }

  disconnectProvider(provider: WalletProviderType) {
    if (this.instance) {
      this.instance.disconnectProvider(provider)
    }
  }

  resetAllAccounts() {
    if (this.instance) {
      this.instance.resetAllAccounts()
    }
  }

  disconnect(provider?: WalletProviderType) {
    this.instance?.disconnect(provider)
  }
}

export function walletManager() {
  const wallet_manager = singleton().instance

  if (!wallet_manager) throw new Error("WalletManager is not initialized")

  return wallet_manager
}

function singleton(): WalletManagerRegistry {
  const key = Symbol.for("singleton")

  // @ts-expect-error Reference Wallet Manager
  if (!globalThis[key]) {
    // @ts-expect-error Reference Wallet Manager
    globalThis[key] = new WalletManagerRegistry()
  }

  // @ts-expect-error Reference Wallet Manager
  return globalThis[key]
}

export const WalletManagerGlobal = singleton()
