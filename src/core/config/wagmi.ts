import type { NetworkConfig } from "@hyperbridge-fe/shared"
import { EVM_NETWORKS, VIEM_CHAIN_MAP } from "@hyperbridge-fe/shared/config"
import { getDefaultConfig } from "connectkit"
import { fallback, type Transport } from "viem"
import { createConfig, http } from "wagmi"
import { coinbaseWallet, injected, walletConnect } from "wagmi/connectors"
import { APP_NAME, APP_URL, NETWORK_ENV, WALLET_CONNECT_ID } from "@/config/constants"

const chainIds = Object.values(EVM_NETWORKS).filter((e) => {
  return NETWORK_ENV === "mainnet"
    ? e.networkType === "mainnet"
    : e.networkType === "testnet"
})

// Only include chains that have transports defined (filtered by NETWORK_ENV)
// This ensures WalletConnect only sees chains with proper RPC URLs
const enabledChains = chainIds
  .map((network) => {
    return VIEM_CHAIN_MAP[network.chainId]
  })
  .filter((chain) => chain !== undefined)

// biome-ignore lint/suspicious/noExplicitAny: ConnectKit's getDefaultConfig returns a complex type
function createWagmiConfig(): any {
  // biome-ignore lint/suspicious/noExplicitAny: wagmi connector versions have incompatible storage types
  const connectors: any[] = [
    injected({ shimDisconnect: true }),
    coinbaseWallet({
      appName: APP_NAME,
      appLogoUrl: `${APP_URL}/logo.svg`,
    }),
  ]

  if (WALLET_CONNECT_ID) {
    connectors.push(
      walletConnect({
        projectId: WALLET_CONNECT_ID,
        showQrModal: true,
      }),
    )
  }

  const config = {
    chains: enabledChains,
    transports: Object.fromEntries(chainIds.map(networkToTransport)),
    connectors,
    walletConnectProjectId: WALLET_CONNECT_ID || undefined,
    appName: APP_NAME,
    appDescription:
      "Hyperbridge is a decentralized application that allows users to bridge assets between different blockchains.",
  }
  return createConfig(getDefaultConfig(config as any))
}

// Fall back through every configured RPC so one flaky endpoint doesn't
// zero out balances or block sends for the whole chain.
const networkToTransport = (
  network: NetworkConfig,
): [number, Transport] => {
  const transports = network.rpcUrls.map((url) => http(url))
  return [
    Number(network.chainId),
    transports.length > 1 ? fallback(transports) : transports[0],
  ]
}

export type WagmiChainId = number

export const WagmiConfig = createWagmiConfig()
