import {
  type AnyToken,
  type ChainId,
  matchChain,
  type NetworkTagSimple,
} from "@hyperbridge-fe/shared"
import { APP_NAME } from "@hyperbridge-fe/shared/constants"
import { isEvmAddress, logger } from "@hyperbridge-fe/shared/lib"
import { TokenImpl } from "@hyperbridge-fe/shared/factories"
import { watchAsset } from "@wagmi/core"
import { isNotNull } from "effect/Predicate"
import { makeAutoObservable } from "mobx"
import {
  ALTERNATIVE_PROVIDERS,
  DESKTOP_ONLY_PROVIDERS,
  EVM_PROVIDERS,
  MOBILE_ONLY_PROVIDERS,
  SUBSTRATE_H160_PROVIDERS,
  SUBSTRATE_PROVIDERS,
  WalletProviderType,
} from "@/constants"
import {
  resolveNetworkGroupByChain,
  resolveNetworkGroupByProvider,
} from "@/helpers"
import { type NamespaceType, POLKADOT_CAIP_ID_MAP } from "@/helpers/namespace"
import {
  type Account,
  type AccountsMap,
  WalletMode,
  type WalletProvider,
  type WalletProviderEntry,
  type WalletProviderMeta,
  WalletProviderStatus,
} from "@/types"
import { getSupportedWallets } from "@/wallets"
import { ExternalWallet } from "@/wallets/ExternalWallet"
import { MetaMask } from "@/wallets/MetaMask"
import { WalletConnect } from "@/wallets/WalletConnect"
import { ensureSelectedAccountAddrAndProviderMatch } from "./store.helpers"
import { WagmiAdapter } from "./wagmi-adapter"
import { WalletManagerGlobal } from "./wallet-manager-registry"
import { consola } from "consola"

/**
 * Manages wallet providers and accounts
 */
export class Web3ConnManager {
  mode = WalletManagerGlobal.mode
  wagmiExtension: WagmiAdapter
  // biome-ignore lint/suspicious/noExplicitAny: WagmiConfig type is complex
  wagmiConfig: any

  private _setupStatus: "idle" | "loading" | "initialized" = "idle"

  // @TODO: rename Providers to ProvidersStatus
  providers: WalletProviderEntry[] = []
  otherProviders: WalletProvider[] = []
  installedProviders: WalletProvider[] = []
  recentProvider: WalletProviderType | null = null
  error: string | null = null
  accounts: AccountsMap = {
    evm: null,
    substrate: null,
  }
  meta: WalletProviderMeta | null = null

  // biome-ignore lint/suspicious/noExplicitAny: WagmiConfig type is complex
  constructor(wagmiConfig: any) {
    makeAutoObservable(this)
    this.wagmiConfig = wagmiConfig
    this.wagmiExtension = new WagmiAdapter(this.wagmiConfig)
    // auto register to the global wallet manager registry
    WalletManagerGlobal.register(this)
  }

  setAccount(chain: NetworkTagSimple, account: Account): void {
    if (this.accounts[chain] === account) return
    this.accounts[chain] = account
  }

  isAccountSelected(
    account: Account | null,
    config: { strict?: boolean } = {},
  ): boolean {
    if (!account) return false

    if (config.strict) {
      const selectedAccounts = [this.accounts.substrate, this.accounts.evm]
      return ensureSelectedAccountAddrAndProviderMatch(
        selectedAccounts,
        account,
      )
    }

    return (
      this.accounts.evm?.address === account.address ||
      this.accounts.substrate?.address === account.address
    )
  }

  get availableProviders() {
    const { providers, mode } = this

    if (mode === WalletMode.Default) return providers

    return providers.filter(({ type }) => {
      if (mode === WalletMode.EVM) return EVM_PROVIDERS.includes(type)
      if (mode === WalletMode.Substrate)
        return SUBSTRATE_PROVIDERS.includes(type)
      if (mode === WalletMode.SubstrateH160)
        return SUBSTRATE_H160_PROVIDERS.includes(type)
      if (mode === WalletMode.SubstrateEVM) {
        return [...EVM_PROVIDERS, ...SUBSTRATE_PROVIDERS].includes(type)
      }
      return true
    })
  }

  get connectedProviders() {
    return this.availableProviders
      .map(({ status, type }) => {
        const provider = this.getProviderByType(type)
        return provider?.wallet && status === WalletProviderStatus.Connected
          ? provider
          : null
      })
      .filter(isNotNull)
  }

  get connectedAccounts() {
    return [this.accounts.substrate, this.accounts.evm].filter(isNotNull)
  }

  /**
   * Group wallet accounts by network type (EVM | Polkadot)
   */
  get groupedAccounts() {
    const accounts = this.connectedAccounts
    const grouped = Object.groupBy(accounts, (account) =>
      isEvmAddress(account.address) ? "evm" : "polkadot",
    )

    return {
      evm: (grouped.evm || []).filter(isNotNull),
      polkadot: (grouped.polkadot || []).filter(isNotNull),
    }
  }

  getStatus(providerKey: WalletProviderType | null): WalletProviderStatus {
    return (
      this.providers.find((p) => p.type === providerKey)?.status ??
      WalletProviderStatus.Disconnected
    )
  }

  setStatus(
    provider: WalletProviderType | null,
    status: WalletProviderStatus,
  ): void {
    const isError = status === WalletProviderStatus.Error
    this.providers = provider
      ? [
          ...this.providers.filter((p) => p.type !== provider),
          { type: provider, status },
        ]
      : this.providers
    this.recentProvider = provider
    this.error = isError ? this.error : ""
  }

  setError(_type: WalletProviderType, message: string) {
    this.error = message
  }

  /**
   * Reset all Wallet accounts
   */
  resetAllAccounts() {
    this.accounts.evm = null
    this.accounts.substrate = null
  }

  /**
   * Resets a specific account associated with a given network group.
   *
   * @param networkGroup - The network group representing the chain (e.g., EVM, Substrate).
   *
   * This method is used to clear the account selection for a specific network group.
   */
  resetAccountByNetwork(networkGroup: NetworkTagSimple) {
    this.accounts[networkGroup] = null
  }

  disconnectProvider(provider: WalletProviderType) {
    const providerInstance = this.getProviderByType(provider)

    this.setStatus(provider, WalletProviderStatus.Disconnected)

    if (providerInstance.wallet) {
      try {
        this.wagmiExtension.disconnect(providerInstance.wallet)
      } catch (err) {
        logger.debug("Failed to disconnect via Wagmi:", err)
      }
    }

    const networkGroup = resolveNetworkGroupByProvider(provider)
    this.accounts[networkGroup] = null
    this.providers = this.providers.filter((p) => p.type !== provider)
  }

  disconnect(provider?: WalletProviderType) {
    this.recentProvider = null
    if (provider) {
      this.disconnectProvider(provider)
    } else {
      this.providers = []
      this.resetAllAccounts()
    }
  }

  async connect(params: {
    wallet: WalletProvider["wallet"]
    namespace?: NamespaceType
    chain?: string
  }) {
    const { wallet, namespace } = params
    console.assert(wallet, "WalletProvider required to establish a connection")

    const providerType = wallet.extensionName as WalletProviderType
    const isEvm = EVM_PROVIDERS.includes(providerType)

    if (isEvm) {
      await this.wagmiExtension.connect(wallet)
      return
    }

    if (wallet instanceof WalletConnect && namespace) {
      await wallet.setNamespace(namespace)
    }
    await wallet?.enable(APP_NAME)
  }

  /**
   * setup, order and group all Supported Wallet Providers
   * @param params
   */
  loadProviders(params: {
    mode?: WalletMode
    chain?: string
    platform: "desktop" | "mobile"
  }) {
    if (this._setupStatus !== "idle") {
      consola.warn("loadProviders() already called")
      return
    }

    this._setupStatus = "loading"
    const { mode = this.mode, chain, platform = "mobile" } = params
    const isDesktop = platform === "desktop"

    const wallets = getSupportedWallets()

    const isDefaultMode = mode === WalletMode.Default
    const isEvmMode = mode === WalletMode.EVM
    const isSubstrateMode = mode === WalletMode.Substrate
    const isSubstrateEvmMode = mode === WalletMode.SubstrateEVM
    const isSubstrateH160Mode = mode === WalletMode.SubstrateH160

    const order = Object.values(WalletProviderType)
    const filteredProviders = wallets
      .filter((provider) => {
        // Platform filtering
        const byScreen = isDesktop
          ? !MOBILE_ONLY_PROVIDERS.has(provider.type)
          : !DESKTOP_ONLY_PROVIDERS.has(provider.type)

        const isAlternativeProvider = ALTERNATIVE_PROVIDERS.includes(
          provider.type,
        )
        const isEvmProvider =
          EVM_PROVIDERS.includes(provider.type) || isAlternativeProvider
        const isSubstrateProvider =
          SUBSTRATE_PROVIDERS.includes(provider.type) || isAlternativeProvider
        const isSubstrateH160Provider = SUBSTRATE_H160_PROVIDERS.includes(
          provider.type,
        )

        const byMode =
          isDefaultMode ||
          isSubstrateEvmMode ||
          (isEvmMode && isEvmProvider) ||
          (isSubstrateMode && isSubstrateProvider) ||
          (isSubstrateH160Mode && isSubstrateH160Provider)

        const byWalletConnect =
          isSubstrateMode && provider.type === "walletconnect" && chain
            ? !!POLKADOT_CAIP_ID_MAP[chain]
            : true

        return byScreen && byMode && byWalletConnect
      })
      .toSorted((a, b) => order.indexOf(a.type) - order.indexOf(b.type))

    const { installedProviders = [], otherProviders = [] } = Object.groupBy(
      filteredProviders,
      (provider) =>
        provider.wallet.installed ? "installedProviders" : "otherProviders",
    )

    this.installedProviders = installedProviders
    this.otherProviders = otherProviders
    this._setupStatus = "initialized"
  }

  getProviderByType(providerType?: WalletProviderType | null) {
    const match =
      this.installedProviders.find((p) => p.type === providerType) ||
      this.otherProviders.find((p) => p.type === providerType)

    return match || { wallet: null, type: null }
  }

  async reconnectOnRefresh() {
    if (this._setupStatus !== "initialized") {
      consola.warn("Cannot reconnect before initialization")
      return
    }

    if (this.providers.length > 0) {
      for (const provider of this.providers) {
        const { wallet } = this.getProviderByType(provider.type)
        if (wallet) {
          this.eagerEnable(wallet).catch(() => {
            consola.error("Error reconnecting provider", provider.type)
          })
        }
      }
    } else {
      this.disconnect()
    }
  }

  async eagerEnable(wallet: WalletProvider["wallet"]) {
    const evmAccount = this.accounts.evm

    if (wallet instanceof ExternalWallet) {
      if (evmAccount?.provider === WalletProviderType.ExternalWallet) {
        await wallet.setAddress(evmAccount.address)
        if (evmAccount?.delegate) {
          // enable proxy wallet for delegate
          await wallet.enableProxy(APP_NAME)
        }
      } else {
        this.disconnect(WalletProviderType.ExternalWallet)
      }
      return
    }

    // disconnect on missing WalletConnect session
    if (wallet instanceof WalletConnect) {
      try {
        await wallet?.enable(APP_NAME)
      } catch {
        this.disconnectProvider(WalletProviderType.WalletConnect)
        this.disconnectProvider(WalletProviderType.WalletConnectEvm)
      }
      return
    }

    if (!wallet?.extension) {
      await wallet?.enable(APP_NAME)
    }
  }

  getActiveAccountByChain(sourceChain: ChainId) {
    const network = resolveNetworkGroupByChain(sourceChain)
    return this.accounts[network]
  }

  cleanup(prevProviders: WalletProvider[], newProviders: WalletProvider[]) {
    for (const { type } of prevProviders) {
      const hasWalletDisconnected = !newProviders.find((p) => p.type === type)
      const { wallet } = this.getProviderByType(type)

      if (wallet && hasWalletDisconnected) {
        if (wallet instanceof WalletConnect) {
          wallet.disconnect()
        }
        if (wallet instanceof MetaMask) {
          wallet.unsubscribe()
        }
      }
    }
  }

  getSigner(
    network: NetworkTagSimple,
  ): WalletProvider["wallet"]["signer"] | null {
    const account = this.accounts[network]
    if (!account) return null

    const { wallet } = this.getProviderByType(account.provider)
    return wallet?.signer
  }

  async addTokenToWallet(network: ChainId, token: AnyToken) {
    const { evm } = this.accounts
    if (!evm) throw new Error("EVM account required")

    const provider = this.getProviderByType(evm.provider)
    if (!provider.wallet) throw new Error("Wallet provider not found")

    const connector = this.wagmiExtension.findConnector(provider.wallet)

    const isAdded = await matchChain(network, {
      evm: () =>
        TokenImpl.match(token, {
          evm: async (evm_token) =>
            watchAsset(this.wagmiConfig, {
              connector,
              type: "ERC20",
              options: {
                symbol: evm_token.symbol,
                decimals: evm_token.decimals,
                address: evm_token.address,
              },
            }),
          _: () => {
            throw new Error("Can't add non-EVM tokens to EVM wallet")
          },
        }),
      _: () => {
        throw new Error("Can't add tokens to non-EVM networks")
      },
      none: () => {
        throw new Error("Invalid network")
      },
    })

    return { isAdded }
  }
}
