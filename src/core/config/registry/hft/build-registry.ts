import type {
  ChainId,
  ChainTokenRegistry,
  NetworkConfig,
  RegistryToken,
} from "@/types"
import type { HftTokenDefinition } from "./types"

/**
 * Converts partner-friendly HFT definitions into the ChainTokenRegistry
 * format consumed by TokenRegistry.
 */
export function buildHftRegistry(
  definitions: HftTokenDefinition[],
): ChainTokenRegistry {
  const registry: ChainTokenRegistry = {}

  for (const def of definitions) {
    if (def.disabled) continue

    for (const deployment of def.deployments) {
      const recipientNetworks: Pick<NetworkConfig, "chainId" | "disabled">[] =
        def.deployments
          .filter((d) => d.chainId !== deployment.chainId)
          .map((d) => ({ chainId: d.chainId as NetworkConfig["chainId"] }))

      const entry: RegistryToken = {
        name: def.name,
        symbol: def.symbol,
        decimals: def.decimals,
        address: deployment.address,
        type: "evm",
        recipientNetworks,
        hft: {
          type: deployment.type,
          underlying: deployment.underlying,
          defaultRelayerFee: def.defaultRelayerFee,
          defaultTimeout: def.defaultTimeout,
        },
      }

      const chainTokens = registry[deployment.chainId] ?? []
      chainTokens.push(entry)
      registry[deployment.chainId] = chainTokens
    }
  }

  return registry
}

/** Chain IDs that have at least one HFT token registered */
export function getHftChainIds(registry: ChainTokenRegistry): ChainId[] {
  return Object.keys(registry).map(Number) as ChainId[]
}
