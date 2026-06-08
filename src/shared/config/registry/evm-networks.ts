import { ALCHEMY_API_KEY, ANKR_API_KEY } from "@hyperbridge-fe/shared/constants"
import type { EVMChainConfig } from "@/types"

export const Ethereum: EVMChainConfig = {
  group: "evm",
  name: "Ethereum",
  networkType: "mainnet",
  chainId: 1,
  stateMachineId: "EVM-1",
  logo: "/networks/ethereum.svg",
  estimatedTransferTime: "25 minutes",
  rpcUrls: [`https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  consensus: { layer: "Ethereum", stateId: "ETH0" },
  ismpHost: "0x792A6236AF69787C40cF76b69B4c8c7B28c4cA20",
  explorer: {
    transaction_url: "https://etherscan.io/tx/[txHash]",
    contract_url: "https://etherscan.io/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0x2d61624A17f361020679FaA16fbB566C344AaF4B",
    bundlerUrl: `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  },
}

export const Sepolia: EVMChainConfig = {
  group: "evm",
  name: "Sepolia",
  networkType: "testnet",
  chainId: 11155111,
  stateMachineId: "EVM-11155111",
  logo: "/networks/ethereum.svg",
  estimatedTransferTime: "25 minutes",
  rpcUrls: [`https://eth-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  consensus: { layer: "Sepolia", stateId: "ETH0" },
  ismpHost: "0x2EdB74C269948b60ec1000040E104cef0eABaae8",
  explorer: {
    transaction_url: "https://sepolia.etherscan.io/tx/[txHash]",
    contract_url: "https://sepolia.etherscan.io/address/[reference]",
  },
}

export const Gnosis: EVMChainConfig = {
  group: "evm",
  name: "Gnosis",
  logo: "/networks/gnosis.svg",
  chainId: 100,
  disabled: true,
  stateMachineId: "EVM-100",
  rpcUrls: [`https://gnosis-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "mainnet",
  estimatedTransferTime: "15 minutes",
  consensus: { layer: "Gnosis", stateId: "GNO0" },
  ismpHost: "0x50c236247447B9d4Ee0561054ee596fbDa7791b1",
  explorer: {
    transaction_url: "https://gnosisscan.io/tx/[txHash]",
    contract_url: "https://gnosisscan.io/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0x2d61624A17f361020679FaA16fbB566C344AaF4B",
  },
}

export const Chiado: EVMChainConfig = {
  group: "evm",
  name: "Chiado",
  logo: "/networks/gnosis.svg",
  chainId: 10200,
  stateMachineId: "EVM-10200",
  rpcUrls: [
    `https://gnosis-chiado.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    `https://rpc.ankr.com/gnosis_testnet/${ANKR_API_KEY}`,
  ],
  networkType: "testnet",
  estimatedTransferTime: "15 minutes",
  consensus: { layer: "Gnosis Chiado", stateId: "GNO0" },
  ismpHost: "0x58A41B89F4871725E5D898d98eF4BF917601c5eB",
  explorer: {
    transaction_url: "https://gnosis-chiado.blockscout.com/tx/[txHash]",
    contract_url: "https://gnosis-chiado.blockscout.com/address/[reference]",
  },
}

export const Base: EVMChainConfig = {
  group: "evm",
  name: "Base",
  logo: "/networks/base.svg",
  chainId: 8453,
  stateMachineId: "EVM-8453",
  rpcUrls: [`https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "mainnet",
  estimatedTransferTime: "1 hour",
  consensus: { layer: "Ethereum", stateId: "ETH0" },
  ismpHost: "0x6FFe92e4d7a9D589549644544780e6725E84b248",
  explorer: {
    transaction_url: "https://basescan.org/tx/[txHash]",
    contract_url: "https://basescan.org/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0x2d61624A17f361020679FaA16fbB566C344AaF4B",
    bundlerUrl: `https://base-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  },
  tags: ["opstack"],
}

export const BaseSepolia: EVMChainConfig = {
  group: "evm",
  name: "Base Sepolia",
  logo: "/networks/base.svg",
  chainId: 84532,
  stateMachineId: "EVM-84532",
  rpcUrls: [`https://base-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "testnet",
  estimatedTransferTime: "25 minutes",
  consensus: { layer: "Sepolia", stateId: "ETH0" },
  ismpHost: "0xD198c01839dd4843918617AfD1e4DDf44Cc3BB4a",
  explorer: {
    transaction_url: "https://sepolia.basescan.org/tx/[txHash]",
    contract_url: "https://sepolia.basescan.org/address/[reference]",
  },
  tags: ["opstack"],
}

export const Arbitrum: EVMChainConfig = {
  group: "evm",
  name: "Arbitrum",
  logo: "/networks/arbitrum.svg",
  chainId: 42161,
  stateMachineId: "EVM-42161",
  rpcUrls: [`https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "mainnet",
  estimatedTransferTime: "1 hour",
  consensus: { layer: "Ethereum", stateId: "ETH0" },
  ismpHost: "0xE05AFD4Eb2ce6d65c40e1048381BD0Ef8b4B299e",
  explorer: {
    transaction_url: "https://arbiscan.io/tx/[txHash]",
    contract_url: "https://arbiscan.io/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0x2d61624A17f361020679FaA16fbB566C344AaF4B",
    bundlerUrl: `https://arb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  },
}

export const ArbitrumSepolia: EVMChainConfig = {
  group: "evm",
  name: "Arbitrum Sepolia",
  logo: "/networks/arbitrum.svg",
  chainId: 421614,
  stateMachineId: "EVM-421614",
  rpcUrls: [`https://arb-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "testnet",
  estimatedTransferTime: "1 hour",
  consensus: { layer: "Sepolia", stateId: "ETH0" },
  ismpHost: "0x3435bD7e5895356535459D6087D1eB982DAd90e7",
  explorer: {
    transaction_url: "https://sepolia.arbiscan.io/tx/[txHash]",
    contract_url: "https://sepolia.arbiscan.io/address/[reference]",
  },
}

export const Optimism: EVMChainConfig = {
  group: "evm",
  name: "Optimism",
  logo: "/networks/optimism.svg",
  chainId: 10,
  stateMachineId: "EVM-10",
  rpcUrls: [`https://opt-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "mainnet",
  estimatedTransferTime: "1 hour",
  consensus: { layer: "Ethereum", stateId: "ETH0" },
  ismpHost: "0x78c8A5F27C06757EA0e30bEa682f1FD5C8d7645d",
  explorer: {
    transaction_url: "https://optimistic.etherscan.io/tx/[txHash]",
    contract_url: "https://optimistic.etherscan.io/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0x2d61624A17f361020679FaA16fbB566C344AaF4B",
  },
  tags: ["opstack"],
}

export const OptimismSepolia: EVMChainConfig = {
  group: "evm",
  name: "Optimism Sepolia",
  logo: "/networks/optimism.svg",
  chainId: 11155420,
  stateMachineId: "EVM-11155420",
  rpcUrls: [`https://opt-sepolia.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "testnet",
  estimatedTransferTime: "25 minutes",
  consensus: { layer: "Sepolia", stateId: "ETH0" },
  ismpHost: "0x6d51b678836d8060d980605d2999eF211809f3C2",
  explorer: {
    transaction_url: "https://sepolia-optimism.etherscan.io/tx/[txHash]",
    contract_url: "https://sepolia-optimism.etherscan.io/address/[reference]",
  },
  tags: ["opstack"],
}

export const Bsc: EVMChainConfig = {
  group: "evm",
  name: "BNB Chain",
  logo: "/networks/bsc.svg",
  chainId: 56,
  stateMachineId: "EVM-56",
  rpcUrls: [`https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "mainnet",
  estimatedTransferTime: "10 minutes",
  consensus: { layer: "BNB", stateId: "BSC0" },
  ismpHost: "0x24B5d421Ec373FcA57325dd2F0C074009Af021F7",
  explorer: {
    transaction_url: "https://bscscan.com/tx/[txHash]",
    contract_url: "https://bscscan.com/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0x2d61624A17f361020679FaA16fbB566C344AaF4B",
    bundlerUrl: `https://bnb-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  },
}

export const BscTestnet: EVMChainConfig = {
  group: "evm",
  name: "BSC Testnet",
  logo: "/networks/bsc.svg",
  chainId: 97,
  stateMachineId: "EVM-97",
  rpcUrls: [
    "https://bsc-testnet-rpc.publicnode.com",
    `https://bnb-testnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
    "https://bsc-geth-testnet-rpc.blockops.network",
  ],
  networkType: "testnet",
  estimatedTransferTime: "10 minutes",
  consensus: { layer: "BNB Testnet", stateId: "BSC0" },
  ismpHost: "0xEB944071A9Bf22810757C5BcFf7a2aE9663a311D",
  featureSupported: ["bridge"],
  explorer: {
    transaction_url: "https://testnet.bscscan.com/tx/[txHash]",
    contract_url: "https://testnet.bscscan.com/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0xFbF50B2b32768127603cC9eF4b871574b881b8eD",
  },
}

export const Soneium: EVMChainConfig = {
  group: "evm",
  name: "Soneium",
  disabled: true,
  logo: "/networks/soneium.svg",
  networkType: "mainnet",
  chainId: 1868,
  stateMachineId: "EVM-1868",
  consensus: {
    layer: "Soneium",
    stateId: "ETH0",
  },
  rpcUrls: [`https://soneium-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  estimatedTransferTime: "10 minute",
  ismpHost: "0x7F0165140D0f3251c8f6465e94E9d12C7FD40711",
  explorer: {
    transaction_url: "https://soneium.blockscout.com/tx/[txHash]",
    contract_url: "https://soneium.blockscout.com/address/[reference]",
  },
  tags: ["opstack"],
}

export const Polygon: EVMChainConfig = {
  group: "evm",
  name: "Polygon",
  chainId: 137,
  stateMachineId: "EVM-137",
  // rpcUrls: [
  //   "https://rpc.ankr.com/polygon/d9c18fde9e1f76458a3f5ab81a9fe3be38a0863de3a6274335a08389b5d62a59",
  // ],
  rpcUrls: [`https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "mainnet",
  logo: "/networks/polygon.svg",
  estimatedTransferTime: "10 minutes",
  ismpHost: "0xD8d3db17C1dF65b301D45C84405CcAC1395C559a",
  consensus: { layer: "Polygon", stateId: "POLY" },
  explorer: {
    transaction_url: "https://polygonscan.com/tx/[txHash]",
    contract_url: "https://polygonscan.com/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0x2d61624A17f361020679FaA16fbB566C344AaF4B",
    bundlerUrl: `https://polygon-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  },
}

export const PolygonAmoy: EVMChainConfig = {
  group: "evm",
  name: "Polygon Amoy",
  chainId: 80002,
  stateMachineId: "EVM-80002",
  rpcUrls: [
    "https://polygon-amoy-bor-rpc.publicnode.com",
    `https://polygon-amoy.g.alchemy.com/v2/${ALCHEMY_API_KEY}`,
  ],
  networkType: "testnet",
  logo: "/networks/polygon.svg",
  estimatedTransferTime: "10 minutes",
  ismpHost: "0xEB944071A9Bf22810757C5BcFf7a2aE9663a311D",
  consensus: { layer: "Polygon", stateId: "POLY" },
  featureSupported: ["bridge"],
  explorer: {
    transaction_url: "https://amoy.polygonscan.com/tx/[txHash]",
    contract_url: "https://amoy.polygonscan.com/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0xFbF50B2b32768127603cC9eF4b871574b881b8eD",
  },
}

export const Unichain: EVMChainConfig = {
  group: "evm",
  name: "Unichain",
  chainId: 130,
  stateMachineId: "EVM-130",
  rpcUrls: [`https://unichain-mainnet.g.alchemy.com/v2/${ALCHEMY_API_KEY}`],
  networkType: "mainnet",
  logo: "/networks/unichain.svg",
  estimatedTransferTime: "10 minutes",
  ismpHost: "0x2A17C1c3616Bbc33FCe5aF5B965F166ba76cEDAf",
  consensus: { layer: "Uniswap", stateId: "UNI0" },
  explorer: {
    transaction_url: "https://unichain.blockscout.com/tx/[txHash]",
    contract_url: "https://unichain.blockscout.com/address/[reference]",
  },
  intentGatewayV2: {
    gatewayAddress: "0x2d61624A17f361020679FaA16fbB566C344AaF4B",
  },
}
