import {
  Assethub,
  AssethubPaseo,
  Bsc,
  BscTestnet,
  chainEq,
  Ethereum,
  Gargantua,
  Nexus,
  Paseo,
  Polkadot,
  PolygonAmoy,
  Sepolia,
} from "@hyperbridge-fe/shared"
import { memoize } from "lodash-es"
import { computed, makeAutoObservable } from "mobx"
import type { Address } from "viem"
import { resolvePublicUrl } from "@hyperbridge-fe/shared/lib"
import { mainnetAddresses, testnetAddresses } from "@/config/addresses"
import { NETWORK_ENV, NETWORK_STORAGE_KEY } from "@/config/constants"
import { ALL_NETWORKS, BRIDGE_NETWORKS } from "@/config/registry"
import { MainAssetRegistry, TestAssetRegistry } from "@/config/registry/hft"
import type {
  AssetHubChainConfig,
  ChainId,
  ChainTokenRegistry,
  NetworkConfig,
  RelayChainConfig,
} from "@/types"

function withResolvedLogo(network: NetworkConfig): NetworkConfig {
  return {
    ...network,
    logo: resolvePublicUrl(network.logo),
  }
}

function firstRegisteredRoute(registry: ChainTokenRegistry): {
  source: ChainId
  destination: ChainId
} | null {
  for (const [source, tokens] of Object.entries(registry)) {
    for (const token of tokens) {
      const destination = token.recipientNetworks.find(
        (network) => network.disabled !== true,
      )?.chainId
      if (destination === undefined) continue

      const numericSource = Number(source)
      return {
        source: Number.isNaN(numericSource) ? source : numericSource,
        destination,
      }
    }
  }

  return null
}

export class GatewayConfig {
  environment = NETWORK_ENV

  toggleEnvironment() {
    this.environment = this.environment === "mainnet" ? "testnet" : "mainnet"

    localStorage.setItem(NETWORK_STORAGE_KEY, this.environment)
  }

  constructor() {
    makeAutoObservable(this)
  }

  isTestnet = computed(() => {
    return this.environment === "testnet"
  })

  assetHub = computed((): AssetHubChainConfig => {
    switch (this.environment) {
      case "mainnet":
        return Assethub
      default:
        return AssethubPaseo
    }
  })

  relayNetwork = computed((): RelayChainConfig => {
    switch (this.environment) {
      case "mainnet":
        return Polkadot
      default:
        return Paseo
    }
  })

  hyperbridgeNet = computed((): RelayChainConfig => {
    switch (this.environment) {
      case "mainnet":
        return Nexus
      default:
        return Gargantua
    }
  })

  inscriptionsAddress = computed((): Address => {
    switch (this.environment) {
      case "mainnet":
        return mainnetAddresses.inscriptions
      default:
        return testnetAddresses.inscriptions
    }
  })

  tokenFaucetAddress = computed((): Address => {
    switch (this.environment) {
      case "mainnet":
        return mainnetAddresses.tokenFaucet
      default:
        return testnetAddresses.tokenFaucet
    }
  })

  dispatcherAddress = computed((): Address => {
    switch (this.environment) {
      case "mainnet":
        return mainnetAddresses.dispatcherAddress
      default:
        return testnetAddresses.dispatcherAddress
    }
  })

  /**
   * @returns a list of bridge-enabled networks
   */
  bridgeableNetworks = computed((): NetworkConfig[] => {
    const byEnv =
      this.environment === "mainnet"
        ? BRIDGE_NETWORKS.filter((e) => e.networkType === "mainnet")
        : BRIDGE_NETWORKS.filter((e) => e.networkType === "testnet")

    const registry =
      this.environment === "mainnet" ? MainAssetRegistry : TestAssetRegistry
    const chainIds = Object.keys(registry)

    if (chainIds.length === 0) return byEnv

    const chainIdSet = new Set(chainIds)
    return byEnv
      .filter((network) => chainIdSet.has(String(network.chainId)))
      .map(withResolvedLogo)
  })

  /** Default source chain for the bridge UI */
  defaultSourceChain = computed((): ChainId => {
    const registry =
      this.environment === "mainnet" ? MainAssetRegistry : TestAssetRegistry
    const route = firstRegisteredRoute(registry)
    if (route) return route.source

    switch (this.environment) {
      case "mainnet":
        return Ethereum.chainId
      default:
        return BscTestnet.chainId
    }
  })

  /** Default destination chain for the bridge UI */
  defaultDestChain = computed((): ChainId => {
    const registry =
      this.environment === "mainnet" ? MainAssetRegistry : TestAssetRegistry
    const route = firstRegisteredRoute(registry)
    if (route) return route.destination

    switch (this.environment) {
      case "mainnet":
        return Ethereum.chainId
      default:
        return PolygonAmoy.chainId
    }
  })

  networkList = computed((): NetworkConfig[] => {
    switch (this.environment) {
      case "mainnet":
        return ALL_NETWORKS.filter((e) => e.networkType === "mainnet").map(
          withResolvedLogo,
        )
      default:
        return ALL_NETWORKS.filter((e) => e.networkType === "testnet").map(
          withResolvedLogo,
        )
    }
  })

  eth = computed((): ChainId => {
    switch (this.environment) {
      case "mainnet":
        return Ethereum.chainId
      default:
        return Sepolia.chainId
    }
  })

  bsc = computed((): ChainId => {
    switch (this.environment) {
      case "mainnet":
        return Bsc.chainId
      default:
        return BscTestnet.chainId
    }
  })

  get getNetwork() {
    return memoize(
      function getNetworkById(chainId: ChainId): NetworkConfig | null {
        const network =
          ALL_NETWORKS.find((network) => {
            return (
              chainEq(network.chainId, chainId) &&
              NETWORK_ENV === network.networkType
            )
          }) ?? null

        if (!network) return null

        return withResolvedLogo(network)
      },
      (chainId) => `${chainId}/${NETWORK_ENV}`,
    )
  }
}
