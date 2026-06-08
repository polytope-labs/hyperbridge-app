import { matchChain } from "@hyperbridge-fe/shared"
import { Nexus } from "@hyperbridge-fe/shared/config"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { Timeline } from "@/lib/factories/timeline"
import { ms } from "@/lib/utils/date.helpers"
import { O } from "@/lib/utils/fp.helpers"
import { createEventTf } from "../timeline-event-transformer"

const basicMessage = Timeline.make("HyperbridgeVerified", {
  loading: "Hyperbridge Verification",
  success: "Hyperbridge Verification",
})

const powerUserMessage = Timeline.make("HyperbridgeVerified", {
  waiting: Timeline.matchSource({
    relay: () => "Waiting to receive XCM on Hyperbridge",
    _: () => "Waiting for Hyperbridge to verify your transaction",
  }),
  loading: Timeline.matchSource({
    relay: () => "Waiting to receive XCM on Hyperbridge",
    _: () => "Waiting for Hyperbridge to verify your transaction",
  }),
  success: Timeline.matchSource({
    relay: () => "XCM has been dispatched from Hyperbridge",
    _: () => "Hyperbridge has verified your transaction",
  }),
  timeout: "Unfortunately, your transaction has now timed-out.",
})

export const HyperbridgeVerifiedTET = createEventTf({
  id: "send/HyperbridgeVerified",

  network: "source",

  message_reader: basicMessage,

  message_detailed_reader: powerUserMessage,

  transaction_url(tx) {
    return pipe(
      Match.value(tx),
      Match.when(
        {
          progress: {
            HyperbridgeVerified: {
              status: { kind: "HyperbridgeVerified" },
            },
          },
        },
        ({ progress: value }) => {
          const bridge = gatewayConfig.hyperbridgeNet.get()

          return matchChain(tx.source, {
            relay: () => {
              const block_number = value.HyperbridgeVerified.status.block_number
              const sub_domain =
                bridge.chainId === Nexus.chainId ? "nexus" : "gargantua"

              return `https://${sub_domain}.statescan.io/#/blocks/${block_number}?tab=events`
            },
            _: () => {
              return O.getOrNull(
                NetworkImpl.safeTxUrl(
                  bridge,
                  value.HyperbridgeVerified.status.transaction_hash,
                ),
              )
            },
            none: () => null,
          })
        },
      ),
      Match.orElse(() => null),
    )
  },

  eta({ prev_event_timestamp }) {
    return pipe(
      prev_event_timestamp,
      O.map((timestamp) => timestamp + ms("3.5 minutes")),
    )
  },

  estimate_duration: ms("3.5 minutes"),
})
