import {
  EvmChain,
  HyperFungibleToken,
  type BridgeParams,
  type QuoteResult,
} from "@hyperbridge/sdk"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import type { ChainId, EVMChainConfig, EVMToken } from "@/types"
import { gatewayConfig } from "@/config/services/gateway-config"
import { safeIndexerClient } from "@/lib/hyperbridge-indexer"
import { getNetworkConfig } from "@/lib/utils"
import { createEvmChainParams } from "@/lib/utils/evm"
import { parseEther } from "viem"

const hftCache = new Map<string, HyperFungibleToken>()

export function isHftToken(token: { hft?: unknown }): token is EVMToken {
  return token.hft != null
}

export function getHftRelayerFee(token: EVMToken): bigint {
  const fee = token.hft?.defaultRelayerFee ?? "5"
  return parseEther(fee)
}

export function getHftTimeout(token: EVMToken): bigint {
  return BigInt(token.hft?.defaultTimeout ?? 7200)
}

async function createEvmChain(config: EVMChainConfig) {
  const params = createEvmChainParams(config)
  return EvmChain.create(params.rpcUrl, params.bundlerUrl)
}

/**
 * Creates and caches a HyperFungibleToken SDK instance for a chain pair.
 * Attaches IsmpClient for post-submit status tracking.
 */
export async function getHyperFungibleToken(
  sourceChain: ChainId,
  destChain: ChainId,
): Promise<HyperFungibleToken> {
  const cacheKey = `${sourceChain}-${destChain}`
  const cached = hftCache.get(cacheKey)
  if (cached) return cached

  const sourceConfig = getNetworkConfig(sourceChain) as EVMChainConfig
  const destConfig = getNetworkConfig(destChain) as EVMChainConfig

  const source = await createEvmChain(sourceConfig)
  const dest = await createEvmChain(destConfig)

  const ismpClient = await safeIndexerClient({
    source: sourceChain,
    destination: destChain,
  })

  const hft = new HyperFungibleToken({ source, dest, client: ismpClient })

  // Testnet hosts use the registry relayer fee.
  if (gatewayConfig.isTestnet.get()) {
    hft.quote = async (p: BridgeParams): Promise<QuoteResult> => ({
      totalNativeCost: 0n,
      totalFeeTokenCost: p.relayerFee ?? 0n,
      relayerFeeInFeeToken: p.relayerFee ?? 0n,
    })
  }

  hftCache.set(cacheKey, hft)
  return hft
}

export function getDestStateMachineId(chainId: ChainId): string {
  const config = getNetworkConfig(chainId)
  if (!config) throw new Error(`Unknown chain ${chainId}`)
  return NetworkImpl.stateMachineId(config)
}
