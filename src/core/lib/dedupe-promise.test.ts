import { describe, expect, it, vi } from "vitest"
import { DedupePromise } from "./dedupe-promise"

describe("DedupePromise", () => {
  it("should only execute the promise once for concurrent calls with the same key", async () => {
    const deduper = new DedupePromise()
    const promiseFactory = vi.fn().mockResolvedValue("test-result")
    const keyGenerator = () => "test-key"

    const promise1 = deduper.execute(keyGenerator, promiseFactory)
    const promise2 = deduper.execute(keyGenerator, promiseFactory)
    const promise3 = deduper.execute(keyGenerator, promiseFactory)

    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ])

    expect(promiseFactory).toHaveBeenCalledTimes(1)
    expect(result1).toBe("test-result")
    expect(result2).toBe("test-result")
    expect(result3).toBe("test-result")
  })

  it("should reject all promises if the original promise rejects", async () => {
    const deduper = new DedupePromise()
    const error = new Error("test-error")
    const promiseFactory = vi.fn().mockRejectedValue(error)
    const keyGenerator = () => "test-key"

    const promise1 = deduper.execute(keyGenerator, promiseFactory)
    const promise2 = deduper.execute(keyGenerator, promiseFactory)
    const promise3 = deduper.execute(keyGenerator, promiseFactory)

    await expect(promise1).rejects.toThrow(error)
    await expect(promise2).rejects.toThrow(error)
    await expect(promise3).rejects.toThrow(error)

    expect(promiseFactory).toHaveBeenCalledTimes(1)
  })

  it("should cleanup internal state after promise resolution", async () => {
    const deduper = new DedupePromise()
    const promiseFactory = vi.fn().mockResolvedValue("ok")
    const keyGenerator = () => "cleanup-key"

    await deduper.execute(keyGenerator, promiseFactory)

    // @ts-expect-error Accessing private members for testing
    expect(deduper.pendingPromises.has("cleanup-key")).toBe(false)
    // @ts-expect-error Accessing private members for testing
    expect(deduper.pendingResolvers.has("cleanup-key")).toBe(false)
  })

  it("should handle different keys independently", async () => {
    const deduper = new DedupePromise()
    const factory1 = vi.fn().mockResolvedValue("result-1")
    const factory2 = vi.fn().mockResolvedValue("result-2")

    const promise1 = deduper.execute(() => "key-1", factory1)
    const promise2 = deduper.execute(() => "key-2", factory2)
    const promise3 = deduper.execute(() => "key-1", factory1)

    const [result1, result2, result3] = await Promise.all([
      promise1,
      promise2,
      promise3,
    ])

    expect(factory1).toHaveBeenCalledTimes(1)
    expect(factory2).toHaveBeenCalledTimes(1)
    expect(result1).toBe("result-1")
    expect(result2).toBe("result-2")
    expect(result3).toBe("result-1")
  })
})
