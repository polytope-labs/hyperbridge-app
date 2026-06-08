import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { Timeline } from "@/lib/factories/timeline"
import { TimelineMessageBuilder } from "@/lib/factories/timeline-message"
import { TxImpl } from "@/lib/factories/transaction"
import { getNetworkConfig, getNetworkName } from "@/lib/utils"
import { O } from "@/lib/utils/fp.helpers"
import { createEventTf } from "../timeline-event-transformer"

const basic = Timeline.make("Dispatched", {
  success: "Cross chain transfer sent",
  loading: (tx) => {
    return TimelineMessageBuilder.make("Cross chain transfer sent")
      .caption(
        "Recover transaction to continue",
        TxImpl.is_waiting_for_timeout_stream_to_begin(tx),
      )
      .toString()
  },
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

export const RollbackDispatchTET = createEventTf({
  // @ts-expect-error Handle this
  id: "rollback/Dispatched",

  network: "destination",

  message_reader: basic,

  message_detailed_reader: powerUserMessage,

  estimate_duration: "indefinite",

  eta: () => O.some("indefinite"),

  status: (tx) => {
    return TxImpl.is_waiting_for_timeout_stream_to_begin(tx)
      ? "loading"
      : "success"
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
