import { EvmChain, IntentGateway, IntentsCoprocessor } from "@hyperbridge/sdk"
import { gatewayConfig } from "@/config/services/gateway-config"
import type { ChainId, EVMChainConfig } from "@/types"
import { getNetworkConfig } from "../utils"
import { createEvmChainParams } from "../utils/evm"

export const DEFAULT_INTENT_AUCTION_TIME_MS = 30_000

const intentGatewayV2Cache = new Map<string, IntentGateway>()
let coprocessorInstance: IntentsCoprocessor | null = null

async function getOrCreateCoprocessor(): Promise<IntentsCoprocessor> {
  if (coprocessorInstance) return coprocessorInstance

  const hyperbridgeNet = gatewayConfig.hyperbridgeNet.get()
  const wsUrl = hyperbridgeNet.rpcUrls[0]

  coprocessorInstance = await IntentsCoprocessor.connect(wsUrl)
  return coprocessorInstance
}

/**
 * Creates and caches an IntentGatewayV2 instance for the given chain pair.
 *
 * Uses the coprocessor WS URL from the relay chain config:
 * - Mainnet: Nexus (`wss://hyperbridge-nexus-rpc.blockops.network`)
 * - Testnet: Gargantua (`wss://hyperbridge-paseo-rpc.blockops.network`)
 *
 * Only available for chains where `intentGatewayV2` is configured.
 */
export async function initializeIntentGatewayV2(
  sourceChain: ChainId,
  destChain: ChainId,
): Promise<IntentGateway> {
  const cacheKey = `${sourceChain}-${destChain}`
  const cached = intentGatewayV2Cache.get(cacheKey)
  if (cached) return cached

  const sourceConfig = getNetworkConfig(sourceChain) as EVMChainConfig
  const destConfig = getNetworkConfig(destChain) as EVMChainConfig

  const sourceChainParams = createEvmChainParams(sourceConfig)
  const destChainParams = createEvmChainParams(destConfig)

  const sourceEvmChain = await EvmChain.create(
    sourceChainParams.rpcUrl,
    sourceChainParams.bundlerUrl,
  )
  const destEvmChain = await EvmChain.create(
    destChainParams.rpcUrl,
    destChainParams.bundlerUrl,
  )

  const coprocessor = await getOrCreateCoprocessor()

  const gateway = await IntentGateway.create(
    sourceEvmChain,
    destEvmChain,
    coprocessor,
  )

  intentGatewayV2Cache.set(cacheKey, gateway)
  return gateway
}

export function resetIntentGatewayV2(sourceChain: ChainId, destChain: ChainId) {
  const cacheKey = `${sourceChain}-${destChain}`
  intentGatewayV2Cache.delete(cacheKey)
}
