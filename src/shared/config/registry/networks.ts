import * as EVM_NETWORKS from "./evm-networks"
import * as RELAY_NETWORKS from "./relay-networks"
import * as SUBSTRATE_NETWORKS from "./substrate-networks"

export * from "./evm-networks"
export * as EVM_NETWORKS from "./evm-networks"
export * from "./relay-networks"
export * as RELAY_NETWORKS from "./relay-networks"
export * from "./substrate-networks"
export * as SUBSTRATE_NETWORKS from "./substrate-networks"
export * from "./viem-chains"

export const AllNetworks = [
  ...Object.values(EVM_NETWORKS),
  ...Object.values(RELAY_NETWORKS),
  ...Object.values(SUBSTRATE_NETWORKS),
]
