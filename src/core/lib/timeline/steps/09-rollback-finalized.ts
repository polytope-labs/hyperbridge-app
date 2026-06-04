import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { flow, Match, pipe } from "effect"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { Timeline } from "@/lib/factories/timeline"
import {
  getDefaultHeartbeat,
  getFinalityEstimate,
  normalize_timestamp,
  TxImpl,
} from "@/lib/factories/transaction"
import { safeNetworkConfig } from "@/lib/utils"
import { O } from "@/lib/utils/fp.helpers"
import { createEventTf } from "../timeline-event-transformer"

const basicMessage = Timeline.make("HyperbridgeFinalized", {
  loading: "Hyperbridge finalizing",
  success: "Hyperbridge finalized",
})

const powerUserMessage = Timeline.make("HyperbridgeFinalized", {
  loading: "Waiting for Hyperbridge to finalize your transaction time-out",
  success: "Hyperbridge finalized your transaction time-out",
})

export const RollbackFinalizedTET = createEventTf({
  id: "rollback/HyperbridgeFinalized",

  message_reader: basicMessage,

  network: "destination",

  message_detailed_reader: powerUserMessage,

  transaction_url(tx) {
    return pipe(
      Match.value(tx),
      Match.when(
        {
          timeoutProgress: {
            HyperbridgeFinalized: {
              status: { kind: "HyperbridgeFinalized" },
            },
          },
        },
        ({ timeoutProgress: { HyperbridgeFinalized } }) => {
          return pipe(
            safeNetworkConfig(tx.source),
            O.flatMap((source) => {
              return NetworkImpl.safeTxUrl(
                source,
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

  eta(params) {
    const self = params.tx

    const get_timestamp = flow(
      O.flatMap((e: { timestamp?: number }) => O.fromNullable(e?.timestamp)),
      normalize_timestamp,
    )

    const read_event_timestamp = flow(TxImpl.read_any_event, get_timestamp)

    const bridge = gatewayConfig.hyperbridgeNet.get()
    const timeout = read_event_timestamp(self, "Timeout")

    const verified_timestamp = pipe(
      read_event_timestamp(self, "HyperbridgeVerified"),
      O.map((timestamp) => timestamp + getFinalityEstimate(bridge.chainId)),
    )

    const dest_finalized_timestamp = pipe(
      read_event_timestamp(self, "DestinationFinalized"),
      O.orElse(() => timeout),
      // at this point you have o wait for the heartbeat update
      O.map((timestamp) => timestamp + getDefaultHeartbeat(bridge.chainId)),
    )

    return pipe(
      verified_timestamp,
      O.orElse(() => dest_finalized_timestamp),
    )
  },

  estimate_duration(tx) {
    const self = tx

    const get_timestamp = flow(
      O.flatMap((e: { timestamp?: number }) => O.fromNullable(e?.timestamp)),
      normalize_timestamp,
    )

    const read_event_timestamp = flow(TxImpl.read_any_event, get_timestamp)

    const bridge = gatewayConfig.hyperbridgeNet.get()

    const verified_timestamp = pipe(
      read_event_timestamp(self, "HyperbridgeVerified"),
      O.map(() => getFinalityEstimate(bridge.chainId)),
    )

    const dest_finalized_timestamp = pipe(
      read_event_timestamp(self, "DestinationFinalized"),
      // at this point you have o wait for the heartbeat update
      O.map(() => getDefaultHeartbeat(bridge.chainId)),
    )

    return pipe(
      O.firstSomeOf([verified_timestamp, dest_finalized_timestamp]),
      O.getOrElse(() => 0),
    )
  },
})
