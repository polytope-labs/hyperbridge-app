import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { Timeline } from "@/lib/factories/timeline"
import { getNetworkConfig, getNetworkName } from "@/lib/utils"
import { ms } from "@/lib/utils/date.helpers"
import { O } from "@/lib/utils/fp.helpers"
import type { Transaction } from "@/types/tx"

import { createEventTf } from "../timeline-event-transformer"

const basic = Timeline.make("Dispatch", {
  loading: "Transfer Initiated",
  success: "Transfer Initiated",
})

const powerUserMessage = Timeline.make("Dispatched", {
  waiting: "Waiting for transaction to begin",
  loading: Timeline.matchSource({
    relay: (tx) => `Waiting for XCM execution on ${getNetworkName(tx.source)}`,
    _: (tx) => {
      return `Waiting for transaction execution on ${getNetworkName(tx.source)}`
    },
  }),
  success: Timeline.matchSource({
    relay: (tx) => `XCM executed on ${getNetworkName(tx.source)}`,
    _: () => "Cross chain transfer sent",
  }),
  timeout: "Unfortunately, your transaction has now timed-out.",
})

export const DispatchTET = createEventTf({
  id: "send/Dispatched",

  message_reader: basic,

  network: "source",

  message_detailed_reader: powerUserMessage,

  eta: () => O.some("indefinite"),

  estimate_duration: ms("60 seconds"),

  status: (tx: Transaction) => {
    if (tx.status === "Timeout" && !tx.progress.Dispatched?.status) {
      return "timeout"
    }

    return tx.progress.Dispatched?.status?.kind ? "success" : "loading"
  },

  transaction_url(tx) {
    return pipe(
      Match.value(tx),
      Match.when(
        {
          progress: {
            Dispatched: {
              status: { kind: "Dispatched" },
            },
          },
        },
        () => {
          return pipe(
            O.fromNullable(getNetworkConfig(tx.source)),
            O.flatMap((config) => {
              return NetworkImpl.safeTxUrl(config, tx.transaction_hash)
            }),
            O.getOrNull,
          )
        },
      ),
      Match.orElse(() => null),
    )
  },
})
