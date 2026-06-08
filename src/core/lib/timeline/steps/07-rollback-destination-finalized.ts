import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { getConsenusLayerName, Timeline } from "@/lib/factories/timeline"
import {
  getFinalityEstimate,
  normalize_timestamp,
  TxImpl,
} from "@/lib/factories/transaction"
import { O } from "@/lib/utils/fp.helpers"
import { createEventTf, timelineState } from "../timeline-event-transformer"

const basicMessage = Timeline.make("DestinationFinalized", {
  loading: (tx) => `${getConsenusLayerName(tx.destination)} timed out`,
  success: (tx) => `${getConsenusLayerName(tx.destination)} timed out`,
})

const powerUserMessage = Timeline.make("DestinationFinalized", {
  loading: (tx) => {
    return `Waiting for ${getConsenusLayerName(tx.destination)} to finalize your transaction time-out.`
  },
  success: (tx) => {
    return `${getConsenusLayerName(tx.destination)} finalized your transaction time-out`
  },
})

export const RollbackDestinationFinalizedTET = createEventTf({
  id: "rollback/DestinationFinalized",

  network: "destination",

  message_reader: basicMessage,

  message_detailed_reader: powerUserMessage,

  status: timelineState("DestinationFinalized", {
    mode: "rollback",
  }),

  eta(params) {
    // read the Timeout Event before summing the ETA
    return pipe(
      TxImpl.read_any_event(params.tx, "Timeout"),
      O.map((e) => e.timestamp),
      normalize_timestamp,
      O.map((last_event_timestamp) => {
        return last_event_timestamp + getFinalityEstimate(params.tx.source)
      }),
    )
  },

  estimate_duration(tx) {
    return getFinalityEstimate(tx.source)
  },

  transaction_url(tx) {
    return pipe(
      Match.value(tx),
      Match.when(
        {
          timeoutProgress: {
            DestinationFinalized: {
              status: { kind: "DestinationFinalized" },
            },
          },
        },
        ({ timeoutProgress }) => {
          const bridge = gatewayConfig.hyperbridgeNet.get()
          const tx_hash =
            timeoutProgress.DestinationFinalized.status.transaction_hash

          return NetworkImpl.safeTxUrl(bridge, tx_hash).pipe(O.getOrNull)
        },
      ),
      Match.orElse(() => null),
    )
  },
})
