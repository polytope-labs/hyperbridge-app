import { AllNetworks, Gargantua, Nexus } from "@hyperbridge-fe/shared/config"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { safeArray } from "@/lib/data.helpers"

export const ALL_NETWORKS = AllNetworks.filter((network) => {
  // @ts-expect-error  Exclude Gargantua and Nexus networks
  return ![Gargantua.chainId, Nexus.chainId].includes(network.chainId)
})
  .toSorted(NetworkImpl.sort_alphabetically)
  .toSorted(NetworkImpl.sort_move_disabled_to_end)

export const BRIDGE_NETWORKS = ALL_NETWORKS.filter((network) => {
  const features = new Set(safeArray(network.featureSupported))

  if (features.size === 0) return true

  return features.has("bridge")
})
