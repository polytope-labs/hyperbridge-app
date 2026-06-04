import { Order, pipe } from "effect"
import type { FiatValue } from "@/types"
import { O } from "../utils/fp.helpers"

export const FiatImpl = {
  get empty() {
    return FiatImpl.asDollar(0)
  },

  create(params: { amount: number; currency_symbol: string }): FiatValue {
    console.assert(
      typeof params.amount === "number",
      "[FiatImpl] amount must be a number",
    )
    console.assert(
      params.currency_symbol.length === 3,
      "[FiatImpl] currency symbol must be a 3-letter string",
    )

    return {
      _tag: "fiat",
      amount: params.amount,
      currency_symbol: params.currency_symbol,
    }
  },

  asDollar(amount: number): FiatValue {
    return FiatImpl.create({
      amount,
      currency_symbol: "USD",
    })
  },

  add(a: FiatValue, b: FiatValue): FiatValue {
    return FiatImpl.zip(a, b, (a, b) => a + b, "sum")
  },

  zip(
    a: FiatValue,
    b: FiatValue,
    fn: (a: number, b: number) => number,
    operation = "zip",
  ): FiatValue {
    if (a.currency_symbol !== b.currency_symbol) {
      throw new Error(`Cannot ${operation} values with different currencies`)
    }

    return FiatImpl.create({
      amount: fn(a.amount, b.amount),
      currency_symbol: a.currency_symbol,
    })
  },

  map(f: (amount: number) => number): (value: FiatValue) => FiatValue {
    return (value) =>
      FiatImpl.create({
        amount: f(value.amount),
        currency_symbol: value.currency_symbol,
      })
  },

  get orderByAmount() {
    return Order.mapInput(Order.number, (data: FiatValue) => data.amount)
  },

  fromOption(option: O.Option<FiatValue>): FiatValue {
    return pipe(
      option,
      O.getOrElse(() => FiatImpl.empty),
    )
  },

  pipe: pipe,
}
