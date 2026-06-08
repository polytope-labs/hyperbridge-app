import { Record } from "effect"
import {
  arbitrum,
  arbitrumSepolia,
  base,
  baseSepolia,
  bsc,
  bscTestnet,
  gnosis,
  gnosisChiado,
  mainnet,
  optimism,
  optimismSepolia,
  polygon,
  polygonAmoy,
  sepolia,
  soneium,
} from "viem/chains"
import { logger } from "@/lib"
import type { ChainId, ViemChain } from "@/types"
import {
  Arbitrum,
  ArbitrumSepolia,
  Base,
  BaseSepolia,
  Bsc,
  BscTestnet,
  Chiado,
  Ethereum,
  Gnosis,
  Optimism,
  OptimismSepolia,
  Polygon,
  PolygonAmoy,
  Sepolia,
  Soneium,
} from "./evm-networks"

/**
 * Mapping from NetworkConfig.chainId to viem Chain type
 * This allows us to use the correct viem chain configuration
 * when creating public clients and wallet clients
 */

export const VIEM_CHAIN_MAP: Record<ChainId, ViemChain> = {
  // Mainnet chains
  [Ethereum.chainId]: mainnet,
  [Gnosis.chainId]: gnosis,
  [Bsc.chainId]: bsc,
  [Arbitrum.chainId]: arbitrum,
  [Optimism.chainId]: optimism,
  [Base.chainId]: base,
  [Soneium.chainId]: soneium,
  [Polygon.chainId]: polygon,

  // Testnet chains
  [Sepolia.chainId]: sepolia,
  [ArbitrumSepolia.chainId]: arbitrumSepolia,
  [BaseSepolia.chainId]: baseSepolia,
  [OptimismSepolia.chainId]: optimismSepolia,
  [BscTestnet.chainId]: bscTestnet,
  [Chiado.chainId]: gnosisChiado,
  [PolygonAmoy.chainId]: polygonAmoy,
}

/**
 * Get viem Chain for a given chain ID
 * @param chainId - The chain ID to get the viem Chain for
 */
export function safeViemChain(chainId: ChainId) {
  return Record.get(VIEM_CHAIN_MAP, chainId as string)
}

/**
 * Check if a chain ID has a corresponding viem Chain
 * @param chainId - The chain ID to check
 * @returns True if the chain has a viem Chain, false otherwise
 */
export function hasViemChain(chainId: ChainId): boolean {
  return chainId in VIEM_CHAIN_MAP
}

/**
 * @deprecated Please use safeViemChain instead
 *
 * Get viem Chain for a given chain ID
 * @param chainId - The chain ID to get the viem Chain for
 * @returns The viem Chain or undefined if not found
 */
export function getViemChain(chainId: ChainId): ViemChain | undefined {
  const chain = VIEM_CHAIN_MAP[chainId]

  if (!chain) {
    logger.error(`Viem chain not found for chainId: ${chainId}`)
    return undefined
  }

  return chain
}
