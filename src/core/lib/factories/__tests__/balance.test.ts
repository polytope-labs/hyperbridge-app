import fc from "fast-check"
import { BalanceImpl } from "../balance"

describe("Parsing", () => {
  it("parses correctly", () => {
    expect(BalanceImpl.parse("1.402030923", 10, "DOT")).toMatchInlineSnapshot(`
    {
      "_tag": "app-balance",
      "decimals": 10,
      "symbol": "DOT",
      "value": 14020309230n,
    }
  `)
  })

  it("parses non expontential float values", () => {
    fc.assert(
      fc.property(
        fc
          .float()
          .filter((s) => s > 0 && Number.isFinite(s)) // only positive finite float
          .map((s) => {
            const remove_e = s.toString().replace(/e(\-|\+)\d+$/, "")
            // only positive float and no expontential values
            return Number(remove_e)
          }),
        (float) => {
          BalanceImpl.parse(`${float}`, 10, "DOT")
        },
      ),
      {
        verbose: true,
      },
    )
  })

  it.fails("for expontential values float values", () => {
    fc.assert(
      fc.property(
        fc.float().filter((s) => s > 0), // only positive float
        (float) => {
          BalanceImpl.parse(`${float}`, 10, "DOT")
        },
      ),
      { verbose: false },
    )
  })

  it("should parse manually entered numbers", () => {
    const really_large_numbers = fc
      .tuple(
        fc.integer({ min: 1, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999 }),
        fc.integer({ min: 0, max: 999999 }),
      )
      .map(([billions, millions, thousands, ones, decimals]) => {
        const integerPart =
          [billions, millions, thousands, ones]
            .map((n) => n.toString().padStart(3, "0"))
            .join(",")
            .replace(/^0+/, "") || "0"
        const decimalPart = decimals.toString().padStart(6, "0")
        return `${integerPart}.${decimalPart}`
      })

    fc.assert(
      fc.property(really_large_numbers, (amount) => {
        const balance = BalanceImpl.parse(amount, 10, "DOT")
        expect(balance).toBeDefined()
      }),
    )
  })
})

it("creates a serializable value that preserves token value", () => {
  const value = BalanceImpl.parse("1.402030923", 10, "DOT")

  expect(value).toMatchObject({
    _tag: "app-balance",
    decimals: 10,
    symbol: "DOT",
    value: 14020309230n,
  })
})

it("should convert to FiatValue", () => {
  const balance = BalanceImpl.parse("1.402030923", 10, "DOT")

  const dot_dollar_rate = 4 / 1

  expect(BalanceImpl.toFiat(balance, dot_dollar_rate, "USD"))
    .toMatchInlineSnapshot(`
    {
      "_tag": "fiat",
      "amount": 5.608123692,
      "currency_symbol": "USD",
    }
  `)
})

it("should know empty Balances", () => {
  const empty_value = BalanceImpl.empty()
  const zero_balance = BalanceImpl.parse("0", 10, "DOT")

  expect(BalanceImpl.isNone(empty_value)).toBe(true)
  expect(BalanceImpl.isNone(zero_balance)).toBe(false)
})

it("should order balance values", () => {
  const greater_balance = BalanceImpl.parse("10", 10, "DOT")
  const less_balance = BalanceImpl.parse("5", 10, "DOT")

  expect(BalanceImpl.orderByValue(less_balance, greater_balance)).toBe(-1)
  expect(BalanceImpl.orderByValue(greater_balance, less_balance)).toBe(1)
  expect(BalanceImpl.orderByValue(greater_balance, greater_balance)).toBe(0)
})

describe("Creation", () => {
  it("minimum value should be 0n", () => {
    fc.assert(
      fc.property(fc.bigInt({ min: -1000000n, max: -1n }), (negativeValue) => {
        const balance = BalanceImpl.create(negativeValue, 10, "DOT")
        expect(balance.value).toBe(0n)
      }),
    )
  })
})

describe("operations", () => {
  it("if sum 2 different token balances", () => {
    const balance_1 = BalanceImpl.parse("1.402030923", 10, "DOT")
    const balance_2 = BalanceImpl.parse("2.402030923", 10, "ETH")

    const doSum = () => BalanceImpl.add(balance_1, balance_2)

    expect(doSum).toThrowErrorMatchingInlineSnapshot(
      `[Error: Cannot sum \`Balances\` with different tokens]`,
    )
  })

  it("should add 2 token of the same balance", () => {
    const balance_1 = BalanceImpl.parse("1.402030923", 10, "DOT")
    const balance_2 = BalanceImpl.parse("2.402030923", 10, "DOT")

    const sum = BalanceImpl.add(balance_1, balance_2)

    expect(sum).toMatchObject({
      _tag: "app-balance",
      decimals: 10,
      symbol: "DOT",
      value: 38040618460n,
    })
  })
})
