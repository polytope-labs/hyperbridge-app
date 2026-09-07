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
      const recipientChainIds =
        deployment.recipientChainIds ??
        def.deployments
          .filter((candidate) => candidate.chainId !== deployment.chainId)
          .map((candidate) => candidate.chainId)
      const recipientNetworks: Pick<NetworkConfig, "chainId" | "disabled">[] =
        recipientChainIds.map((chainId) => ({
          chainId: chainId as NetworkConfig["chainId"],
        }))

      const common = {
        name: def.name,
        symbol: def.symbol,
        decimals: deployment.decimals ?? def.decimals,
        selfDelivery: def.selfDelivery,
        recipientNetworks,
      }

      const entry: RegistryToken =
        deployment.type === "substrate"
          ? {
              ...common,
              type: "substrate",
              assetId: deployment.assetId,
              balance: deployment.balance,
              existentialDeposit: deployment.existentialDeposit,
              isNative: deployment.isNative,
            }
          : {
              ...common,
              type: "evm",
              address: deployment.address,
              hft: {
                type: deployment.type,
                underlying: deployment.underlying,
                weth: deployment.weth,
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
