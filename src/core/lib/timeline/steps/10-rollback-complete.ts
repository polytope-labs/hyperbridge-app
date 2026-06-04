import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { getConsenusLayerName, Timeline } from "@/lib/factories/timeline"
import { TxImpl } from "@/lib/factories/transaction"
import { O } from "@/lib/utils/fp.helpers"
import { createEventTf, read_prev_event } from "../timeline-event-transformer"

const basicMessage = Timeline.make("TimedOut", {
  loading: "Funds recovered",
  success: "Funds recovered",
})

const powerUserMessage = Timeline.make("TimedOut", {
  loading: (tx) => {
    return `Waiting for ${getConsenusLayerName(tx.destination)} to finalize your transaction time-out.`
  },
  success: (tx) => {
    return `${getConsenusLayerName(tx.destination)} finalized your transaction time-out`
  },
})

export const RollbackTimedOutTET = createEventTf({
  id: "rollback/TimedOut",

  network: "source",

  message_reader: basicMessage,

  message_detailed_reader: powerUserMessage,

  status: (tx) => {
    const current_evt = O.firstSomeOf([
      TxImpl.read_event_by_mode(tx, "rollback", "Receipt"),
      TxImpl.read_event_by_mode(tx, "rollback", "TimedOut"),
    ])

    const prev_event = O.firstSomeOf([
      read_prev_event(tx, "Receipt", "rollback"),
      read_prev_event(tx, "TimedOut", "rollback"),
    ])

    // wait for previous state to be register
    if (O.isNone(prev_event)) return "waiting"

    // show loading state if the previous event is registered
    // and this current isn't
    if (O.isNone(current_evt)) {
      if (TxImpl.is_time_for_refund(tx)) return "waiting"

      return "loading"
    }

    // show success when current event is registered
    return "success"
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

  estimate_duration: "indefinite",

  eta: "indefinite",
})
