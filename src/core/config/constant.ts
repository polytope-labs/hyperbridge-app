import { Ethereum, Polkadot } from "@hyperbridge-fe/shared"
import type { NetworkConfigWithDescription } from "@/types/network-types"

export const NETWORKS: NetworkConfigWithDescription[] = [
  {
    ...Polkadot,
    description: "Use Polkadot-compatible wallets",
  },
  {
    ...Ethereum,
    description: "Use EVM-compatible wallets",
  },
]
