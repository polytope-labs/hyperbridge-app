import { INDEXER_URL, NETWORK_ENV } from "@hyperbridge-fe/shared/constants"
import { Effect } from "effect"
import type { AppBalance, FiatValue } from "@/types"
import { safeObj } from "./data.helpers"
import { BalanceImpl } from "./factories/balance"
import { FiatImpl } from "./factories/fiat"

export class TokenPriceManager {
  store = new Map<string, FiatValue>()

  /**
   * @description Gets the USD rate of a token
   * @alias getTokenPrice
   * @returns
   */
  async get(
    symbol: string,
    config?: {
      /** Whether to fetch fresh data. Defaults to 'false' */
      fresh?: boolean
      signal?: AbortSignal
    },
  ) {
    const { fresh = false, signal } = safeObj(config)

    const existing_value = fresh ? null : this.store.get(symbol)

    if (existing_value) {
      return existing_value
    }

    return this.fetchUSD(symbol, signal).then((price) => {
      this.store.set(symbol, price)

      return price
    })
  }

  private async fetchUSD(
    symbol: string,
    signal?: AbortSignal,
  ): Promise<FiatValue> {
    const GET_PRICES_QUERY = `
      query GetTokenPrices($id: String!) {
        tokenPrice(id: $id) {
          currency
          price
          symbol
        }
      }
    `

    const params = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: GET_PRICES_QUERY,
        variables: { id: symbol },
      }),
      signal,
    } as const

    const price_payload = await fetch(INDEXER_URL[NETWORK_ENV], params)
      .then((res) => res.json())
      .catch((err) => {
        throw new Error(`Failed to fetch price for ${symbol}`, { cause: err })
      })

    const price = Number(price_payload.data?.tokenPrice?.price)

    if (Number.isNaN(price)) {
      throw new Error(`Invalid price for ${symbol}`)
    }

    return FiatImpl.create({
      amount: price,
      currency_symbol: price_payload.data.tokenPrice.currency,
    })
  }

  async dollarToBalance(
    fiat: FiatValue,
    token: AppBalance,
  ): Promise<AppBalance> {
    const rate = await this.get(token.symbol)

    // convert to fiat
    const usdBalance = FiatImpl.zip(
      fiat,
      rate,
      (fiatAmount, valueAmount) => fiatAmount / valueAmount,
    )

    return BalanceImpl.parse(
      usdBalance.amount.toString(),
      token.decimals,
      token.symbol,
    )
  }

  getSafe(
    symbol: string,
    config?: {
      fresh?: boolean
    },
  ) {
    return Effect.tryPromise({
      try: (signal) => {
        return this.get(symbol, { ...config, signal })
      },
      catch: (err) =>
        new Error(`Error fetching USD rate for ${symbol}`, {
          cause: err,
        }),
    })
  }
}
