import { logger } from "@hyperbridge-fe/shared/lib"
import type { Wallet } from "@talismn/connect-wallets"
import type { Config as WagmiConfig, Connector } from "@wagmi/core"
import { connect, disconnect, getConnections, getConnectors } from "@wagmi/core"
import { EVM_PROVIDERS, WalletProviderType } from "@/constants"

/**
 * Manages EVM wallet connections via Wagmi
 */
export class WagmiAdapter {
  config: WagmiConfig

  // @ts-expect-error Not all are required
  private providerToConnectorId: Record<WalletProviderType, string> = {
    [WalletProviderType.Coinbase]: "coinbaseWalletSDK",
    [WalletProviderType.SubwalletEvm]: "app.subwallet",
    [WalletProviderType.TalismanEvm]: "xyz.talisman",
    [WalletProviderType.WalletConnect]: "walletConnect",
    [WalletProviderType.MetaMask]: "io.metamask",
    [WalletProviderType.TrustWallet]: "com.trustwallet.app",
    [WalletProviderType.BraveWallet]: "com.brave.wallet",
    [WalletProviderType.Phantom]: "app.phantom",
    [WalletProviderType.WalletConnectEvm]: "walletConnect",
    [WalletProviderType.NovaWallet]: "injected",
    [WalletProviderType.NovaWalletEvm]: "injected",
  }

  // Reverse map: connector ID -> provider type
  private connectorIdToProviderType: Record<string, WalletProviderType> = {
    "io.metamask": "metamask",
    "io.metamask.mobile": "metamask",
    metaMaskSDK: "metamask",
    "com.trustwallet.app": "trustwallet",
    "app.phantom": "phantom",
    "xyz.talisman": "talisman-evm",
    "app.subwallet": "subwallet-evm",
    coinbaseWalletSDK: "coinbase",
    walletConnect: "walletconnect-evm",
    "com.brave.wallet": "bravewallet",
  }

  constructor(config: WagmiConfig) {
    this.config = config
  }

  /**
   * Get provider from connector safely
   */
  private getProvider(connector: Connector) {
    // biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
    return (connector as any).provider
  }

  /**
   * Check if provider is Nova Wallet by inspecting isNovaWallet property
   */
  private isNovaWallet(connector: Connector): boolean {
    return this.getProvider(connector)?.isNovaWallet === true
  }

  /**
   * Check if provider is Trust Wallet (has both isTrust and isMetaMask)
   */
  private isTrustWallet(connector: Connector): boolean {
    const provider = this.getProvider(connector)
    return !!(provider?.isTrust && provider?.isMetaMask)
  }

  /**
   * Check if provider is MetaMask (has isMetaMask but NOT isTrust)
   */
  private isMetaMask(connector: Connector): boolean {
    const provider = this.getProvider(connector)
    return !!(provider?.isMetaMask && !provider?.isTrust)
  }

  /**
   * Check if Nova Wallet is installed (via window global, not connector)
   */
  private isNovaWalletInstalled(): boolean {
    if (typeof window === "undefined") return false
    // @ts-expect-error Checking for Nova wallet global
    return !!window.walletExtension?.isNovaWallet
  }

  /**
   * Get installed wallet provider types from available connectors
   */
  getInstalledProviderTypes(): Set<WalletProviderType> {
    const connectors = getConnectors(this.config)
    const installed = new Set<WalletProviderType>()

    if (this.isNovaWalletInstalled()) {
      installed.add("nova-wallet")

      // biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
      const ethereum = (window as any).ethereum
      if (ethereum) {
        installed.add("nova-wallet-evm")
      }
    }

    const hasEip6963MetaMask = connectors.some(
      (c) => c.id === "io.metamask" || c.id === "io.metamask.mobile",
    )

    for (const connector of connectors) {
      // Skip legacy metaMask connector if modern version exists
      if (
        connector.id === "metaMask" &&
        (hasEip6963MetaMask || connectors.some((c) => c.id === "metaMaskSDK"))
      ) {
        continue
      }

      // Skip injected connector if it's Nova Wallet (already handled above)
      if (connector.id === "injected" && this.isNovaWalletInstalled()) {
        // biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
        const provider = (connector as any).provider
        if (provider?.isNovaWallet) {
          continue
        }
      }

      if (connector.id === "com.trustwallet.app") {
        installed.add("trustwallet")
        continue
      }

      if (
        connector.id === "io.metamask" ||
        connector.id === "io.metamask.mobile" ||
        connector.id === "metaMaskSDK"
      ) {
        installed.add("metamask")
        continue
      }

      const providerTypeById = this.connectorIdToProviderType[connector.id]
      if (providerTypeById) {
        installed.add(providerTypeById)
      }
    }

    logger.debug("[WagmiAdapter] Installed providers:", Array.from(installed))
    return installed
  }

  /**
   * Find connection by provider type (used by getConnectedAccount and disconnect)
   */
  private findConnectionByProviderType(
    providerType: WalletProviderType,
    connections: ReturnType<typeof getConnections>,
  ) {
    if (providerType === WalletProviderType.MetaMask) {
      return connections.find((c) => this.isMetaMask(c.connector))
    }

    if (providerType === WalletProviderType.TrustWallet) {
      return connections.find((c) => this.isTrustWallet(c.connector))
    }

    if (providerType === WalletProviderType.NovaWallet) {
      return connections.find((c) => this.isNovaWallet(c.connector))
    }

    if (providerType === WalletProviderType.NovaWalletEvm) {
      return connections.find(
        (c) => c.connector.id === "injected" && c.accounts.length > 0,
      )
    }

    const expectedId = this.providerToConnectorId[providerType]
    if (expectedId) {
      return connections.find((c) => c.connector.id === expectedId)
    }

    return null
  }

  /**
   * Find connector for a wallet provider
   */
  findConnector(provider: Wallet): Connector {
    const connectors = getConnectors(this.config)
    const providerType = provider.extensionName as WalletProviderType

    if (!EVM_PROVIDERS.includes(providerType)) {
      throw new Error(
        `Connector lookup not supported for ${providerType} (non-EVM wallet)`,
      )
    }

    if (providerType === WalletProviderType.MetaMask) {
      const metaMask = connectors.find((c) => this.isMetaMask(c))
      if (metaMask) return metaMask

      const metaMaskById = connectors.find(
        (c) =>
          c.id === "io.metamask" ||
          c.id === "io.metamask.mobile" ||
          c.id === "metaMaskSDK",
      )
      if (metaMaskById) return metaMaskById
    }

    if (providerType === WalletProviderType.TrustWallet) {
      const trust = connectors.find((c) => this.isTrustWallet(c))
      if (trust) return trust
    }

    if (providerType === WalletProviderType.NovaWallet) {
      const nova = connectors.find((c) => this.isNovaWallet(c))
      if (nova) return nova
    }

    if (providerType === WalletProviderType.NovaWalletEvm) {
      // biome-ignore lint/suspicious/noExplicitAny: Expecting browser runtime
      if ((window as any).ethereum) {
        const injected = connectors.find((c) => c.id === "injected")
        if (injected) return injected
      }
    }

    const expectedId = this.providerToConnectorId[providerType]
    if (expectedId) {
      const byId = connectors.find((c) => c.id === expectedId)
      if (byId) return byId
    }

    const available = connectors.map((c) => `${c.name} (${c.id})`).join(", ")
    const error = new Error(
      `No connector found for ${providerType}`,
    ) as Error & { availableConnectors?: string }
    error.availableConnectors = available
    throw error
  }

  /**
   * Check if wallet is connected
   */
  isConnected(provider: Wallet): boolean {
    const providerType = provider.extensionName as WalletProviderType

    if (!EVM_PROVIDERS.includes(providerType)) return false

    const connections = getConnections(this.config)

    if (providerType === WalletProviderType.MetaMask) {
      return connections.some((conn) => this.isMetaMask(conn.connector))
    }

    if (providerType === WalletProviderType.TrustWallet) {
      return connections.some((conn) => this.isTrustWallet(conn.connector))
    }

    if (providerType === WalletProviderType.NovaWallet) {
      return connections.some((conn) => this.isNovaWallet(conn.connector))
    }

    if (providerType === WalletProviderType.NovaWalletEvm) {
      return connections.some(
        (conn) => conn.connector.id === "injected" && conn.accounts.length > 0,
      )
    }

    // For others, try ID match
    const expectedId = this.providerToConnectorId[providerType]
    if (expectedId) {
      return connections.some((conn) => conn.connector.id === expectedId)
    }

    return false
  }

  /**
   * Get connected account for a provider
   */
  getConnectedAccount(
    provider: Wallet,
  ): { address: string; name: string } | null {
    const providerType = provider.extensionName as WalletProviderType

    if (!EVM_PROVIDERS.includes(providerType)) {
      return null
    }

    const connections = getConnections(this.config)
    const connection = this.findConnectionByProviderType(
      providerType,
      connections,
    )

    if (connection && connection.accounts.length > 0) {
      const address = connection.accounts.find((addr) => addr.startsWith("0x"))
      if (address) {
        return {
          address,
          name: connection.connector.name || providerType,
        }
      }
    }

    return null
  }

  /**
   * Connect wallet (EVM wallets only)
   */
  async connect(provider: Wallet): Promise<void> {
    const providerType = provider.extensionName as WalletProviderType

    if (!EVM_PROVIDERS.includes(providerType)) {
      return
    }

    if (this.isConnected(provider)) {
      logger.warn("Wallet already connected")
      return
    }

    try {
      const connector = this.findConnector(provider)
      if (!connector) {
        const connectors = getConnectors(this.config)
        const available = connectors
          .map((c) => `${c.name} (${c.id})`)
          .join(", ")
        throw new Error(
          `Connector not found for ${providerType}. Available: ${available}`,
        )
      }

      // Validate connector before connecting
      if (!connector.id || !connector.name) {
        throw new Error(
          `Invalid connector for ${providerType}: missing id or name`,
        )
      }

      // Validate config before connecting
      if (!this.config) {
        throw new Error("Wagmi config is not initialized")
      }

      await connect(this.config, { connector })
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      logger.error("Failed to connect via Wagmi:", {
        providerType,
        connectorId: this.providerToConnectorId[providerType],
        error: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      })
      throw err
    }
  }

  /**
   * Disconnect wallet (EVM wallets only)
   */
  async disconnect(provider: Wallet): Promise<void> {
    const providerType = provider.extensionName as WalletProviderType

    if (!EVM_PROVIDERS.includes(providerType)) {
      return
    }

    try {
      const connector = this.findConnector(provider)
      await disconnect(this.config, { connector })
    } catch {
      const connections = getConnections(this.config)
      const connection = this.findConnectionByProviderType(
        providerType,
        connections,
      )

      if (connection) {
        await disconnect(this.config, { connector: connection.connector })
      }
    }
  }
}
