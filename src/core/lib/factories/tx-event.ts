import type {
  AllStatusKey,
  PostRequestTimeoutStatus,
  RequestStatusWithMetadata,
} from "@hyperbridge/sdk"
import type { NetworkTag } from "@hyperbridge-fe/shared"
import { Match, pipe } from "effect"
import type {
  LegacyTxStatusKey,
  RemoteEvent,
  RollbackEventKey,
  SendEventKey,
  Transaction,
  TransactionStatus,
  TransactionWriteTag,
  TxMode,
  WrittenEvent,
} from "@/types/tx"
import type { TxEvent } from "@/types/tx-event"
import { safeNum } from "../data.helpers"
import { O } from "../utils/fp.helpers"
import { IndexerEvent } from "./indexer"
import { TxImpl } from "./transaction"

const TIMEOUT_EVENTS = {
  DESTINATION_FINALIZED_TIMEOUT: null,
  HYPERBRIDGE_TIMED_OUT: null,
  HYPERBRIDGE_FINALIZED_TIMEOUT: null,
}

export const TxEventImpl = {
  /**
   * Infer the mode of the transaction event
   *
   * @todo Test this function
   * @param status_key
   * @returns
   */
  resolveMode(status_key: AllStatusKey): TxMode {
    const is_timeout_event = status_key in TIMEOUT_EVENTS

    if (status_key === "PENDING_TIMEOUT") return "send"
    if (status_key === "TIMED_OUT") return "rollback"

    return is_timeout_event ? "rollback" : "send"
  },

  /**
   * Normalizes the TxEvent
   * @param payload
   * @returns
   */
  create(params: { payload: RemoteEvent; write_path: TxMode }): TxEvent {
    return {
      __tag: "TxEvent" as const,
      // @ts-expect-error Super dynamic
      __path: params.write_path,
      ...params.payload,
    }
  },

  parse<T>(value: T | TxEvent) {
    return pipe(
      Match.value(value),
      Match.when({ __tag: "TxEvent" }, (v) => O.some(v as TxEvent)),
      Match.orElse(() => O.none()),
    )
  },

  timestamp(event: TxEvent | unknown) {
    return pipe(
      TxEventImpl.parse(event),
      O.flatMap((e) => {
        // @ts-expect-error timestamp may not be present
        return O.fromNullable(e?.timestamp as string)
      }),
      O.map((e) => safeNum(e)),
    )
  },

  is_send: (e: TxEvent) => {
    return "__path" in e && e.__path === "send"
  },

  is_rollback: (e: TxEvent) => {
    return "__path" in e && e.__path === "rollback"
  },

  match(event: TxEvent) {
    return Match.value(event)
  },

  normalize(
    network_group: NetworkTag,
    status: RequestStatusWithMetadata | PostRequestTimeoutStatus,
  ) {
    const data = IndexerEvent.normalize(network_group, status)

    return TxEventImpl.create({
      payload: data.payload,
      write_path: TxEventImpl.resolveMode(data.write_path),
    })
  },
}

export const TxWriteImpl = {
  /**
   * @todo: Test this function
   *
   * @param write_tag
   * @param tx_status
   * @returns
   */
  create<B extends { kind: string }>(
    write_tag: TransactionWriteTag,
    tx_status: Omit<TransactionStatus<B>, "write_tag">,
  ): TransactionStatus<B> {
    return { ...tx_status, write_tag: write_tag }
  },

  /**
   * @todo: Test this function
   * @param event
   * @returns
   */
  is_missed(event: WrittenEvent): boolean {
    // all missed event should have this set
    if (event?.write_tag === "missed") return true

    // for backward compatability
    // Status '{ kind: status_key }' means it's missed.
    return Object.keys(event.status).length < 2 && "kind" in event.status
  },

  /**
   * @todo: Test this function
   * @param param
   * @returns
   */
  advance_past_missed_status<T extends "rollback" | "send">(param: {
    mode: T
    flow: Array<T extends "rollback" ? RollbackEventKey : SendEventKey>
  }) {
    const { flow: statuses, mode } = param

    const set = new Set<LegacyTxStatusKey>(statuses)

    return function* apply(
      tx: Transaction,
      status: { kind: LegacyTxStatusKey },
    ) {
      // @todo: test this Imporant case
      if (!set.has(status.kind)) return

      // advance any statuses that might have been missed
      for (const status_key of statuses) {
        if (status_key === status.kind) {
          break
        }

        const event = TxImpl.read_event_by_mode(tx, mode, status_key)
        if (O.isSome(event)) continue

        const missed_event = TxWriteImpl.create("missed", {
          status: { kind: status_key },
          timestamp: Date.now(),
        })

        yield [status_key, missed_event]
      }
    }
  },
}
