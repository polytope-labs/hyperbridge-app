import { type HexString, postRequestCommitment } from "@hyperbridge/sdk"
import {
  isNil,
  isRelayChain,
  matchChain,
  resolveNetworkTag,
  safeArray,
  safeObj,
} from "@hyperbridge-fe/shared"
import {
  Arbitrum,
  ArbitrumSepolia,
  Base,
  BaseSepolia,
  Bsc,
  BscTestnet,
  Chiado,
  Ethereum,
  Gargantua,
  Gnosis,
  Nexus,
  Optimism,
  OptimismSepolia,
  Polygon,
  Sepolia,
  Soneium,
} from "@hyperbridge-fe/shared/config"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import isValid from "date-fns/esm/fp/isValid"
import { flow, Match } from "effect"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { TxOrder } from "@/lib/factories/tx-order.ts"
import { findNOrLast } from "@/lib/utils"
import type { ChainId, NetworkConfig } from "@/types"
import type { TimeoutStatusWithMeta } from "@/types/hyperclient"
import type {
  InscriptionTx,
  LegacyTxStatusKey,
  RollbackEventKey,
  SendEvent,
  SendEventKey,
  Transaction,
  TransactionStatus,
  TransferTx,
  TxError,
  TxMode,
  WrittenEvent,
} from "@/types/tx"
import { rootLogger } from "../logger"
import { type MachineKey, TxFlow } from "../state-machine/tx-state-machine"
import { isTxDoneStreaming } from "../tracker"
import { ms } from "../utils/date.helpers"
import { E, O, pipe } from "../utils/fp.helpers"
import type { Prettify } from "../utils/types"

const fallbackSymbol = Symbol("fallback")

const fallbackValue = <T extends Record<string, unknown>>(value: T) => {
  return { [fallbackSymbol]: true, ...value }
}

// Get the finality estimate for the provided source chain
export const getFinalityEstimate = (chain: ChainId) => {
  const DEFAULT_ETA = ms("6 minutes")

  switch (chain) {
    case Optimism.chainId:
    case OptimismSepolia.chainId: {
      return ms("1.5 hours")
    }

    case Arbitrum.chainId:
    case ArbitrumSepolia.chainId: {
      return ms("1.5 hours")
    }

    case Base.chainId:
    case BaseSepolia.chainId: {
      return ms("1.5 hours")
    }

    case Soneium.chainId:
      return ms("2 hours")

    case Ethereum.chainId:
    case Sepolia.chainId: {
      return ms("20 minutes")
    }

    case Polygon.chainId:
    case Bsc.chainId:
    case BscTestnet.chainId: {
      return ms("3 minutes")
    }

    case Gnosis.chainId:
    case Chiado.chainId: {
      return ms("7 minutes")
    }

    case Gargantua.chainId: {
      return ms("3 minutes")
    }

    case Nexus.chainId: {
      return ms("5 minutes")
    }
  }

  return DEFAULT_ETA
}

export const TxImpl = {
  key_infer(params: InferParams): O.Option<MachineKey> {
    const { priority, mode } = params

    if (mode === "rollback") {
      // if Tx is timed_out and timeout_started
      if (!TxImpl.is_timed_out(params.tx)) return O.none()

      const from_net = resolveNetworkTag(params.tx.source)
      const dest_net = resolveNetworkTag(params.tx.destination)
      const machine_key = `${mode}_${from_net}_${dest_net}` as MachineKey

      if (!TxFlow.has_key(machine_key)) {
        log.warn("MachineKey(%s) not found", machine_key)
        return O.none()
      }

      return O.some(machine_key)
    }

    if (mode === "send") {
      if (priority === "token") {
        if (NetworkImpl.isHyperbridgeNetwork(params.dest_config)) {
          return O.some("evm_to_polkadot_dot")
        }
      }

      return TxFlow.key_by_chain_id(params.tx.source)
    }

    return O.none()
  },

  /**
   * Returns the token information for a Transfer transaction.
   * If no token is specified in the transaction, returns default DOT token details.

   * @param transaction - The transfer transaction
   */
  token(transaction: TransferTx) {
    return (
      transaction.token ??
      fallbackValue({
        name: "Polkadot",
        symbol: "DOT",
        logo: "/tokens/dot.svg",
      })
    )
  },

  /** returns true when HyperClient is done streaming events **/
  isClientFinalized(transaction: Transaction): boolean {
    if (transaction.status === "Dispatched") {
      return false
    }

    if (transaction.status === "Pending") return false

    return isTxDoneStreaming(
      transaction,
      transaction.status as SendEvent["kind"],
    )
  },

  isDelivered(transaction: Transaction) {
    return transaction.status === "DestinationDelivered"
  },

  /**
   * Checks if a Transaction is marked as completed. Backward compatiable
   *
   * @todo Test function
   * @param tx
   * @returns
   */
  is_completed(tx: Transaction, mode: TxMode) {
    if (tx.completed) return true

    if (mode === "send") {
      if (TxImpl.progress_contains(tx, "DestinationDelivered")) return true

      if (
        isRelayChain(tx.destination) &&
        TxImpl.progress_contains(tx, "HyperbridgeVerified")
      ) {
        return true
      }

      return false
    }

    if (mode === "rollback") {
      if (TxImpl.timeout_contains(tx, "Receipt")) return true

      if (
        isRelayChain(tx.source) &&
        TxImpl.timeout_contains(tx, "HyperbridgeVerified")
      ) {
        return true
      }
    }

    return false
  },

  is_done_streaming(tx: Transaction) {
    if (tx.completed) return true

    return TxImpl.is_timed_out(tx)
  },

  is_self_delivery_enabled(tx: Transaction): boolean {
    if (tx.protocol.kind !== "Transfer") return true
    if (!("token" in tx.originalParams)) return true

    return tx.originalParams.token.selfDelivery !== false
  },

  is_claiming_required(tx: Transaction): boolean {
    return (
      TxImpl.is_self_delivery_enabled(tx) &&
      TxImpl.isClientFinalized(tx) &&
      matchChain(tx.destination, {
        evm: () => tx.relayerFee === 0,
        none: () => false,
      })
    )
  },

  has_commitment(tx: Transaction): tx is TransferTx {
    return O.isSome(TxImpl.commitment(tx))
  },

  /**
   * Checks if a Transfer contains a Timeout status
   * @param tx
   * @returns
   */
  is_timed_out(tx: Transaction): boolean {
    return TxImpl.progress_contains(tx, "Timeout")
  },

  is_time_to_claim(tx: Transaction): boolean {
    return (
      !TxImpl.isDelivered(tx) &&
      TxImpl.is_claiming_required(tx) &&
      !TxImpl.is_timed_out(tx)
    )
  },

  /**
   * Checks if a Transfer is rollback to the point where refund action can be triggered.
   * Resolves to false when the Reciept/TimedOut event is present.
   * @alias is_timeout_finalized()
   * @tx_mode Rollback
   * @param tx
   * @returns
   */
  is_time_for_refund(tx: Transaction): boolean {
    if (isRelayChain(tx.source)) return false

    const curr_status = TxImpl.infer_current_status(tx)

    if (E.isLeft(curr_status)) return false
    if (TxImpl.is_completed(tx, "rollback")) return false

    return (
      TxImpl.is_timed_out(tx) &&
      TxOrder.gte(curr_status.right, "HyperbridgeFinalized")
    )
  },

  /**
   * When a transaction is timed out and Timeout Progress is empty.
   * @param tx
   * @returns
   */
  is_waiting_for_timeout_stream_to_begin: (tx: Transaction) => {
    return (
      tx.status === "Timeout" && Object.keys(tx.timeoutProgress).length === 0
    )
  },

  progress_contains: containsStatus("progress"),

  timeout_contains: containsStatus("timeoutProgress"),

  /**
   * Added in v2
   */
  infer_mode: (tx: Transaction) => {
    return TxImpl.is_timed_out(tx) ? "rollback" : "send"
  },

  /** derives the current state of the tx from it's last recorded progress */
  infer_current_status(tx: Transaction): E.Either<LegacyTxStatusKey, Error> {
    const mode = TxImpl.infer_mode(tx)

    const readMachineKey = TxImpl.key_infer({
      priority: "transaction",
      mode,
      tx: tx,
    })

    const all_events = pipe(
      readMachineKey,
      O.map((machine_key) => TxFlow.get(machine_key)),
      O.getOrElse(() => []),
    )

    const has_event =
      mode === "send" ? TxImpl.progress_contains : TxImpl.timeout_contains

    return E.try({
      // find the first missing event and get the (n - 1) element from the array if any.
      try: () => {
        return findNOrLast(
          -1,
          (status) => !has_event(tx, status as never),
          all_events,
        )
      },
      catch: () =>
        new Error(
          "Failed to infer current state. Transaction status not found",
        ),
    })
  },

  /**
   * Checks if a transaction rollback is complete
   * @alias is_completed(),
   * @alias is_time_for_refund()
   * @param tx
   * @returns
   */
  is_timeout_finalized(tx: Transaction) {
    return matchChain(tx.source, {
      relay: () => {
        return TxImpl.timeout_contains(tx, "HyperbridgeVerified")
      },
      _: () => {
        return (
          TxImpl.timeout_contains(tx, "Receipt") ||
          TxImpl.timeout_contains(tx, "HyperbridgeFinalized")
        )
      },
      none: () => false,
    })
  },

  match<T>(
    transaction: Transaction,
    matchers: {
      inscription?: (inscription: InscriptionTx) => T
      transfer?: (transfer: TransferTx) => T
      _: () => T
    },
  ): T {
    if (transaction?.protocol?.kind === "Transfer" && matchers.transfer) {
      return matchers.transfer(transaction as TransferTx)
    }

    if (transaction?.protocol?.kind === "Inscription" && matchers.inscription) {
      return matchers.inscription(transaction as InscriptionTx)
    }

    return matchers._()
  },

  errors(tx: Transaction) {
    const filter = (e: TxError): boolean => {
      const commitment = TxImpl.commitment(tx)

      if (O.isSome(commitment) && e.kind === "InitError") {
        // skip init error when CommitmentHash is present.
        return false
      }

      return true
    }

    return safeArray(tx.errors).filter((error) => filter(error))
  },

  /**
   * Finds an event in a transaction.
   * Checks the ROLLBACK events before SEND  events
   *
   * @param tx
   * @param status_key
   * @returns
   */
  read_any_event(tx: Transaction, status_key: LegacyTxStatusKey) {
    const { read_progress_event, read_timeout_event } = TxImpl

    const send = read_progress_event(tx, status_key as SendEventKey)
    const rollback = read_timeout_event(tx, status_key as RollbackEventKey)

    return O.firstSomeOf([rollback, send])
  },

  read_event_by_mode(
    tx: Transaction,
    mode: "send" | "rollback",
    status: LegacyTxStatusKey,
  ): O.Option<WrittenEvent> {
    return mode === "send"
      ? TxImpl.read_progress_event(tx, status as SendEventKey)
      : TxImpl.read_timeout_event(tx, status as RollbackEventKey)
  },

  read_progress_event<const TStatusKey extends SendEventKey>(
    tx: Transaction,
    status: TStatusKey,
  ) {
    type Payload = Extract<SendEvent, { kind: TStatusKey }>

    return O.fromNullable(tx?.progress?.[status] as TransactionStatus<Payload>)
  },

  read_timeout_event<const TStatusKey extends RollbackEventKey>(
    tx: Transaction,
    status: TStatusKey,
  ) {
    type Payload = Extract<TimeoutStatusWithMeta, { kind: TStatusKey }>

    return O.fromNullable(
      tx?.timeoutProgress?.[status] as Prettify<TransactionStatus<Payload>>,
    )
  },

  commitment(tx: Transaction): O.Option<HexString> {
    // needed for older transaction records
    const derive_commitment_hash = pipe(
      O.fromNullable(tx?.request),
      O.map((request) => postRequestCommitment(request).commitment),
    )

    return pipe(
      O.fromNullable(tx?.commitment_hash),
      O.orElse(() => derive_commitment_hash),
    )
  },

  resolveCountdown(
    self: Transaction,
    event_key: LegacyTxStatusKey,
  ): O.Option<number> {
    const source = self.source
    const machine_key = TxFlow.key_by_chain_id(source)

    const readPrevEventTimestamp = pipe(
      machine_key,
      // O.tap((v) => O.some(logger.info("Network", v))),
      O.map((group) => TxFlow.prev(group, event_key)),
      // O.tap((event) => O.some(logger.log("Prev Event", event))),
      O.flatMap((e) => O.fromNullable(e)),
      O.flatMap((e) => TxImpl.read_event_by_mode(self, "send", e)),
      O.flatMap((tx_event) => O.fromNullable(tx_event.timestamp)),
      O.map((timestamp) => toMilliseconds(timestamp)),
    )

    return pipe(
      Match.value(event_key),
      Match.when("Dispatched", () => O.none()),
      Match.when("SourceFinalized", () => {
        return pipe(
          readPrevEventTimestamp,
          O.map((last_event_timestamp) => {
            return last_event_timestamp + getFinalityEstimate(source)
          }),
        )
      }),
      Match.when("HyperbridgeVerified", () => {
        return pipe(
          readPrevEventTimestamp,
          O.map((timestamp) => timestamp + ms("3.5 minutes")),
        )
      }),
      Match.when("HyperbridgeFinalized", () => {
        const bridge = gatewayConfig.hyperbridgeNet.get()

        return pipe(
          readPrevEventTimestamp,
          O.map((timestamp) => timestamp + getFinalityEstimate(bridge.chainId)),
        )
      }),
      Match.when("DestinationDelivered", () => {
        if (TxImpl.is_claiming_required(self)) return O.none()

        return pipe(
          readPrevEventTimestamp,
          O.map((timestamp) => timestamp + ms("1.5 minutes")),
        )
      }),
      Match.orElse(() => O.none()),
    )
  },

  /**
   * Note: added in v2
   */
  completed_at(tx: Transaction): O.Option<Date> {
    const safeDate = (timestamp: number): O.Option<Date> => {
      const date = new Date(timestamp)

      if (!isValid(date)) return O.none()

      return O.some(date)
    }

    if (!isNil(tx.completedAt)) {
      return safeDate(tx.completedAt)
    }

    return pipe(
      O.firstSomeOf([
        TxImpl.read_any_event(tx, "DestinationDelivered"),
        TxImpl.read_any_event(tx, "HyperbridgeFinalized"),
      ]),
      O.map((e) => e.timestamp),
      normalize_timestamp,
      O.flatMap((e) => safeDate(e)),
    )
  },

  read_trace(tx: Transaction) {
    return O.fromNullable(tx.tracing)
  },

  resolveRollbackCountdown(
    self: Transaction,
    event_key: LegacyTxStatusKey,
  ): O.Option<number> {
    const source = self.source
    const machine_key = TxFlow.key_by_chain_id(source)

    const normalize_timestamp = flow(
      O.map((e) => Number(e)),
      O.map(toMilliseconds),
    )

    const get_timestamp = flow(
      O.flatMap((e: { timestamp?: number }) => O.fromNullable(e?.timestamp)),
      normalize_timestamp,
    )

    const read_event_timestamp = flow(TxImpl.read_any_event, get_timestamp)

    const read_timeout_event_timestamp = flow(
      TxImpl.read_timeout_event,
      get_timestamp,
    )

    const prev_event_timestamp = pipe(
      machine_key,
      O.map((group) => TxFlow.prev(group, event_key)),
      O.flatMap((status_key) => O.fromNullable(status_key)),
      O.flatMap((status_key) => {
        return read_timeout_event_timestamp(
          self,
          status_key as RollbackEventKey,
        )
      }),
      normalize_timestamp,
    )

    return pipe(
      Match.value(event_key),
      Match.when("Dispatched", () => O.none()),
      Match.when("DestinationFinalized", () => {
        return pipe(
          TxImpl.read_any_event(self, "Timeout"),
          normalize_timestamp,
          O.map((last_event_timestamp) => {
            return last_event_timestamp + getFinalityEstimate(source)
          }),
        )
      }),
      Match.when("HyperbridgeVerified", () => {
        return pipe(
          prev_event_timestamp,
          O.map((timestamp) => timestamp + ms("3 minutes")),
        )
      }),
      Match.when("HyperbridgeFinalized", () => {
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
      }),
      Match.orElse(() => O.none()),
    )
  },

  /**
   * added in v2
   * */
  percent_progress(tx: Transaction): number {
    const mode = TxImpl.infer_mode(tx)

    const readMachineKey = TxImpl.key_infer({
      priority: "transaction",
      mode,
      tx: tx,
    })

    const all_events = pipe(
      readMachineKey,
      O.map((machine_key) => TxFlow.get(machine_key)),
      O.getOrElse(() => []),
    )

    const received_events = all_events.filter((event_key) => {
      return O.isSome(TxImpl.read_event_by_mode(tx, mode, event_key))
    })

    return Math.round((received_events.length / all_events.length) * 100)
  },
}

function containsStatus<TKey extends "timeoutProgress" | "progress">(
  key: TKey,
) {
  return <T extends Transaction>(tx: T, status: keyof T[TKey]): boolean => {
    const timeline_record = safeObj(tx?.[key])

    return status in timeline_record
  }
}

function toMilliseconds(timestamp: number) {
  // If timestamp is in seconds (less than year 2001 in milliseconds)
  if (String(timestamp).length < 11) {
    return timestamp * 1000
  }

  return timestamp
}

export const getDefaultHeartbeat = (chainId: ChainId): number => {
  switch (chainId) {
    case Gargantua.chainId:
      return 60 * 60 * 1000

    case Nexus.chainId:
      return 4 * 60 * 60 * 1000
  }

  return 0
}

export function getTimeoutTimestamp(tx: Transaction) {
  if (tx.completed) return O.none()

  if (TxImpl.is_timed_out(tx)) O.none()

  if (TxImpl.isClientFinalized(tx) || TxImpl.isDelivered(tx)) return O.none()

  return O.fromNullable(tx.request?.timeoutTimestamp)
}

const log = rootLogger.withTag("TxFlow")

type InferParams =
  | {
      priority: "transaction"
      tx: Transaction
      mode: "send" | "rollback"
    }
  | {
      priority: "token"
      tx: Transaction
      dest_config: NetworkConfig
      mode: "send" | "rollback"
    }

export const normalize_timestamp = flow(
  O.flatMap((timestamp: number) => {
    const a = Number.parseInt(String(timestamp))
    return Number.isNaN(a) ? O.none() : O.some(a)
  }),
  O.map((timestamp) => toMilliseconds(timestamp)),
)
