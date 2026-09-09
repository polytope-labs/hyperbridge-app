import { Bsc, Nexus, Polygon } from "@hyperbridge-fe/shared/config"
import type { HftTokenDefinition } from "./types"

const BRIDGE_ASSET_ID =
  "0x08fb31c3e81624356c3314088aa971b73bcc82d22bc3e3b184b4593077ae3278"
const BRIDGE_HFT_ADDRESS = "0x5b0c50fdd52ecc0d4c682c441eabad41ffdeabbb"

/** Mainnet HyperFungibleToken registry. */
export const MAINNET_HFT_TOKENS: HftTokenDefinition[] = [
  {
    symbol: "BRIDGE",
    name: "Hyperbridge",
    decimals: 18,
    estimatedTransferTime: "5 minutes",
    selfDelivery: false,
    defaultRelayerFee: "0",
    defaultTimeout: 7200,
    deployments: [
      {
        chainId: Nexus.chainId,
        type: "substrate",
        assetId: BRIDGE_ASSET_ID,
        decimals: 12,
        isNative: true,
        existentialDeposit: 0.001,
        balance: {
          pallet_prefix: "System",
          pallet_name: "pallet-balances",
        },
        recipientChainIds: [Bsc.chainId, Polygon.chainId],
      },
      {
        chainId: Bsc.chainId,
        type: "hft",
        address: BRIDGE_HFT_ADDRESS,
        recipientChainIds: [Nexus.chainId, Polygon.chainId],
      },
      {
        chainId: Polygon.chainId,
        type: "hft",
        address: BRIDGE_HFT_ADDRESS,
        recipientChainIds: [Nexus.chainId, Bsc.chainId],
      },
    ],
  },
]
