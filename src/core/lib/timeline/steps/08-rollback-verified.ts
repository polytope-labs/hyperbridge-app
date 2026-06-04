import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { Timeline } from "@/lib/factories/timeline"
import { ms } from "@/lib/utils/date.helpers"
import { O } from "@/lib/utils/fp.helpers"
import { createEventTf } from "../timeline-event-transformer"

const basicMessage = Timeline.make("HyperbridgeVerified", {
  loading: "Hyperbridge timed out",
  success: "Hyperbridge timed out",
})

const powerUserMessage = Timeline.make("HyperbridgeVerified", {
  loading: "Waiting for Hyperbridge to time-out your transaction",
  success: "Hyperbridge has timed-out your transaction",
})

export const RollbackVerifiedTET = createEventTf({
  id: "rollback/HyperbridgeVerified",

  network: "destination",

  message_reader: basicMessage,

  message_detailed_reader: powerUserMessage,

  transaction_url(tx) {
    return pipe(
      Match.value(tx),
      Match.when(
        {
          timeoutProgress: {
            HyperbridgeVerified: {
              status: { kind: "HyperbridgeVerified" },
            },
          },
        },
        ({ timeoutProgress: value }) => {
          return pipe(
            NetworkImpl.safeTxUrl(
              gatewayConfig.hyperbridgeNet.get(),
              value.HyperbridgeVerified.status.transaction_hash,
            ),
            O.getOrNull,
          )
        },
      ),
      Match.orElse(() => null),
    )
  },

  eta: ms("3 minutes"),

  estimate_duration() {
    return ms("3 minutes")
  },
})
