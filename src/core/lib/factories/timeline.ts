import { matchChain } from "@hyperbridge-fe/shared"
import { getNetworkConfig } from "@/lib/utils"
import type { ChainId } from "@/types"
import type { Transaction } from "@/types/tx"
import { O, pipe } from "../utils/fp.helpers"
import type { UnifiedMatchers } from "../utils/types"

type ResolveString = string | ((tx: Transaction) => string)

export type TimelineMessage = {
  readonly __type: "TimelineRecord"
  readonly _key: string
  waiting: ResolveString
  loading: ResolveString
  success: ResolveString
  timeout: ResolveString
}

export type TimelineStatus = "timeout" | "success" | "loading" | "waiting"

export const Timeline = {
  message(params: {
    tx: Transaction
    record: TimelineMessage
    status: keyof TimelineMessage
  }) {
    const method = params.record?.[params.status]

    return pipe(
      O.fromNullable(method),
      O.map((fnOrString) => {
        if (typeof fnOrString === "string") return fnOrString
        return fnOrString(params.tx)
      }),
      O.getOrElse(() => "--"),
    )
  },

  make(
    name: string,
    object: Omit<TimelineMessage, "__type" | "_key" | "timeout" | "waiting"> & {
      timeout?: ResolveString
      waiting?: ResolveString
    },
  ): TimelineMessage {
    return {
      __type: "TimelineRecord",

      _key: name,
      waiting: object.loading,
      timeout: "Transaction timed-out",
      ...object,
    }
  },

  matchSource(matchers: Omit<UnifiedMatchers<Transaction, string>, "none">) {
    return (tx: Transaction) => {
      const fallback = <T>(fn?: T): Exclude<T, undefined> => {
        type O = Exclude<T, undefined>

        if (typeof fn === "undefined") {
          if (typeof matchers._ === "undefined") {
            return (() => "--") as O
          }

          return matchers._ as O
        }

        return fn as O
      }

      return matchChain(tx.source, {
        relay: () => fallback(matchers.relay)(tx),
        substrate: () => fallback(matchers.substrate)(tx),
        assetHub: () => fallback(matchers.assetHub)(tx),
        evm: () => fallback(matchers.evm)(tx),
        _: () => fallback(matchers._)(tx),
        none: () => "--",
      })
    }
  },

  destination_matches(
    matchers: Omit<UnifiedMatchers<Transaction, string>, "none">,
  ) {
    return (tx: Transaction) => {
      const fallback = <T>(fn?: T): Exclude<T, undefined> => {
        type O = Exclude<T, undefined>

        if (typeof fn === "undefined") {
          if (typeof matchers._ === "undefined") {
            return (() => "--") as O
          }

          return matchers._ as O
        }

        return fn as O
      }

      return matchChain(tx.destination, {
        relay: () => fallback(matchers.relay)(tx),
        substrate: () => fallback(matchers.substrate)(tx),
        assetHub: () => fallback(matchers.assetHub)(tx),
        evm: () => fallback(matchers.evm)(tx),
        _: () => fallback(matchers._)(tx),
        none: () => "--",
      })
    }
  },
}

export function getConsenusLayerName(source: ChainId) {
  const network = getNetworkConfig(source)
  if (!network || network.group === "assetHub") return "--"

  return network.consensus.layer
}
