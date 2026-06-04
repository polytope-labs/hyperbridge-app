import type { ChainId } from "@hyperbridge-fe/shared"
import { tokenImages as tokenImagesData } from "@hyperbridge-fe/shared"
import {
  Arbitrum,
  ArbitrumSepolia,
  ArgonNetwork,
  Base,
  BaseSepolia,
  Bifrost,
  BifrostTestnet,
  Bsc,
  BscTestnet,
  Cere,
  Chiado,
  Ethereum,
  Gargantua,
  Gnosis,
  Nexus,
  Optimism,
  OptimismSepolia,
  Polygon,
  PolygonAmoy,
  Sepolia,
  Soneium,
} from "@hyperbridge-fe/shared/config"
import { toHex } from "viem"
import { SubstrateApiStore } from "@/config/services/substrate-api.ts"
import { rootLogger } from "./logger"

interface TokenInfo {
  normalizedName: string
  imageUrl: string
}

const tokenImages = tokenImagesData as Record<string, string>

const UNKNOWN_TOKEN_INFO: TokenInfo = {
  normalizedName: "UNKNOWN",
  imageUrl: tokenImages.UNKNOWN,
}

const nameNormalizationMap: Record<string, string> = {
  // USDC variations
  USDC: "USDC",
  "USD COIN": "USDC",

  // ETH variations
  ETH: "ETH",
  ETHEREUM: "ETH",

  // USDT variations
  USDT: "USDT",
  "USDT.": "USDT",
  "TETHER USD": "USDT",

  // BUSD variations
  "BINANCE-PEG BSC-USD": "BUSD",
  BUSD: "BUSD",

  // DOT variations
  DOT: "DOT",
  POLKADOT: "DOT",

  // DAI variations
  DAI: "DAI",
  "BINANCE-PEG DAI TOKEN": "DAI",
  "TETHER USD ON XDAI": "DAI",

  CERE: "CERE",
  USDH: "USDH",
  NTZS: "NTZS",
  WXDAI: "WXDAI",
  BRIDGE: "BRIDGE",
  ARGN: "ARGN",
  ARGNOT: "ARGNOT",
  BNC: "BNC",
  GLMR: "GLMR",
  ASTR: "ASTR",
  VDOT: "vDOT",
  VGLMR: "vGLMR",
  VASTR: "vASTR",
  VBNC: "vBNC",
}

/**
 * Gets the normalized name and image URL for a given token name/symbol.
 * Performs case-insensitive matching based on predefined variations.
 * Returns details for "UNKNOWN" token if no match is found.
 *
 * @param tokenName The input token name or symbol (e.g., "Usd Coin", "ETH", "Tether USD").
 * @returns An object with normalizedName and imageUrl. Returns UNKNOWN token info if no match.
 */
export function getTokenInfo(tokenName: string | null | undefined): TokenInfo {
  if (!tokenName || typeof tokenName !== "string" || tokenName.trim() === "") {
    return UNKNOWN_TOKEN_INFO
  }

  const upperTokenName = tokenName.trim().toUpperCase()
  const is_token_image_indexed = upperTokenName in tokenImages

  console.assert(
    is_token_image_indexed,
    `Token Image is missing for (${upperTokenName})`,
  )

  const normalizedName = !is_token_image_indexed
    ? nameNormalizationMap[upperTokenName]
    : upperTokenName

  if (!normalizedName) {
    return UNKNOWN_TOKEN_INFO
  }

  const imageUrl = tokenImages[normalizedName]

  if (!imageUrl) {
    return UNKNOWN_TOKEN_INFO
  }

  return {
    normalizedName,
    imageUrl,
  }
}

/**
 *
 * @param chain
 * @returns block time in seconds for the chain provided
 */
export const getBlockTimeEstimate = (chain: ChainId | undefined) => {
  switch (chain) {
    case Optimism.chainId:
    case OptimismSepolia.chainId:
    case Base.chainId:
    case BaseSepolia.chainId:
    case Polygon.chainId:
    case PolygonAmoy.chainId:
    case Soneium.chainId: {
      return 2
    }
    case Arbitrum.chainId:
    case ArbitrumSepolia.chainId: {
      return 0.25
    }
    case Ethereum.chainId:
    case Sepolia.chainId: {
      return 12
    }
    case Bsc.chainId: {
      return 1.5
    }
    case BscTestnet.chainId: {
      return 0.75
    }

    case Gnosis.chainId:
    case Chiado.chainId: {
      return 5
    }

    case Bifrost.chainId:
    case BifrostTestnet.chainId: {
      return 6
    }

    case Cere.chainId: {
      return 6
    }

    case ArgonNetwork.chainId: {
      return 60
    }

    case Nexus.chainId:
    case Gargantua.chainId: {
      return 12
    }
  }

  return 0
}

export async function getChainLatestStateMachineHeight(params: {
  chainId: number
  consensusStateId: string
}): Promise<bigint> {
  const { chainId, consensusStateId } = params

  try {
    const api = await SubstrateApiStore.hyperbridge

    const latestHeight = await api.query.ismp.latestStateMachineHeight({
      stateId: {
        Evm: chainId,
      },
      consensusStateId: toHex(consensusStateId),
    })

    rootLogger.info(
      `Latest state machine height for chain ${chainId}: ${String(latestHeight)}`,
    )

    return BigInt(String(latestHeight))
  } catch (error) {
    rootLogger.error("Error getting Hyperbridge state machine height:", error)
    throw new Error(
      `Failed to get state machine height for chain ${chainId}: ${error}`,
    )
  }
}
