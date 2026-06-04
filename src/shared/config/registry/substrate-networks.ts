import type { SubstrateChainConfig } from "@/types"

export const Cere: SubstrateChainConfig = {
  group: "substrate",
  name: "Cere",
  networkType: "mainnet",
  logo: "/networks/cere.svg",
  chainId: "SUBSTRATE-cere",
  consensus: {
    layer: "Cere",
    stateId: "CERE",
  },
  rpcUrls: ["wss://archive.mainnet.cere.network/ws"],
  estimatedTransferTime: "10 minutes",
  explorer: {
    transaction_url: "https://cere.statescan.io/#/extrinsics/[txHash]",
  },
}

export const ArgonNetwork: SubstrateChainConfig = {
  group: "substrate",
  chainId: "SUBSTRATE-argn",
  consensus: {
    layer: "ARGN",
    stateId: "ARGN",
  },
  name: "Argon",
  logo: "/networks/argn.svg",
  rpcUrls: ["wss://rpc.argon.network"],
  estimatedTransferTime: "8 minutes",
  networkType: "mainnet",
  explorer: {
    transaction_url: "https://argon.statescan.io/#/extrinsics/[txHash]",
  },
}

export const CereTestnet: SubstrateChainConfig = {
  group: "substrate",
  name: "Cere Testnet",
  logo: "/networks/cere.svg",
  networkType: "testnet",
  chainId: "SUBSTRATE-cere",
  consensus: {
    layer: "Cere",
    stateId: "CERE",
  },
  rpcUrls: ["wss://archive.testnet.cere.network/ws"],
  estimatedTransferTime: "10.4 minute",
  explorer: {
    transaction_url: "https://cere-testnet.statescan.io/#/extrinsics/[txHash]",
  },
}

export const Bifrost: SubstrateChainConfig = {
  group: "substrate",
  disabled: false,
  name: "Bifrost",
  logo: "/networks/bifrost.svg",
  networkType: "mainnet",
  chainId: "POLKADOT-2030",
  consensus: {
    layer: "Polkadot",
    stateId: "DOT0",
  },
  rpcUrls: ["wss://bifrost-polkadot.ibp.network"],
  estimatedTransferTime: "10 minute",
  explorer: {
    transaction_url: "https://bifrost.subscan.io/extrinsic/[txHash]",
  },
}

export const BifrostTestnet: SubstrateChainConfig = {
  group: "substrate",
  name: "Bifrost Paseo",
  disabled: false,
  logo: "/networks/bifrost.svg",
  networkType: "testnet",
  chainId: "KUSAMA-2030",
  consensus: {
    layer: "Paseo",
    stateId: "PAS0",
  },
  rpcUrls: ["wss://bifrost-rpc.paseo.liebi.com/ws"],
  estimatedTransferTime: "10 minute",
  explorer: {
    transaction_url: "/[txHash]",
  },
}

export const HydrationMainnet: SubstrateChainConfig = {
  group: "substrate",
  name: "Hydration",
  logo: "https://cdn.jsdelivr.net/gh/galacticcouncil/intergalactic-asset-metadata@latest/v2/polkadot/2034/assets/0/icon.svg",
  networkType: "mainnet",
  chainId: "POLKADOT-2034",
  consensus: {
    layer: "Polkadot",
    stateId: "DOT0",
  },
  rpcUrls: ["wss://hydration-rpc.n.dwellir.com"],
  estimatedTransferTime: "6 minute",
  explorer: {
    transaction_url: "https://hydration.subscan.io/extrinsic/[txHash]",
  },
}

export const HydrationTestnet: SubstrateChainConfig = {
  group: "substrate",
  name: "Hydration Paseo",
  logo: "https://cdn.jsdelivr.net/gh/galacticcouncil/intergalactic-asset-metadata@latest/v2/polkadot/2034/assets/0/icon.svg",
  networkType: "testnet",
  chainId: "KUSAMA-2034",
  consensus: {
    layer: "Paseo",
    stateId: "PAS0",
  },
  rpcUrls: ["wss://paseo-rpc.play.hydration.cloud"],
  estimatedTransferTime: "10 minute",
  explorer: {
    transaction_url: "/[txHash]",
  },
}
