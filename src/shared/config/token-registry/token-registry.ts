import { TokenImpl } from "@/factories"
import { chainEq, isNil, resolveNetworkGroup, safeArray } from "@/lib"
import type {
  AnyToken,
  ChainId,
  ChainTokenRegistry,
  Maybe,
  TokenSymbol,
} from "@/types"
import { SourceDestinationIndexer } from "./source-destination-registry"
import { TokenNetworkIndexer } from "./token-network-indexer"

export class TokenRegistry {
  private readonly tokenNetworkIndexer: TokenNetworkIndexer
  readonly transferIndexer: SourceDestinationIndexer
  private readonly registry: ChainTokenRegistry

  constructor(registry: ChainTokenRegistry) {
    this.registry = registry
    this.tokenNetworkIndexer = new TokenNetworkIndexer(registry)
    this.transferIndexer = new SourceDestinationIndexer(registry)
  }

  isEmpty() {
    return this.tokenNetworkIndexer.value.size === 0
  }

  /** Chain IDs with at least one registered token */
  getRegisteredChainIds(): ChainId[] {
    return Object.keys(this.registry).map(Number) as ChainId[]
  }

  getNativeToken(chainId: ChainId): Maybe<AnyToken> {
    const tokens = Iterator.from(this.registry[chainId])

    for (const token of tokens) {
      if (token.isNative) return TokenImpl.create(token)
    }

    return null
  }

  /**
   * Gets all token definitions from registry by chain ID
   * @returns array of tokens as TokenImpl instances
   */
  getByChain(chainId: ChainId): AnyToken[] {
    return safeArray(this.registry[chainId]).map((e) => TokenImpl.create(e))
  }

  /** Gets a token by a given chain ID and token symbol
   * @param chain ID of chain in which token lives
   * @param symbol token symbol to search
   * @returns TokenImpl instance if token exists, undefined otherwise */
  getBySymbol(chain: ChainId, symbol: TokenSymbol): Maybe<AnyToken> {
    const value = this.tokenNetworkIndexer.lookup({
      token_symbol: symbol,
      source: chain,
    })

    if (!value) return undefined

    return TokenImpl.create(value)
  }

  /**
   * @todo Add test case
   * @param params
   */
  *find_transferable_token(params: {
    source: ChainId
    destination: ChainId
  }): Generator<AnyToken> {
    for (const [key, token] of this.transferIndexer.value) {
      const result = this.transferIndexer.parseKey(key)

      // ignore if parsing fails
      if (!result.success) continue

      // ignore disabled tokens
      if (token.disabled) continue

      // ignore tokens without a recipient network
      if (token.recipientNetworks.length === 0) continue

      const is_match =
        chainEq(result.source, params.source) &&
        chainEq(result.destination, params.destination)

      if (!is_match) continue

      yield TokenImpl.create(token)
    }
  }

  /**
   * @todo Add test case
   * @param params
   */
  *find_initial_pair(params: { source: ChainId }): Generator<{
    source: ChainId
    destination: ChainId
    token: AnyToken
  }> {
    for (const [key, token] of this.transferIndexer.value) {
      const result = this.transferIndexer.parseKey(key)

      // ignore if parsing fails
      if (!result.success) continue

      // ignore disabled tokens
      if (token.disabled) continue

      // ignore tokens without a recipient network
      if (token.recipientNetworks.length === 0) continue

      const is_match = chainEq(result.source, params.source)

      if (!is_match) continue

      yield {
        source: result.source,
        destination: result.destination,
        token: TokenImpl.create(token),
      }
    }
  }

  *uniqueTokens(): Generator<AnyToken> {
    const processed = new Set<string>()
    for (const [, token] of this.tokenNetworkIndexer.value) {
      // ignore disabled tokens
      if (token.disabled) continue

      // ignore tokens without a recipient network
      if (token.recipientNetworks.length === 0) continue

      // ignore registered tokens
      if (processed.has(token.symbol)) continue
      processed.add(token.symbol)
      yield TokenImpl.create(token)
    }
  }

  *allTokens(): Generator<[ChainId, AnyToken]> {
    const tokens = this.tokenNetworkIndexer.value

    for (const [key, token] of tokens) {
      const [, chainId] = key.split("/")

      yield [chainId, TokenImpl.create(token)]
    }
  }

  chainHasToken(chain: ChainId, symbol: TokenSymbol): boolean {
    return Boolean(this.getBySymbol(chain, symbol))
  }

  /**
   * Quick lookup for token symbol can be sent from source -> destination
   *
   * @param params
   * @returns
   */
  isTransferable(
    params:
      | {
          /**
           * @description Searches by symbol
           */
          strict: false
          source: ChainId
          destination: ChainId
          token_symbol: string
        }
      | {
          /**
           * @description Search by token and ensures the token can be sent from source chain
           */
          strict: true
          source: ChainId
          destination: ChainId
          token: AnyToken
        },
  ) {
    if (!params.strict) {
      return Boolean(
        this.transferIndexer.lookup({
          source: params.source,
          destination: params.destination,
          token_symbol: params.token_symbol,
        }),
      )
    }

    const match = this.transferIndexer.lookup({
      source: params.source,
      destination: params.destination,
      token_symbol: params.token.symbol,
    })

    if (isNil(match)) return false

    const tag = resolveNetworkGroup(params.source)

    return tag === TokenImpl.type(params.token)
  }
}
