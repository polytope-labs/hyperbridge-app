import { safeArray } from "@/lib"
import type {
  ChainId,
  ChainTokenRegistry,
  LookupParams,
  RegistryToken,
} from "@/types"

type TokenLookupParams = Omit<LookupParams, "destination">
type StoreKey = `${string}/${ChainId}`

export class TokenNetworkIndexer {
  private readonly map = new Map<StoreKey, RegistryToken>()

  constructor(registry: ChainTokenRegistry) {
    this.map = new Map(Array.from(this.buildIndex(registry, this.getKey)))
  }

  getKey(params: TokenLookupParams) {
    return `${params.token_symbol}/${params.source}` as StoreKey
  }

  /** quickly searches for a token */
  lookup(params: TokenLookupParams) {
    return this.map.get(this.getKey(params))
  }

  get value() {
    return this.map
  }

  *buildIndex(
    tokenRegistry: ChainTokenRegistry,
    getKey: (params: TokenLookupParams) => StoreKey,
  ) {
    for (const source_chain in tokenRegistry) {
      const tokens = safeArray(tokenRegistry[source_chain])
      for (const token of tokens) {
        const key = getKey({
          source: source_chain,
          token_symbol: token.symbol,
        })

        yield [key, token] as const
      }
    }
  }
}
