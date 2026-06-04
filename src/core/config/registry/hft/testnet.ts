import { BscTestnet, PolygonAmoy } from "@hyperbridge-fe/shared/config"
import type { HftTokenDefinition } from "./types"

/**
 * Testnet HyperFungibleToken registry.
 *
 * WBNB pair mirrors the SDK integration tests (BSC Chapel ↔ Polygon Amoy).
 * @see hyperbridge/sdk/packages/sdk/src/tests/sequential/hyperFungibleToken.test.ts
 */
export const TESTNET_HFT_TOKENS: HftTokenDefinition[] = [
  {
    symbol: "WBNB",
    name: "Wrapped BNB",
    decimals: 18,
    defaultRelayerFee: "5",
    defaultTimeout: 7200,
    deployments: [
      {
        chainId: BscTestnet.chainId,
        address: "0x56a77F44a08cf357F59Cc3ae3de7aDfDFaa973d8",
        type: "wrapped-hft",
        underlying: "0xae13d989daC2f0dEBFf460aC112a837c89bA7cd",
      },
      {
        chainId: PolygonAmoy.chainId,
        address: "0xa0D8d6E104b92113c7E2815e970cb5626270E8c1",
        type: "hft",
      },
    ],
  },
]
