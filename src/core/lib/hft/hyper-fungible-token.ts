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

  const sourceConfig = getNetworkConfig(sourceChain)
  const destConfig = getNetworkConfig(destChain)

  if (!sourceConfig || sourceConfig.group !== "evm") {
    throw new Error("HyperFungibleToken requires an EVM source")
  }
  if (!destConfig) throw new Error(`Unknown destination chain ${destChain}`)

  const source = await createEvmChain(sourceConfig)
  const destinationIsEvm = destConfig.group === "evm"
  // SDK 2.8.11 accepts only an EvmChain in this constructor even though its
  // BridgeParams supports 32-byte Substrate recipients. For a non-EVM route,
  // quote() is replaced below, so the constructor's destination is never read.
  const sdkDestination = destinationIsEvm
    ? await createEvmChain(destConfig)
    : source

  const ismpClient = await safeIndexerClient({
    source: sourceChain,
    destination: destChain,
  })

  const hft = new HyperFungibleToken({
    source,
    dest: sdkDestination,
    client: ismpClient,
  })

  // Testnet hosts and non-EVM destinations use the registry relayer fee. The
  // published SDK's automatic quote path currently requires an EVM destination.
  if (gatewayConfig.isTestnet.get() || !destinationIsEvm) {
    hft.quote = quoteWithConfiguredRelayerFee
  }

  hftCache.set(cacheKey, hft)
  return hft
}

export async function quoteWithConfiguredRelayerFee(
  params: BridgeParams,
): Promise<QuoteResult> {
  if (params.relayerFee === undefined) {
    throw new Error("A configured relayer fee is required for this HFT route")
  }

  return {
    totalNativeCost: 0n,
    totalFeeTokenCost: params.relayerFee,
    relayerFeeInFeeToken: params.relayerFee,
  }
}

export function getDestStateMachineId(chainId: ChainId): string {
  const config = getNetworkConfig(chainId)
  if (!config) throw new Error(`Unknown chain ${chainId}`)
  return NetworkImpl.stateMachineId(config)
}
