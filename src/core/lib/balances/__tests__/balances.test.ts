import * as fc from "fast-check"
import type { SubstrateToken } from "@hyperbridge-fe/shared"
import { SubstrateBalances } from "../substrate"
import { formatUnits, parseUnits } from "viem/utils"
import { pipe } from "effect"
import { BalanceImpl } from "@/lib/factories/balance"

it("should calculate Existential Deposit", () => {
  fc.property(
    fc.string().filter((s) => /^\d+$/.test(s)), // Valid numeric string for balance
    fc.record({
      existentialDeposit: fc.nat(),
      decimals: fc.integer().filter((e) => e > 4 && e < 18),
    }),
    (tokenBalance, token) => {
      const result = SubstrateBalances.minusExistentialDeposit(
        tokenBalance,
        token as SubstrateToken,
      )

      // Result should never be negative
      const nonNegative = result >= 0n

      // Zero deposit should return 0n
      const zeroDepositCheck =
        token.existentialDeposit <= 0 ? result === 0n : true

      const deposit = token.existentialDeposit * 10 ** token.decimals

      // Balance less than deposit should return 0n
      const depositBalanceCheck =
        BigInt(tokenBalance) <= BigInt(deposit) ? result === 0n : true

      return nonNegative && zeroDepositCheck && depositBalanceCheck
    },
  )
})

it("learning how to combine number and bigint in the most precise fashion", () => {
  const expected_output = `759698719.23`

  expect(formatUnits(1333453733640327400n, 18)).toMatchInlineSnapshot(
    `"1.3334537336403274"`,
  )

  expect(
    pipe(
      BalanceImpl.create(BigInt(1333453733640327400), 18, "SYM"),
      BalanceImpl.formatUsing,
    ),
  ).toMatchInlineSnapshot(`"1.333453"`)

  expect(
    String(
      [759394307n, 300000, 4412.23].reduce((a, c) => Number(a) + Number(c)),
    ),
  ).toBe(expected_output)

  expect(
    formatUnits(
      [
        parseUnits("759394307", 18),
        parseUnits("300000", 18),
        parseUnits((4412.23).toFixed(2), 18),
      ].reduce((a, c) => a + c),
      18,
    ),
  ).toBe(expected_output)
})
