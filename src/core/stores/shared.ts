import { runInAction } from "mobx"
import { safeStr } from "@/lib/data.helpers"

export function createSearchAction<
  T extends Record<string | number | symbol, unknown>,
>(state: T, prop: keyof T) {
  function setter(v: string) {
    runInAction(() => {
      if (typeof state[prop] === "string") {
        // @ts-expect-error Case handled
        state[prop] = v
      } else {
        console.warn("property has unexpected type. Expecting a `string`")
      }
    })
  }

  return {
    hasNoResult(items: unknown[]) {
      return safeStr(state[prop]).length > 0 && items.length === 0
    },

    setSearchTerm: (term: string) => {
      setter(term)
    },

    clearSearch: () => {
      setter("")
    },
  }
}
