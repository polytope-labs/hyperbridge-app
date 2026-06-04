import { makeAutoObservable, observe, reaction, runInAction } from "mobx"
import { FiatImpl } from "../factories/fiat"

class AssetManagerStore {
  totalBalance = FiatImpl.empty

  balances = new Map<string, {}>()

  constructor() {
    makeAutoObservable(this)
  }
}

describe("Understanding Mobx State observation. Case (observe)", () => {
  it("should trigger a observable when a observable property is mutated", () => {
    const fn = vi.fn()

    const store = new AssetManagerStore()

    observe(store, (change) => {
      if (change.name === "totalBalance") {
        fn()
      }
    })

    store.totalBalance = FiatImpl.asDollar(1)

    expect(fn).toHaveBeenCalledOnce()
  })

  it("should NOT trigger an update when an observalble nested property is mutated", () => {
    const fn = vi.fn()

    const store = new AssetManagerStore()

    observe(store, (change) => {
      fn(change)
    })

    runInAction(() => {
      store.totalBalance.amount = 1.2
    })

    expect(fn).not.toHaveBeenCalled()
  })

  it("should", () => {
    const fn = vi.fn()
    const store = new AssetManagerStore()

    observe(store, (change) => {
      if (change.name === "totalBalance" && change.type === "update") {
        fn()
      }
    })

    runInAction(() => {
      store.totalBalance = FiatImpl.asDollar(1)
    })

    expect(fn).toHaveBeenCalledTimes(1)
  })
})

describe("Understanding Mobx State observation. Case (reaction)", () => {
  it("should listen for changes done right", () => {
    const store = new AssetManagerStore()
    const fn = vi.fn()

    reaction(
      () => store.totalBalance.amount,
      (curr, prev) => {
        fn({ curr, prev })
      },
    )

    runInAction(() => {
      store.totalBalance.amount = 1.4
    })

    runInAction(() => {
      store.totalBalance = FiatImpl.asDollar(1.5)
    })

    expect(fn).toHaveBeenCalledTimes(2)
  })

  test("mobx doesn't show warnings when a NON observable is observed", () => {
    const store = { totalBalance: FiatImpl.empty }
    const fn = vi.fn()

    reaction(
      () => store.totalBalance.amount,
      (curr, prev) => {
        // console.info({ curr, prev })
        fn({ curr, prev })
      },
    )

    runInAction(() => {
      store.totalBalance.amount = 1.4
    })

    runInAction(() => {
      store.totalBalance = FiatImpl.asDollar(1.5)
    })

    expect(fn).not.toHaveBeenCalled()
  })
})

describe("nested properites", () => {
  it("should NOT trigger an update when an observalble nested property is mutated", () => {
    const fn = vi.fn()

    const store = new AssetManagerStore()

    observe(store.balances, (change) => {
      // console.log("Nested Change", change)
      fn(change)
    })

    runInAction(() => {
      store.balances.set("1", {} as any)
    })

    expect(fn).toHaveBeenCalledTimes(1)
  })
})

// Findings:
// It's not a good idea to perform a state mutation with wrapping it in an action.
// 1. The reason it's unreliable is simply because strict mode has been turned off for this App.
// 2. `reaction()` observer helper doesn't check if the input is an observable and doesn't show any warnings
