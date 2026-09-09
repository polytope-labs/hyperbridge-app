import { Bsc, Nexus, Polygon } from "@hyperbridge-fe/shared/config"
import { buildHftRegistry } from "./build-registry"
import { MAINNET_HFT_TOKENS } from "./mainnet"

describe("mainnet HFT registry", () => {
  it.each([Nexus, Bsc, Polygon])(
    "uses the BRIDGE route estimate on $name",
    (network) => {
      const registry = buildHftRegistry(MAINNET_HFT_TOKENS)
      const bridge = registry[network.chainId]?.find(
        (token) => token.symbol === "BRIDGE",
      )

      expect(bridge?.estimatedTransferTime).toBe("5 minutes")
    },
  )
})
