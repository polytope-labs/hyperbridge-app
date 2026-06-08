import { pipe } from "effect"
import { BalanceImpl } from "../factories/balance"
import { FiatImpl } from "../factories/fiat"
import {
  calculateExecutionFee,
  deriveBaseRelayerFee,
  clampToMinimumRelayerFee,
  FeeValues,
} from "../fees/shared"

describe("Relayer fee", () => {
  it("should be a minimum of 2% from estimation fee", () => {
    expect(
      deriveBaseRelayerFee({
        executionCost: FiatImpl.asDollar(100),
      }),
    ).toMatchInlineSnapshot(`
    {
      "_tag": "fiat",
      "amount": 2,
      "currency_symbol": "USD",
    }
  `)
  })

  it("should be a minimum of 50 cents", () => {
    const value = pipe(
      deriveBaseRelayerFee({
        executionCost: FiatImpl.asDollar(10),
      }),
      FiatImpl.map(clampToMinimumRelayerFee),
    )

    expect(value).toMatchInlineSnapshot(`
      {
        "_tag": "fiat",
        "amount": 0.5,
        "currency_symbol": "USD",
      }
    `)
  })
})

describe("Execution cost", () => {
  it("should properly calculate execution fee", () => {
    const execution_fee = calculateExecutionFee({
      gasPriceInWei: FeeValues.gas(1101179187n),
      gasInfo: {
        fee_kind: "default",
        bridge_fee: FeeValues.gas(159515n),
      },
      nativeToken: {
        symbol: "BNB",
        decimals: 18,
      },
    })

    const DOLLAR_RATE = 898.56
    const execution_fee_in_usd = BalanceImpl.toFiat(
      execution_fee,
      DOLLAR_RATE,
      "USD",
    )

    expect(execution_fee).toMatchInlineSnapshot(`
      {
        "_tag": "app-balance",
        "decimals": 18,
        "symbol": "BNB",
        "value": 175654598014305n,
      }
    `)

    expect(execution_fee_in_usd).toMatchInlineSnapshot(`
      {
        "_tag": "fiat",
        "amount": 0.1578361955917339,
        "currency_symbol": "USD",
      }
    `)
  })

  it("should properly calculate execution fee for l2", () => {
    const execution_fee = calculateExecutionFee({
      gasPriceInWei: FeeValues.gas(4948343n),
      gasInfo: {
        fee_kind: "l2",
        bridge_fee: FeeValues.gas(159733n),
        l2_fee: FeeValues.fee(33426911376n),
      },
      nativeToken: {
        symbol: "BNB",
        decimals: 18,
      },
    })

    const DOLLAR_RATE = 898.56
    const execution_fee_in_usd = BalanceImpl.toFiat(
      execution_fee,
      DOLLAR_RATE,
      "USD",
    )

    expect(execution_fee).toMatchInlineSnapshot(`
      {
        "_tag": "app-balance",
        "decimals": 18,
        "symbol": "BNB",
        "value": 823840583795n,
      }
    `)

    expect(execution_fee_in_usd).toMatchInlineSnapshot(`
      {
        "_tag": "fiat",
        "amount": 0.0007402701949748352,
        "currency_symbol": "USD",
      }
    `)
  })
})
