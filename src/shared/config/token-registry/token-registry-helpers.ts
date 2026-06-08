import type { AnyToken, Maybe, TokenSymbol } from "@/types"

export function* getMultichainTokens(params: {
  sourceTokens: AnyToken[]
  destTokens: AnyToken[]
}): Generator<TokenSymbol> {
  const { sourceTokens, destTokens } = params

  const sourceSet = new Set(sourceTokens.map((token) => token.symbol))
  const destSet = new Set(destTokens.map((token) => token.symbol))

  for (const value of sourceSet.intersection(destSet).values()) {
    yield value
  }
}

/**
 * Find a matching token in array of tokens, or if no match found, return first token
 * @param token Current token to find within tokens array
 * @param tokens Array of tokens to search in
 * @returns Token that matches current token's symbol, or first token in array if no match found
 */
export function currentTokenOrFirst(
  token: Maybe<AnyToken>,
  tokens: AnyToken[],
) {
  const [first] = tokens

  if (!token) return first
  if (tokens.length < 2) return first

  const match = tokens.find((e) => e.symbol === token.symbol)

  return match ?? first
}
