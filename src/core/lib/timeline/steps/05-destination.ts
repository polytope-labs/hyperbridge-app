import { isEVMChain, isRelayChain } from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import { Timeline } from "@/lib/factories/timeline"
import { TxImpl } from "@/lib/factories/transaction"
import { getNetworkConfig, getNetworkName } from "@/lib/utils"
import { ms } from "@/lib/utils/date.helpers"
import { O } from "@/lib/utils/fp.helpers"
import type { Transaction } from "@/types/tx"
import { createEventTf, timelineState } from "../timeline-event-transformer"

const getDestinationName = (tx: Transaction) => getNetworkName(tx.destination)

const basicMessage = Timeline.make("DestinationDelivered", {
  waiting: Timeline.destination_matches({
    relay: () => "Skipping",
    _: (tx) => {
      const default_msg = `Relayed to ${getDestinationName(tx)}`
      const claim_msg = "Claim your funds"

      if (TxImpl.is_time_to_claim(tx)) {
        return TxImpl.match(tx, {
          transfer: () => claim_msg,
          inscription: () => "Inscription not acccounted...",
          _: () => default_msg,
        })
      }

      if (isRelayChain(tx.source) && isEVMChain(tx.destination)) {
        return claim_msg
      }

      return default_msg
    },
  }),
  loading: (tx) => `Relayed to ${getDestinationName(tx)}`,
  success: (tx) => `Relayed to ${getDestinationName(tx)}`,
})

const powerUserMessage = Timeline.make("DestinationDelivered", {
  waiting: Timeline.destination_matches({
    relay: () => "Skipping",
    _: (tx) => {
      const dest_network_name = getDestinationName(tx)
      const message = `A relayer will deliver your transaction to ${dest_network_name}`
      const can_claim_funds = `You can now claim your funds on ${dest_network_name}`

      if (TxImpl.is_time_to_claim(tx)) {
        return TxImpl.match(tx, {
          transfer: () => can_claim_funds,
          inscription: () => {
            return `You can now complete your transaction on ${dest_network_name}`
          },
          _: () => message,
        })
      }

      if (isRelayChain(tx.source) && isEVMChain(tx.destination)) {
        return can_claim_funds
      }

      return message
    },
  }),
  loading: (tx) => {
    const dest_network_name = getNetworkName(tx.destination)

    if (isRelayChain(tx.source) && isEVMChain(tx.destination)) {
      return `Claiming funds on ${dest_network_name}`
    }

    return pipe(
      tx,
      Timeline.destination_matches({
        relay: () => "Skipping",
        _: () => {
          return `Waiting for a relayer to deliver your transaction to ${dest_network_name}`
        },
      }),
    )
  },
  success: Timeline.destination_matches({
    relay: () => "Skipping",
    _: (tx) => {
      const { destination, relayerFee } = tx
      const network_name = getNetworkName(destination)
      return relayerFee
        ? `A relayer delivered your transaction to ${network_name}`
        : `You successfully completed your transaction on ${network_name}`
    },
  }),
  timeout: "Unfortunately, your transaction has now timed-out.",
})

export const DestinationTET = createEventTf({
  id: "send/DestinationDelivered",

  network: "destination",

  message_reader: basicMessage,

  message_detailed_reader: powerUserMessage,

  status: (tx: Transaction) => {
    const status = pipe(
      tx,
      timelineState("DestinationDelivered", {
        mode: "send",
      }),
    )

    if (status === "loading" && TxImpl.is_claiming_required(tx)) {
      return "waiting"
    }

    return status
  },

  transaction_url(tx) {
    return pipe(
      Match.value(tx),
      Match.when(
        {
          progress: {
            DestinationDelivered: {
              status: { kind: "DestinationDelivered" },
            },
          },
        },
        ({ progress: { DestinationDelivered } }) => {
          return pipe(
            O.fromNullable(getNetworkConfig(tx.destination)),
            O.flatMap((dest) => {
              return NetworkImpl.safeTxUrl(
                dest,
                DestinationDelivered.status.transaction_hash,
              )
            }),
            O.getOrNull,
          )
        },
      ),
      Match.orElse(() => null),
    )
  },

  eta(params) {
    if (TxImpl.is_claiming_required(params.tx)) return O.none()

    return pipe(
      params.prev_event_timestamp,
      O.map((timestamp) => timestamp + ms("1.5 minutes")),
    )
  },

  estimate_duration: ms("1.5 minutes"),
})
