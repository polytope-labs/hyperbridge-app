import { pipe } from "effect"
import { NetworkImpl } from "@/factories"
import { normalizeNetworkChainId, safeArray } from "@/lib"
import { O } from "@/lib/utils/fp.helpers"
import type { ChainTokenRegistry, LookupParams, RegistryToken } from "@/types"

export class SourceDestinationIndexer {
  private map = new Map<string, RegistryToken>()

  constructor(registry: ChainTokenRegistry) {
    this.map = new Map(Array.from(this.buildIndex(registry, this.getKey)))
  }

  getKey(params: LookupParams) {
    return `${params.token_symbol}/${params.source}/${params.destination}`
  }

  parseKey(key: string) {
    const [symbol, src, dest] = key.split("/")

    return pipe(
      O.all({
        source: normalizeNetworkChainId(src),
        destination: normalizeNetworkChainId(dest),
      }),
      O.map(({ source, destination }) => {
        return {
          success: true,
          token_symbol: symbol,
          source,
          destination,
        } as const
      }),
      O.getOrElse(() => ({ success: false }) as const),
    )
  }

  /** quickly search for a token */
  lookup(params: LookupParams) {
    return this.map.get(this.getKey(params))
  }

  /**
   * Given a token symbol it finds a source and destination `chain_id`
   * @todo Add a test case for this
   * @param token_symbol
   */
  *find_transfer_pair(token_symbol: string) {
    performance.mark("find_transfer_pair/lookup/started")
    for (const key of this.map.keys()) {
      if (key.includes(token_symbol)) {
        performance.mark("find_transfer_pair/lookup/find-match")
        const data = this.parseKey(key)
        if (!data.success) continue

        yield [data.source, data.destination]
      }
    }
    performance.mark("find_transfer_pair/lookup/end")
  }

  get value() {
    return this.map
  }

  *buildIndex(
    tokenRegistry: ChainTokenRegistry,
    getKey: (params: LookupParams) => string,
  ) {
    for (const source_chain in tokenRegistry) {
      const tokens = safeArray(tokenRegistry[source_chain])

      for (const token of tokens) {
        const recipientNetworks = safeArray(token.recipientNetworks)

        for (const destination of recipientNetworks) {
          // ignore disabled destination networks
          if (!NetworkImpl.is_enabled(destination)) continue

          const key = getKey({
            source: source_chain,
            token_symbol: token.symbol,
            destination: destination.chainId,
          })

          yield [key, token] as const
        }
      }
    }
  }
}
