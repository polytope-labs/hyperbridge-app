import {
  type ClientConfig,
  createEvmChain,
  createQueryClient,
  type HexString,
  type IChain,
  IsmpClient,
  type IndexerQueryClient,
  SubstrateChain,
} from "@hyperbridge/sdk"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import type { ChainId, NetworkConfig } from "@hyperbridge-fe/shared/types"
import { Effect, Schedule } from "effect"
import { memoize } from "lodash-es"
import { INDEXER_URL, NETWORK_ENV } from "@/config/constants"
import { gatewayConfig } from "@/config/services/gateway-config"
import { getNetworkConfig, safeNetworkConfig } from "@/lib/utils"
import { rootLogger } from "./logger"
import { O, pipe } from "./utils/fp.helpers"

export const IndexerQuery = {
  make({ url }: { url: string }) {
    const indexer_query_client = createQueryClient({ url })

    return (): IndexerQueryClient => {
      return indexer_query_client
    }
  },

  get singleton() {
    return this.make({
      url: INDEXER_URL[NETWORK_ENV],
    })
  },
}

const initHyperbridgeIndexer = (params: {
  sourceChain: IChain
  destChain: IChain
  hyperbridge: IChain
  queryClient: IndexerQueryClient
  env: "mainnet" | "testnet"
}) => {
  const index_config: ClientConfig = {
    queryClient: params.queryClient,
    source: params.sourceChain,
    dest: params.destChain,
    hyperbridge: params.hyperbridge,
    // tracing: isAppStaging || isDevelopment,
    tracing: true,
    pollInterval: 5000,
  }

  rootLogger.log("Indexer Config", index_config)

  return new IsmpClient(index_config)
}

async function createNetworkChain(network: NetworkConfig): Promise<IChain> {
  if (network.group === "evm") {
    return createEvmChain(network.chainId, NetworkImpl.host_addr(network), {
      rpcUrl: network.rpcUrls[0],
      consensusStateId: NetworkImpl.consensuseStateId(network),
    })
  }

  if (network.group === "substrate") {
    return await SubstrateChain.connect({
      consensusStateId: NetworkImpl.consensuseStateId(network),
      stateMachineId: NetworkImpl.stateMachineId(network),
      wsUrl: network.rpcUrls[0],
      hasher: "Blake2",
    })
  }

  if (network.group === "relay") {
    return await SubstrateChain.connect({
      consensusStateId: NetworkImpl.consensuseStateId(network),
      stateMachineId: NetworkImpl.stateMachineId(network),
      wsUrl: network.rpcUrls[0],
      hasher: "Keccak",
    })
  }

  throw new Error(`Unsupported network group: ${network.group}`)
}

export const safeIndexerClient = memoize(
  async function safeIndexerClient(params: {
    source: ChainId
    destination: ChainId
  }) {
    const sourceConfig = getNetworkConfig(params.source)
    const destConfig = getNetworkConfig(params.destination)
    const hyperbridgeConfig = gatewayConfig.hyperbridgeNet.get()

    if (!sourceConfig || !destConfig) {
      throw new Error("Source/Destination missing")
    }

    const sourceChain = await createNetworkChain(sourceConfig)
    const destChain = await createNetworkChain(destConfig)
    const hyperbridgeChain = await createNetworkChain(hyperbridgeConfig)

    return pipe(
      O.all([
        safeNetworkConfig(params.source),
        safeNetworkConfig(params.destination),
      ]),
      O.map((_) => {
        return initHyperbridgeIndexer({
          sourceChain,
          destChain,
          hyperbridge: hyperbridgeChain,
          queryClient: IndexerQuery.singleton(),
          env: NETWORK_ENV,
        })
      }),
      O.getOrThrowWith(() => new Error("Source/Destination missing")),
    )
  },
  (params) => `${params.source}-${params.destination}`,
)

export async function fetchIPostRequestByCommitmentHash(params: {
  commitment_hash: HexString
  client: IsmpClient
}) {
  const fetchIPostRequest = pipe(
    Effect.tryPromise(() => {
      return params.client.queryPostRequest(params.commitment_hash)
    }),
    Effect.flatMap((e) => O.fromNullable(e)),
  )

  return await pipe(
    Effect.retry(fetchIPostRequest, Schedule.exponential("10 seconds")),
    Effect.runPromise,
  )
}
