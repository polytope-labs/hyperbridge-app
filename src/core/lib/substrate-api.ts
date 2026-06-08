import { Gargantua, NETWORK_ENV, Nexus } from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import type { NetworkConfig } from "@hyperbridge-fe/shared/types"
import { ApiPromise, WsProvider } from "@polkadot/api"
import { keccakAsU8a } from "@polkadot/util-crypto"
import type { ChainId } from "@/types"
import type { GatewayConfig } from "./gateway-config"
import { rootLogger } from "./logger"

type SubstrateApiType = "rpc" | "websockets"

type SubstrateQueryClient = ApiPromise | HttpRpcClient

export class SubstrateApi {
  apiMap = new Map<ChainId, Promise<ApiPromise>>()
  rpcMap = new Map<ChainId, Promise<HttpRpcClient>>()

  constructor(private gatewayConfig: GatewayConfig) {}

  get hyperbridge() {
    return this.get(this.gatewayConfig.hyperbridgeNet.get().chainId)
  }

  get relay() {
    return this.get(this.gatewayConfig.relayNetwork.get().chainId)
  }

  get assetHub() {
    return this.get(this.gatewayConfig.assetHub.get().chainId)
  }

  /**
   * @todo Remove and move chain specs to Nexus and Gargantua config
   * @returns
   */
  private configureHyperbridge(
    type: SubstrateApiType,
  ): Promise<SubstrateQueryClient> {
    const rpcProvider = new HttpRpcClient(
      NetworkImpl.rpcUrl(this.gatewayConfig.hyperbridgeNet.get(), "https"),
    )

    const apiPromise = new WsProvider(
      NetworkImpl.rpcUrl(this.gatewayConfig.hyperbridgeNet.get(), "ws"),
    )

    if (NETWORK_ENV === "testnet") {
      if (type === "rpc") return Promise.resolve(rpcProvider)

      return ApiPromise.create({
        provider: apiPromise,
        typesBundle: {
          spec: {
            gargantua: {
              hasher: keccakAsU8a,
            },
          },
        },
      })
    }

    if (NETWORK_ENV === "mainnet") {
      if (type === "rpc") return Promise.resolve(rpcProvider)

      return ApiPromise.create({
        provider: apiPromise,
        typesBundle: {
          spec: {
            nexus: {
              hasher: keccakAsU8a,
            },
          },
        },
      })
    }

    throw new Error(
      "Unsupported Network environment. Expecting testnet or mainnet",
    )
  }

  hasInstance(chainId: ChainId, type: SubstrateApiType) {
    if (type === "rpc") {
      return this.rpcMap.has(chainId)
    }

    if (type === "websockets") {
      return this.apiMap.has(chainId)
    }

    return false
  }

  getInstance<TTProtocol extends SubstrateApiType>(
    chainId: ChainId,
    type: TTProtocol,
  ): Promise<SubstrateQueryClient> | undefined {
    if (type === "rpc") return this.rpcMap.get(chainId)

    if (type === "websockets") return this.apiMap.get(chainId)

    return undefined
  }

  setInstance<TProviderType extends SubstrateApiType>(
    chainId: ChainId,
    type: TProviderType,
    api: Promise<
      TProviderType extends "websockets" ? ApiPromise : HttpRpcClient
    >,
  ): void {
    if (!this.isValidType(type))
      throw new Error("Invalid provider type when caching instance")

    if (type === "rpc") this.rpcMap.set(chainId, api as Promise<HttpRpcClient>)

    if (type === "websockets")
      this.apiMap.set(chainId, api as Promise<ApiPromise>)
  }

  isValidType(type: SubstrateApiType): boolean {
    return ["rpc", "websockets"].includes(type)
  }

  async prepare(network: NetworkConfig, type: SubstrateApiType) {
    if (!this.isValidType(type)) {
      throw new Error(
        `Invalid provider type when preparing instance. Network(${network.name})`,
      )
    }

    if (
      !(
        network.group === "relay" ||
        network.group === "substrate" ||
        network.group === "assetHub"
      )
    ) {
      throw new Error("Invalid network group")
    }

    if (this.hasInstance(network.chainId, type)) {
      rootLogger.debug(
        `SubstrateApiStore: reading Network(${network.name}) ChainId(${network.chainId}) from cache`,
      )

      return this.getInstance(network.chainId, type)
    }

    rootLogger.debug(
      `SubstrateApiStore: Preparing ApiPromise for Network(${network.name}) ChainId(${network.chainId})`,
    )

    const instance =
      type === "rpc"
        ? Promise.resolve(
            new HttpRpcClient(NetworkImpl.rpcUrl(network, "https")),
          )
        : ApiPromise.create({
            provider: new WsProvider(NetworkImpl.rpcUrl(network, "ws")),
          })

    // Initialize the API instance for the given network
    const api =
      network.chainId === Nexus.chainId || network.chainId === Gargantua.chainId
        ? this.configureHyperbridge(type)
        : instance

    rootLogger.debug(
      `SubstrateApiStore: Prepared Network(${network.name}) ChainId(${network.chainId})`,
    )

    this.setInstance(network.chainId, type, api)

    return await api
  }

  hyperbridgeNetworks = {
    [Nexus.chainId]: Nexus,
    [Gargantua.chainId]: Gargantua,
  }

  async getHttp(chainId: ChainId) {
    const match = await this.getInstance(chainId as string, "rpc")

    if (match instanceof ApiPromise) {
      console.trace(chainId)
      throw new Error(
        `Expecting HttpRpcClient but got ApiPromise for (${chainId})`,
      )
    }

    if (!match) {
      const network =
        this.gatewayConfig.getNetwork(chainId) ??
        this.hyperbridgeNetworks[chainId as number]

      if (!network) {
        throw new Error(`SubstrateApi: Network not found Chain(${chainId})`)
      }

      const value = await this.prepare(network, "rpc")
        .then((a) => a as HttpRpcClient)
        .catch((err) => {
          throw new Error(
            `SubstrateRpc not initialized for network ${chainId}`,
            { cause: err },
          )
        })

      return value
    }

    return match as HttpRpcClient
  }

  async get(chainId: ChainId) {
    const match = await this.getInstance(chainId as string, "websockets")

    if (match instanceof HttpRpcClient) {
      console.trace(chainId)
      throw new Error(
        `Expecting ApiPromise but got HttpRpcClient for (${chainId})`,
      )
    }

    if (!match) {
      const network =
        this.gatewayConfig.getNetwork(chainId) ??
        this.hyperbridgeNetworks[chainId as number]

      if (!network) {
        throw new Error(`SubstrateApi: Network not found Chain(${chainId})`)
      }

      const value = await this.prepare(network, "websockets")
        .then((a) => a as ApiPromise)
        .catch((err) => {
          throw new Error(
            `SubstrateApi not initialized for network ${chainId}`,
            { cause: err },
          )
        })

      return value
    }

    return match
  }
}

export class HttpRpcClient {
  constructor(private readonly url: string) {}

  /**
   * Make an RPC call over HTTP
   * @param method - The RPC method name
   * @param params - The parameters for the RPC call
   * @returns Promise resolving to the RPC response
   */
  async call<const T extends Array<unknown>>(
    method: string,
    params: T,
  ): Promise<unknown> {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method,
      params: params,
    })

    const response = await fetch(this.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body,
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result = await response.json()

    if (result.error) {
      throw new Error(`RPC error: ${result.error.message}`)
    }

    return result.result
  }
}
