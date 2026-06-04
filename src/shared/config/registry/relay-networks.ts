// AssetHub networks
import type { AssetHubChainConfig, RelayChainConfig } from "@/types"

export const Assethub: AssetHubChainConfig = {
  group: "assetHub",
  name: "AssetHub",
  networkType: "mainnet",
  chainId: -4,
  logo: "/networks/assetHub.png",
  rpcUrls: ["wss://sys.ibp.network/asset-hub-polkadot"],
  estimatedTransferTime: "-- mins",
  explorer: {
    transaction_url: "https://assethub-polkadot.subscan.io/extrinsic/[txHash]",
    contract_url: undefined,
  },
} as const

export const AssethubPaseo: AssetHubChainConfig = {
  group: "assetHub",
  name: "AssetHub Paseo",
  networkType: "testnet",
  chainId: -5,
  logo: "/networks/assetHub.png",
  rpcUrls: ["wss://sys.ibp.network/asset-hub-paseo"],
  estimatedTransferTime: "-- mins",
  explorer: {
    transaction_url: "https://assethub-paseo.subscan.io/extrinsic/[txHash]",
    contract_url: undefined,
  },
} as const

// Relay networks
export const Polkadot: RelayChainConfig = {
  group: "relay",
  name: "Polkadot",
  networkType: "mainnet",
  disabled: false,
  chainId: 0,
  stateMachineId: "POLKADOT-3367",
  logo: "/networks/polkadot.png",
  rpcUrls: [
    "wss://sys.ibp.network/asset-hub-polkadot",
    "wss://asset-hub-polkadot-rpc.n.dwellir.com",
  ],
  estimatedTransferTime: "10 minute",
  consensus: { layer: "Relay", stateId: "DOT0" },
  explorer: {
    transaction_url: "https://assethub-polkadot.subscan.io/extrinsic/[txHash]",
    contract_url: undefined,
  },
} as const

export const Paseo: RelayChainConfig = {
  group: "relay",
  name: "Paseo",
  networkType: "testnet",
  chainId: -1,
  stateMachineId: "KUSAMA-4009",
  logo: "/networks/polkadot.png",
  rpcUrls: ["wss://sys.ibp.network/asset-hub-paseo"],
  estimatedTransferTime: "10 minute",
  consensus: { layer: "Relay", stateId: "DOT0" },
  explorer: {
    transaction_url:
      "https://paseo.subscan.io/extrinsic/[txHash]?tab=xcm_transfer`",
    contract_url: undefined,
  },
} as const

export const Nexus: RelayChainConfig = {
  group: "relay",
  chainId: -3,
  name: "Nexus",
  networkType: "mainnet",
  stateMachineId: "POLKADOT-3367",
  rpcUrls: [
    "wss://nexus.rpc.polytope.technology",
    "wss://nexus.ibp.network",
  ],
  estimatedTransferTime: "10 minutes",
  logo: "",
  consensus: { layer: "Relay", stateId: "DOT0" },
  explorer: {
    transaction_url: "https://nexus.statescan.io/#/extrinsics/[txHash]",
    contract_url: undefined,
  },
}

export const Gargantua: RelayChainConfig = {
  group: "relay",
  chainId: -2,
  name: "Gargantua",
  stateMachineId: "KUSAMA-4009",
  rpcUrls: ["wss://gargantua.rpc.polytope.technology"],
  logo: "",
  networkType: "testnet",
  estimatedTransferTime: "10 minutes",
  consensus: { layer: "Relay", stateId: "PAS0" },
  explorer: {
    transaction_url: "https://gargantua.statescan.io/#/extrinsics/[txHash]",
    contract_url: undefined,
  },
}
