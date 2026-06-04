import type { EstimatedTimeFormatted } from "@hyperbridge/ui"
import { type NetworkConfig, safeArray, safeObj } from "@hyperbridge-fe/shared"
import type {
  ExplicitStatusKey,
  FixedRenderStruct,
  LegacyTxStatusKey,
  TimelineNode,
  Transaction,
  TxMode,
} from "@/types/tx"
import {
  Timeline,
  type TimelineMessage,
  type TimelineStatus,
} from "../factories/timeline"
import { TimelineMessageBuilder } from "../factories/timeline-message"
import { normalize_timestamp, TxImpl } from "../factories/transaction"
import { TxEventImpl } from "../factories/tx-event"
import { TxFlow } from "../state-machine/tx-state-machine"
import { safeNetworkConfig } from "../utils"
import { formatDuration, toMilliseconds } from "../utils/date.helpers"
import { O, pipe } from "../utils/fp.helpers"

type Milliseconds = number

type ETAValue = Milliseconds | "indefinite"

type ETAFn = (params: {
  tx: Transaction
  prev_event_timestamp: O.Option<number>
}) => O.Option<ETAValue>

interface CreateTimelineEventTransformer {
  id: ExplicitStatusKey
  network: "source" | "destination"
  message_reader: TimelineMessage
  message_detailed_reader: TimelineMessage
  transaction_url(tx: Transaction): string | null
  /**
   * @description The constant durataion milliseconds a transaction is expected to take. 30s, 1hr
   */
  estimate_duration: ETAValue | ((tx: Transaction) => ETAValue)

  status?(tx: Transaction): TimelineStatus
  /**
   * @description The time it takes for the transaction to complete
   */
  eta?: ETAValue | ETAFn
}

export interface TimelineEventTransformer {
  readonly tx: Transaction
  readonly kind: "TimelineEventTransformer"
  id: ExplicitStatusKey
  message_reader: TimelineMessage
  message_detailed_reader: TimelineMessage
  status?(tx: Transaction): TimelineStatus
  transaction_url(): string | null
  readonly network: O.Option<NetworkConfig>

  /**
   * @description The time it takes for the transaction to complete
   */
  eta(): O.Option<ETAValue>

  /**
   * @description The constant durataion milliseconds a transaction is expected to take. 30s, 1hr
   */
  eta_duration: () => ETAValue
  eta_formatted: EstimatedTimeFormatted
  read_status: TimelineStatus
  get_message: () => { title: string; caption: string | null }
}

export function createEventTf(inner: CreateTimelineEventTransformer) {
  const [mode, event_key] = inner.id.split("/") as [TxMode, LegacyTxStatusKey]

  return Object.freeze({
    kind: "TETFactory",
    id: inner.id,
    mode,
    event_key,
    create: (tx: Transaction): TimelineEventTransformer => ({
      kind: "TimelineEventTransformer",

      // @ts-expect-error Not a problem
      __proto__: Object.freeze({
        ...inner,
        tx: tx,
        status: inner.status ?? timelineState(event_key, { mode: mode }),
      }),

      get read_status() {
        return TFImpl.read_status(this, tx)
      },

      eta() {
        console.assert(inner.eta, `${inner.id} TET requires an eta value`)

        if (typeof inner.eta !== "function") {
          return O.none()
        }

        const prev_event_timestamp = read_prev_timestamp({
          tx,
          mode: mode,
          from_status: event_key,
        })

        if (typeof inner.eta === "number") {
          const eta_as_number = inner.eta

          // gets the last event timestamp and increment it by the ETA
          return pipe(
            prev_event_timestamp,
            O.map((timestamp) => timestamp + eta_as_number),
          )
        }

        return inner.eta({
          tx,
          prev_event_timestamp,
        })
      },

      get network() {
        return O.fromNullable(tx[inner.network]).pipe(
          O.flatMap(safeNetworkConfig),
        )
      },

      eta_duration() {
        return typeof inner.estimate_duration === "function"
          ? inner.estimate_duration(tx)
          : inner.estimate_duration
      },

      get_message() {
        const status = this.read_status
        const message = Timeline.message({
          record: this.message_reader,
          status: status,
          tx: tx,
        })

        if (!TimelineMessageBuilder.isValid(message)) {
          return { title: message, caption: null }
        }

        const [title, caption] = TimelineMessageBuilder.toTuple(message)

        return { title, caption }
      },

      get eta_formatted() {
        if (this.eta_duration() === "indefinite") {
          return "" as EstimatedTimeFormatted
        }

        const duration = calcTimestampDiff({
          tx: tx,
          mode: mode,
          status: event_key,
        })

        const [formatted_duration] = formatDuration(duration).split(",")

        return formatted_duration as EstimatedTimeFormatted
      },

      transaction_url() {
        return inner.transaction_url(tx)
      },
    }),
  })
}

/**
 * Uses the TxFlow to predict current Timeline state
 * @param status_ref
 * @param config
 * @returns
 */
export function timelineState(
  status_ref: LegacyTxStatusKey,
  config: {
    debug?: boolean
    mode: "send" | "rollback"
    initial?: boolean
  },
) {
  const { mode = "send", initial = false } = safeObj(config)

  return (tx: Transaction): TimelineStatus => {
    const current_evt = TxImpl.read_event_by_mode(tx, mode, status_ref)

    if (mode === "send") {
      if (O.isNone(current_evt) && TxImpl.is_timed_out(tx)) {
        return "timeout"
      }
    }

    const prev_event = read_prev_event(tx, status_ref, mode)

    if (initial) {
      return O.isSome(current_evt) ? "success" : "loading"
    }

    // wait for previous state to be register
    if (O.isNone(prev_event)) return "waiting"

    // show loading state if the previous event is registered
    // and this current isn't
    if (O.isNone(current_evt)) return "loading"

    // show success when current event is registered
    return "success"
  }
}

export const read_prev_event = (
  tx: Transaction,
  from_status: LegacyTxStatusKey,
  mode: "send" | "rollback",
) => {
  const machine_key = TxImpl.key_infer({
    tx: tx,
    mode: mode,
    priority: "transaction",
  })

  return pipe(
    machine_key,
    O.flatMap((key) => {
      return O.fromNullable(TxFlow.prev(key, from_status))
    }),
    O.flatMap((status_key) => TxImpl.read_event_by_mode(tx, mode, status_key)),
  )
}

const read_prev_timestamp = (params: {
  tx: Transaction
  from_status: LegacyTxStatusKey
  mode: "send" | "rollback"
}) => {
  const machine_key = TxImpl.key_infer({
    tx: params.tx,
    mode: params.mode,
    priority: "transaction",
  })

  return pipe(
    machine_key,
    // O.tap((v) => O.some(logger.info("Network", v))),
    O.map((group) => TxFlow.prev(group, params.from_status)),
    // O.tap((event) => O.some(logger.log("Prev Event", event))),
    O.flatMap((e) => O.fromNullable(e)),
    O.flatMap((e) => TxImpl.read_event_by_mode(params.tx, params.mode, e)),
    O.flatMap((tx_event) => O.fromNullable(tx_event.timestamp)),
    normalize_timestamp,
  )
}

export const TFImpl = {
  read_status(tf: TimelineEventTransformer, tx: Transaction) {
    return tf.status?.(tx) ?? "waiting"
  },

  duration(tf: TimelineEventTransformer) {
    const value = tf.eta_duration()

    if (value === "indefinite") {
      return "" as const
    }

    const [first] = formatDuration(value).split(",")

    return first as EstimatedTimeFormatted
  },

  eta_to_datetimestamp(tf: TimelineEventTransformer) {
    const duration = tf.eta_duration()
    const to_timestamp = tf
      .eta()
      .pipe(
        O.flatMap((e: ETAValue) => (e === "indefinite" ? O.none() : O.some(e))),
      )

    if (duration === "indefinite") return O.none()
    if (O.isNone(to_timestamp)) return O.none()

    return to_timestamp.pipe(
      O.map((x) => ({
        etaDuration: duration,
        toTimestamp: x,
      })),
    )
  },
}

function group_timeline_events(structure: FixedRenderStruct) {
  function* buildMap(structure: Record<string, string[]>) {
    for (const key in structure) {
      yield [key, 0] as const

      const list = safeArray(structure[key])

      for (const children of list) {
        yield [children, 1] as const
      }
    }
  }

  return function* apply_group(list: ExplicitStatusKey[]) {
    const levelMap = new Map(Array.from(buildMap(structure)))

    for (const entry of list) {
      if (!levelMap.has(entry)) continue

      const level = levelMap.get(entry)

      if (typeof level === "undefined") continue

      yield [level, entry] as const
    }
  }
}

const TIMELINE_RENDER_STRUCTURE: FixedRenderStruct = {
  "send/Dispatched": [
    "send/SourceFinalized",
    "send/HyperbridgeVerified",
    "send/HyperbridgeFinalized",
  ],
  // @ts-expect-error Nothing all notice
  "rollback/Dispatched": [
    "rollback/DestinationFinalized",
    "rollback/HyperbridgeVerified",
    "rollback/HyperbridgeFinalized",
  ],
  "send/DestinationDelivered": ["rollback/TimedOut"],
  "rollback/TimedOut": [],
}

const group_to_list = group_timeline_events(TIMELINE_RENDER_STRUCTURE)

function* list_to_tree(gen: ReturnType<typeof group_to_list>) {
  const node = (
    key: ExplicitStatusKey,
    children: TimelineNode[] = [],
  ): TimelineNode => {
    return { key: key, children: children }
  }

  let curr: TimelineNode | null = null

  for (const [level, entry] of gen) {
    if (level === 0) {
      if (curr !== null) {
        yield curr
      }

      curr = node(entry)
      continue
    }

    if (level === 1) {
      curr?.children?.push?.(node(entry))
    }
  }

  yield curr
}

export const TimelineStructure = {
  group_to_list,
  list_to_tree,
}

function calcTimestampDiff(params: {
  tx: Transaction
  status: LegacyTxStatusKey
  mode: "send" | "rollback"
}): number {
  const { tx, status, mode } = params

  const last_timestamp = pipe(
    read_prev_event(tx, status, mode),
    O.flatMap((event) => {
      const timestamp = O.firstSomeOf([
        // attempt to read timestamp from blockchain event
        TxEventImpl.timestamp(event.status),
        // or fallback to the local timestamp
        O.fromNullable(event?.timestamp as number),
      ])

      return timestamp
    }),
    O.orElse(() => {
      return status === "Dispatched" ? O.fromNullable(tx.createdAt) : O.none()
    }),
  )

  const curr_timestamp = pipe(
    TxImpl.read_event_by_mode(tx, mode, status),
    O.flatMap((e) => O.fromNullable(e.timestamp)),
  )

  const diff = O.zipWith(last_timestamp, curr_timestamp, timestampDiff)

  return pipe(
    diff,
    O.getOrElse(() => 0),
  )

  function timestampDiff(last: number, current: number) {
    return toMilliseconds(current) - toMilliseconds(last)
  }
}
