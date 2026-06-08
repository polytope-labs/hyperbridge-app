export type FiatValue = {
  _tag: "fiat"
  amount: number
  /**
   * A valid currency symbol. eg. USD, EUR, NGN
   */
  currency_symbol: string
}

export type AppValue = FiatValue | AppBalance

export type AppBalance = {
  _tag: "app-balance"
  value: bigint
  decimals: number
  symbol: string
}
