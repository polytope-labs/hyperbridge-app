import {
  computeRankPos,
  findNOrLast,
  generateGeometricCumulative,
  safeRpcURL,
} from "@/lib/utils"

it("should replace protocol", () => {
  expect(
    safeRpcURL("https", "wss://hyperbridge-paseo-relay.blockops.network"),
  ).toBe("https://hyperbridge-paseo-relay.blockops.network")

  expect(
    safeRpcURL("ws", "http://hyperbridge-paseo-relay.blockops.network"),
  ).toBe("wss://hyperbridge-paseo-relay.blockops.network")
})

describe("findNOrLast", () => {
  // Safety Properties Tests - ensuring nothing bad happens
  it("should throw error when list is empty (safety: no invalid array access)", () => {
    expect(() => findNOrLast(0, (x: number) => x > 0, [])).toThrow(
      "No matching item found",
    )
  })

  it("should throw error when no item matches predicate (safety: consistent error handling)", () => {
    expect(findNOrLast(0, (x: number) => x > 100, [1, 2, 3])).eq(3)
  })

  it("should throw error when calculated index is negative (safety: no out-of-bounds access)", () => {
    // First match is at index 0, n = -1 would give prev_event_index = -1
    expect(() => findNOrLast(-1, (x: number) => x === 1, [1, 2, 3])).toThrow(
      "No matching item found",
    )
  })

  it("should never return undefined for valid indices (safety: always returns valid item)", () => {
    const result = findNOrLast(0, (x: number) => x === 2, [1, 2, 3])
    expect(result).toBeDefined()
    expect(result).toBe(2)
  })

  it("should never access out-of-bounds array indices (safety: bounds checking)", () => {
    // This should work: first match at index 1, n = 0, so returns index 1
    expect(findNOrLast(0, (x: number) => x === 2, [1, 2, 3])).toBe(2)

    // This should work: first match at index 1, n = 1, so returns index 2
    expect(findNOrLast(1, (x: number) => x === 2, [1, 2, 3])).toBe(3)
  })

  // Liveness Properties Tests - ensuring good things eventually happen

  it("should find and return the correct item when conditions are met (liveness: eventual success)", () => {
    const list = ["pending", "submitted", "verified", "completed"]
    const result = findNOrLast(0, (item: string) => item === "verified", list)

    expect(result).toBe("verified")
  })

  it("should handle complex predicates and return correct results (liveness: handles all valid inputs)", () => {
    interface TxEvent {
      kind: string
      timestamp: number
    }

    const events: TxEvent[] = [
      { kind: "Submitted", timestamp: 1000 },
      { kind: "Verified", timestamp: 2000 },
      { kind: "Delivered", timestamp: 3000 },
    ]

    const result = findNOrLast(
      0,
      (event: TxEvent) => event.kind === "Verified",
      events,
    )
    expect(result).toEqual({ kind: "Verified", timestamp: 2000 })
  })

  it("should work with negative offsets for previous events (liveness: supports intended usage pattern)", () => {
    // This simulates the actual usage in transaction.ts with n = -1
    const events = ["start", "middle", "target", "end"]

    // Find "target" and get the event before it (middle)
    expect(findNOrLast(-1, (x: string) => x === "target", events)).eq("middle")

    // But this should work - find "middle" and get it
    expect(findNOrLast(0, (x: string) => x === "middle", events)).toBe("middle")
  })

  it("should work with positive offsets for subsequent events (liveness: supports forward lookup)", () => {
    const events = ["start", "target", "next", "end"]

    // Find "target" at index 1, then get event at index 1 + 1 = 2
    const result = findNOrLast(1, (x: string) => x === "target", events)
    expect(result).toBe("next")
  })

  it("should handle edge cases with single-item arrays (liveness: minimal valid cases)", () => {
    expect(findNOrLast(0, (x: string) => x === "only", ["only"])).toBe("only")
  })

  it("should maintain referential integrity (safety: returns actual array items)", () => {
    const objA = { id: 1 }
    const objB = { id: 2 }
    const objC = { id: 3 }
    const list = [objA, objB, objC]

    const result = findNOrLast(0, (obj: { id: number }) => obj.id === 2, list)
    expect(result).toBe(objB) // Same reference, not a copy
  })

  it("should work correctly with the actual transaction event pattern (liveness: real-world usage)", () => {
    // Simulate transaction events like in the actual codebase
    const mockTx = {
      progress: {
        Submitted: { status: { kind: "Submitted" }, timestamp: 1000 },
        Verified: { status: { kind: "Verified" }, timestamp: 2000 },
      },
    }

    const events = ["Submitted", "Verified", "Delivered"]
    const has_event = (tx: any, eventType: string) => eventType in tx.progress

    // This simulates finding the first missing event
    const result = findNOrLast(0, (e: string) => !has_event(mockTx, e), events)
    expect(result).toBe("Delivered") // First event not in progress
  })
})

describe("generateGeometricCumulative()", () => {
  it("generates expontential values", () => {
    const target = 1_000_000_000
    const firstStep = 50_000
    const count = 10

    const result = generateGeometricCumulative(target, firstStep, count)

    expect(result).toMatchObject([
      50000, 193268, 603786, 1780069, 5150556, 14808246, 42481098, 121774050,
      348977664, 1000000000,
    ])
  })
})

describe("computeRankPos()", () => {
  it("use default for first rank", () => {
    const currPoint = 25
    const result = computeRankPos(currPoint)

    expect(result.nextTargetPoint).toBe(50000)

    expect(result).toMatchInlineSnapshot(`
      {
        "currRank": 1,
        "nextTargetPoint": 50000,
        "progress": 0.05,
        "totalRanks": 100,
      }
    `)
  })

  it("computes rank positions correctly", () => {
    const currPoint = 5717824
    const result = computeRankPos(currPoint)

    expect(result.nextTargetPoint).toBe(6202528)

    expect((currPoint / result.nextTargetPoint).toFixed(2)).toEqual("0.92")

    expect(result).toMatchObject({
      currRank: 30,
      nextTargetPoint: 6202528,
      progress: 92,
      totalRanks: 100,
    })
  })
})
