import { FiatImpl } from "../fiat"

describe("FiatImpl", () => {
  test("empty should return a FiatValue with amount 0 and currency USD", () => {
    const emptyFiat = FiatImpl.empty
    expect(emptyFiat.amount).toBe(0)
    expect(emptyFiat.currency_symbol).toBe("USD")
  })

  test("create should return a FiatValue with the given amount and currency symbol", () => {
    const fiat = FiatImpl.create({ amount: 100, currency_symbol: "EUR" })
    expect(fiat.amount).toBe(100)
    expect(fiat.currency_symbol).toBe("EUR")
  })

  test("asDollar should return a FiatValue with the given amount and currency USD", () => {
    const dollarFiat = FiatImpl.asDollar(50)
    expect(dollarFiat.amount).toBe(50)
    expect(dollarFiat.currency_symbol).toBe("USD")
  })

  describe("add", () => {
    test("should add two FiatValues with the same currency", () => {
      const fiat1 = FiatImpl.asDollar(10)
      const fiat2 = FiatImpl.asDollar(20)
      const result = FiatImpl.add(fiat1, fiat2)
      expect(result.amount).toBe(30)
      expect(result.currency_symbol).toBe("USD")
    })

    test("should throw an error when adding FiatValues with different currencies", () => {
      const fiat1 = FiatImpl.create({ amount: 10, currency_symbol: "USD" })
      const fiat2 = FiatImpl.create({ amount: 20, currency_symbol: "EUR" })
      expect(() => FiatImpl.add(fiat1, fiat2)).toThrow(
        "Cannot sum values with different currencies",
      )
    })
  })
})
