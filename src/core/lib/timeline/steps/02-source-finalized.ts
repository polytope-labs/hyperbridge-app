import { isSubstrate } from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { getConsenusLayerName, Timeline } from "@/lib/factories/timeline"
import { getFinalityEstimate } from "@/lib/factories/transaction"
import { ms } from "@/lib/utils/date.helpers"
import { O } from "@/lib/utils/fp.helpers"
import type { Transaction } from "@/types/tx"
import { createEventTf } from "../timeline-event-transformer"

const basicMessage = Timeline.make("SourceFinalized", {
  loading: "Transaction Finalized",
  success: "Transaction Finalized",
})

const powerUserMessage = Timeline.make("SourceFinalized", {
  waiting: Timeline.matchSource({
    relay: () => "Skipping",
    _: (tx) => {
      return `Waiting for ${getConsenusLayerName(tx.source)} to finalize your transaction.`
    },
  }),
  loading: Timeline.matchSource({
    relay: () => "Skipping",
    _: (tx) => {
      return `Waiting for ${getConsenusLayerName(tx.source)} to finalize your transaction.`
    },
  }),
  success: Timeline.matchSource({
    relay: () => "Skipping",
    _: () => "Hyperbridge has verified your transaction finality",
  }),
  timeout: "Unfortunately, your transaction has now timed-out.",
})

const estimateDuration = (tx: Transaction) => {
  if (isSubstrate(tx.source)) return ms("1 minute")

  return getFinalityEstimate(tx.source)
}

export const SourceFinalizedTET = createEventTf({
  id: "send/SourceFinalized",

  network: "source",

  message_reader: basicMessage,

  message_detailed_reader: powerUserMessage,

  estimate_duration: estimateDuration,

  transaction_url(tx) {
    return pipe(
      Match.value(tx),
      Match.when(
        {
          progress: {
            SourceFinalized: {
              status: { kind: "SourceFinalized" },
            },
          },
        },
        ({ progress }) => {
          const tx_hash = progress.SourceFinalized.status.transaction_hash
          const bridge = gatewayConfig.hyperbridgeNet.get()

          return NetworkImpl.safeTxUrl(bridge, tx_hash).pipe(O.getOrNull)
        },
      ),
      Match.orElse(() => null),
    )
  },

  eta({ tx, prev_event_timestamp }) {
    return pipe(
      prev_event_timestamp,
      O.map((last_event_timestamp) => {
        return last_event_timestamp + estimateDuration(tx)
      }),
    )
  },
})
