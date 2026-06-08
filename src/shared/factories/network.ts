import type { HexString } from "@hyperbridge/sdk"
import { z } from "zod"
import { DEFAULT_HASH } from "@hyperbridge-fe/shared/constants"
import { safeObj, safeStr } from "@/lib/data.helpers"
import { O, pipe } from "@/lib/utils/fp.helpers"
import {
  isEVMChain,
  isNil,
  resolveNetworkGroup,
  safeRpcURL,
} from "@/lib/utils/helpers"
import type {
  AssetHubChainConfig,
  EVMChainConfig,
  Maybe,
  NetworkConfig,
  RelayChainConfig,
  RpcUrl,
  StateMachineId,
  SubstrateChainConfig,
} from "@/types"

export const NetworkImpl = {
  isHyperbridgeNetwork(config: NetworkConfig) {
    return ["POLKADOT-3367", "KUSAMA-4009"].some(
      (e) => e === NetworkImpl.stateMachineId(config),
    )
  },

  is_enabled(network: Pick<NetworkConfig, "disabled">) {
    const { disabled = false } = safeObj(network)

    return !disabled
  },

  sort_move_disabled_to_end(curr: NetworkConfig, next: NetworkConfig) {
    const is_enabled = NetworkImpl.is_enabled

    if (!is_enabled(curr) && is_enabled(next)) {
      return 1
    }

    if (is_enabled(curr) && !is_enabled(next)) {
      return -1
    }

    return 0
  },

  sort_alphabetically(a: NetworkConfig, b: NetworkConfig) {
    return a.name.localeCompare(b.name)
  },

  host_addr(network: NetworkConfig): HexString {
    if (network.group !== "evm") {
      throw new Error(
        `Network(${network.name}) doesn't need an ISMP Host address`,
      )
    }

    return network.ismpHost
  },

  stateMachineId(network: NetworkConfig): StateMachineId {
    if (network.group === "assetHub")
      throw new Error("AssetHub network doesn't have a StateMachineId")

    if (this.isEVM(network) || this.isRelay(network)) {
      return network.stateMachineId
    }

    return network.chainId as StateMachineId
  },

  rpcUrl(network: NetworkConfig, format: "ws" | "https" = "ws"): RpcUrl {
    return safeRpcURL(format, network.rpcUrls[0]) as RpcUrl
  },

  consensuseStateId(network: NetworkConfig) {
    if (network.group === "assetHub") {
      throw new Error(`${network.name} does not have a Consensus`)
    }

    return network.consensus.stateId
  },

  isRelay(network: Maybe<NetworkConfig>): network is RelayChainConfig {
    return network?.group === "relay"
  },

  isEVM(network: Maybe<NetworkConfig>): network is EVMChainConfig {
    return network?.group === "evm" && isEVMChain(network.chainId)
  },

  validateSourceDest<
    TSource extends NetworkConfig,
    TDest extends NetworkConfig,
  >(networks: { source: Maybe<TSource>; dest: Maybe<TDest> }) {
    const { source, dest } = networks

    if (!(source && dest)) {
      return {
        success: false as const,
        error: "Source/Destination chain doesn't exist",
      }
    }

    if (source.networkType !== dest.networkType) {
      return {
        success: false as const,
        error:
          "Both source and destination should on the same NetworkEnvironment(testnet|mainnet)",
      }
    }

    return {
      success: true as const,
      data: { source, dest },
    }
  },

  /**
   * Test all networks
   * @param network
   * @param txHash
   * @returns
   */
  getTransactionUrl(network: NetworkConfig, txHash: string) {
    return pipe(
      O.firstSomeOf([
        O.fromNullable(network?.explorer?.transaction_url),
        O.fromNullable(network?.transaction?.url),
      ]),
      O.map((tx_url) => safeStr(tx_url).replace("[txHash]", txHash)),
      O.getOrUndefined,
    )
  },

  addressUrl(network: NetworkConfig, address: string) {
    return safeStr(network?.explorer?.contract_url).replace(
      "[reference]",
      address,
    )
  },

  safeTxUrl(network: NetworkConfig, txHash: string): O.Option<string> {
    if (!txHash) return O.none()
    if (txHash === DEFAULT_HASH) return O.none()

    const isValidUrl = (url: string) => z.string().url().safeParse(url).success

    return pipe(
      O.firstSomeOf([
        O.fromNullable(network?.explorer?.transaction_url),
        O.fromNullable(network?.transaction?.url),
      ]),
      O.map((url) => url.replace("[txHash]", txHash)),
      O.tap((url) => (isValidUrl(url) ? O.some(undefined) : O.none())),
    )
  },

  group(network: NetworkConfig) {
    return resolveNetworkGroup(network.chainId)
  },

  /**
   * Match networks config by Reference.
   * Alternatively use matchChain() for just chainId matching
   */
  match<TReturnValue>(
    network: Maybe<NetworkConfig>,
    matchers: {
      evm?: (value: EVMChainConfig) => TReturnValue
      substrate?: (value: SubstrateChainConfig) => TReturnValue
      relay?: (value: RelayChainConfig) => TReturnValue
      assetHub?: (value: AssetHubChainConfig) => TReturnValue
      _: (value: Maybe<NetworkConfig>) => TReturnValue
    },
  ): TReturnValue {
    if (isNil(network)) return matchers._(network)

    const group = safeObj(network).group
    const handler = matchers[group]

    if (typeof handler === "function") {
      // @ts-expect-error  I know what I'm doing
      return handler(network)
    }

    return matchers._(network)
  },
}
