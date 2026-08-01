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
        address: "0x5ae3C15EFa6FC9D226c108bD3c706F2400Ab7311",
        type: "wrapped-hft",
        underlying: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd",
        weth: true,
      },
      {
        chainId: PolygonAmoy.chainId,
        address: "0x1bd0AB7686710a66255d4EFe4826f43CF2A11a1F",
        type: "hft",
      },
    ],
  },
]
