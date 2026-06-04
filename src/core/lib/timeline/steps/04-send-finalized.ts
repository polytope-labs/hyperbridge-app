import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { Timeline } from "@/lib/factories/timeline"
import { getFinalityEstimate } from "@/lib/factories/transaction"
import { getNetworkConfig } from "@/lib/utils"
import { O } from "@/lib/utils/fp.helpers"
import { createEventTf } from "../timeline-event-transformer"

const basicMessage = Timeline.make("HyperbridgeFinalized", {
  loading: "Hyperbridge Finalized",
  success: "Hyperbridge Finalized",
})

const powerUserMessage = Timeline.make("HyperbridgeFinalized", {
  waiting: "Waiting for Hyperbridge to finalize your transaction",
  loading: "Waiting for Hyperbridge to finalize your transaction",
  success: "Hyperbridge finalized your transaction",
  timeout: "Unfortunately, your transaction has now timed-out.",
})

const getEstimate = () => {
  const bridge = gatewayConfig.hyperbridgeNet.get()

  return getFinalityEstimate(bridge.chainId)
}

export const HyperbridgeFinalizedTET = createEventTf({
  id: "send/HyperbridgeFinalized",

  network: "source",

  message_reader: basicMessage,

  message_detailed_reader: powerUserMessage,

  transaction_url(tx) {
    return pipe(
      Match.value(tx),
      Match.when(
        {
          progress: {
            HyperbridgeFinalized: {
              status: { kind: "HyperbridgeFinalized" },
            },
          },
        },
        ({ progress: { HyperbridgeFinalized } }) => {
          return pipe(
            O.fromNullable(getNetworkConfig(tx.destination)),
            O.flatMap((dest) => {
              return NetworkImpl.safeTxUrl(
                dest,
                HyperbridgeFinalized.status.transaction_hash,
              )
            }),
            O.map((url) => `${url}#eventlog`),
            O.getOrNull,
          )
        },
      ),
      Match.orElse(() => null),
    )
  },

  eta({ prev_event_timestamp }) {
    return pipe(
      prev_event_timestamp,
      O.map((timestamp) => timestamp + getEstimate()),
    )
  },

  get estimate_duration() {
    return getEstimate()
  },
})
