import { parseGwei } from "viem"
import { describe, expect, it } from "vitest"
import { clampToMinPriorityFee } from "../gas"

describe("clampToMinPriorityFee", () => {
  const floor = parseGwei("25")

  it("raises an undershooting tip to the floor and keeps base-fee headroom", () => {
    const result = clampToMinPriorityFee(
      {
        maxPriorityFeePerGas: parseGwei("1.5"),
        maxFeePerGas: parseGwei("2"), // 0.5 gwei of base-fee headroom
      },
      floor,
    )

    expect(result.maxPriorityFeePerGas).toBe(floor)
    expect(result.maxFeePerGas).toBe(floor + parseGwei("0.5"))
  })

  it("leaves estimates above the floor untouched", () => {
    const fees = {
      maxPriorityFeePerGas: parseGwei("30"),
      maxFeePerGas: parseGwei("80"),
    }

    expect(clampToMinPriorityFee(fees, floor)).toEqual(fees)
  })

  it("never returns maxFeePerGas below the tip", () => {
    const result = clampToMinPriorityFee(
      { maxPriorityFeePerGas: parseGwei("1"), maxFeePerGas: parseGwei("1") },
      floor,
    )

    expect(result.maxFeePerGas).toBeGreaterThanOrEqual(
      result.maxPriorityFeePerGas,
    )
  })
})
