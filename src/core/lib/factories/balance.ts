import { safeBigInt, safeObj } from "@hyperbridge-fe/shared"
import { Either, Hash, Order, pipe } from "effect"
import * as EBigInt from "effect/BigInt"
import { clamp, parse, sign } from "effect/Number"
import { formatUnits, parseUnits } from "viem/utils"
import type { AppBalance } from "@/types"
import { rootLogger } from "../logger"
import { shortTokenValueFormatter } from "../utils/formatting"
import { O } from "../utils/fp.helpers"
import { FiatImpl } from "./fiat"

const logger = rootLogger.withTag("BalanceImpl")

const empty_value: AppBalance = {
  _tag: "app-balance",
  value: 0n,
  decimals: 0,
  symbol: "--",
}

export const BalanceImpl = {
  empty(): AppBalance {
    return empty_value
  },

  isEmpty(balance: AppBalance): boolean {
    return Hash.structure(balance) === Hash.structure(empty_value)
  },

  isNone(balance: AppBalance): boolean {
    return !(BalanceImpl.is(balance) && !BalanceImpl.isEmpty(balance))
  },

  is(balance: unknown): balance is AppBalance {
    const a = safeObj(balance)

    return a._tag === "app-balance"
  },

  create(
    value: AppBalance["value"],
    decimals: AppBalance["decimals"],
    symbol: AppBalance["symbol"],
  ): AppBalance {
    return Object.freeze({
      _tag: "app-balance",
      value: EBigInt.max(0n, value),
      decimals,
      symbol,
    })
  },

  /**
   * @description Parses a string amount into a BalanceImpl object.
   * @param amount
   * @param decimals
   * @param symbol
   * @returns
   */
  parse(amount: string, decimals: number, symbol: string) {
    const stripCommas = (amount: string) => amount.replaceAll(",", "")

    const mustHaveNoApprox = (amount: string) => {
      if (/e(-|\+)/.test(amount.toString())) {
        logger.error(
          "No exponential value allowed. Please provide a valid float value. Got:",
          amount,
        )

        return O.none()
      }

      return O.some(amount)
    }

    const mustBePositive = (amount: number) => {
      if (Number.isNaN(amount)) return O.none()

      if (sign(amount) === -1) {
        return O.none()
      }

      const safe_amount = clamp({
        minimum: 0,
        maximum: Number.POSITIVE_INFINITY,
      })

      return O.some(safe_amount(amount))
    }

    return pipe(
      O.some(amount),
      O.map(stripCommas),
      O.flatMap((e) => mustHaveNoApprox(e)),
      O.flatMap((v) => parse(v)),
      O.flatMap(mustBePositive),
      O.map((e) => parseUnits(e.toString(), decimals)),
      O.map((e) => BalanceImpl.create(e, decimals, symbol)),
      O.getOrThrowWith(
        () =>
          new Error(
            `Invalid amount provided. Expecting a positive \`number\` got ${amount}`,
          ),
      ),
    )
  },

  safeParse(
    amount: string,
    decimals: number,
    symbol: string,
  ): Either.Either<AppBalance, Error> {
    return Either.try({
      try: () => BalanceImpl.parse(amount, decimals, symbol),
      catch: (err) => {
        return new Error(`[BalanceImpl] Error parsing amount: ${amount}`, {
          cause: err,
        })
      },
    })
  },

  _fromUnknown(value: unknown): Either.Either<AppBalance, Error> {
    if (!BalanceImpl.is(value)) {
      return Either.left(new Error(`Invalid AppBalance value. expected bigint`))
    }

    // @todo: handle validation properly
    if (
      typeof value.value !== "bigint" ||
      typeof value.symbol !== "string" ||
      typeof value.decimals !== "number"
    ) {
      return Either.left(
        new Error(
          `Invalid AppBalance value. expected bigint, got: ${value.value}`,
        ),
      )
    }

    return Either.right(value)
  },

  decodeUnknown(value: unknown) {
    const balance = safeObj(value)

    return BalanceImpl._fromUnknown({
      ...balance,
      value: safeBigInt(balance?.value),
    })
  },

  add(a: AppBalance, b: AppBalance): AppBalance {
    return BalanceImpl.zip(a, b, EBigInt.sum, "sum")
  },

  minus(a: AppBalance, b: AppBalance): AppBalance {
    return BalanceImpl.zip(a, b, EBigInt.subtract, "sum")
  },

  zip(
    a: AppBalance,
    b: AppBalance,
    fn: (a: bigint, b: bigint) => bigint,
    operation = "zip",
  ): AppBalance {
    const can_zip = a.symbol === b.symbol && a.decimals === b.decimals

    if (!can_zip) {
      throw new Error(`Cannot ${operation} \`Balances\` with different tokens`)
    }

    return BalanceImpl.create(fn(a.value, b.value), a.decimals, a.symbol)
  },

  map(f: (amount: bigint) => bigint): (value: AppBalance) => AppBalance {
    return (value) => {
      if (BalanceImpl.isEmpty(value)) return value

      return BalanceImpl.create(f(value.value), value.decimals, value.symbol)
    }
  },

  as(balance: bigint) {
    return BalanceImpl.map(() => balance)
  },

  fromOption(balance: O.Option<AppBalance>) {
    return pipe(balance, O.getOrElse(BalanceImpl.empty))
  },

  format(balance: AppBalance) {
    return formatUnits(balance.value, balance.decimals)
  },

  /**
   * @description - For presentation. Will loose precision, not intended for use for calculations.
   *
   * @returns
   */
  toNumber(balance: AppBalance): number {
    return Number(BalanceImpl.format(balance))
  },

  /**
   * For presentation. Not intended for use for calculations
   * @returns
   */
  formatUsing(balance: AppBalance, formatter = shortTokenValueFormatter) {
    return formatter.format(Number.parseFloat(BalanceImpl.format(balance)))
  },

  /**
   * Converts a AppBalance to FiatValue
   * @param balance
   * @param currency
   * @returns
   */
  toFiat(balance: AppBalance, rate: number, currency: string) {
    return FiatImpl.create({
      amount: BalanceImpl.toNumber(balance) * rate,
      currency_symbol: currency,
    })
  },

  get orderByValue() {
    return Order.mapInput(Order.bigint, (data: AppBalance) => data.value)
  },
}
