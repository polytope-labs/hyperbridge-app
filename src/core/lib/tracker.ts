import { matchChain } from "@hyperbridge-fe/shared"
import { TxOrder } from "@/lib/factories/tx-order.ts"
import type {
  RemoteEvent,
  SendEvent,
  StreamEvent,
  Transaction,
} from "@/types/tx"
import { delay } from "@/lib/utils/async.helpers"

const STREAM_STATUS_REFRESH_INTERVAL_MS = 5_000

export interface StreamClient<T> {
  start(): AsyncGenerator<T>

  /**
   * Reads all past transactions from a transaction
   */
  read_past_events(): AsyncGenerator<RemoteEvent>

  /**
   * reads the last status of a transaction
   */
  read_last_status: () => Promise<RemoteEvent | { kind: "None" }>
}

export async function* trackTransaction<T extends RemoteEvent>(params: {
  transaction: Transaction
  streamer: StreamClient<T>
  /** Polls the indexer while the event stream is open to recover missed events. */
  statusRefreshIntervalMs?: number
}): AsyncGenerator<StreamEvent<T>> {
  const { streamer, transaction, statusRefreshIntervalMs } = params

  const past_events = fastForwardToLatestState<T>({ streamer })

  for await (const event of past_events) {
    yield event
  }

  yield* startStream({ streamer, transaction, statusRefreshIntervalMs })
}

async function* fastForwardToLatestState<T extends RemoteEvent>(params: {
  streamer: StreamClient<T>
}): AsyncGenerator<StreamEvent<T>> {
  const { streamer } = params

  try {
    for await (const event of streamer.read_past_events()) {
      if (event.kind === "Timeout") {
        yield {
          ...event,
          _emitter: "fast_forward",
        }
        break
      }

      yield {
        kind: "Progress",
        value: event as T,
        _emitter: "fast_forward",
      }
    }
  } catch (err) {
    yield { kind: "Error", error: err as Error, _emitter: "fast_forward" }
  }
}

/**
 * Starts a stream of transaction progress events from the last known state
 */
async function* startStream<T extends RemoteEvent>(params: {
  streamer: StreamClient<T>
  transaction: Transaction
  statusRefreshIntervalMs?: number
}): AsyncGenerator<StreamEvent<T>> {
  const {
    streamer,
    transaction,
    statusRefreshIntervalMs = STREAM_STATUS_REFRESH_INTERVAL_MS,
  } = params

  try {
    const iterator = streamer.start()[Symbol.asyncIterator]()
    let nextStreamEvent = iterator.next()

    while (true) {
      const result = await Promise.race([
        nextStreamEvent.then((event) => ({ type: "stream" as const, event })),
        delay(statusRefreshIntervalMs).then(() => ({ type: "refresh" as const })),
      ])

      if (result.type === "stream") {
        if (result.event.done) return

        yield {
          kind: "Progress",
          value: result.event.value,
          _emitter: "stream",
        }
        nextStreamEvent = iterator.next()
        continue
      }

      let status: RemoteEvent | { kind: "None" }
      try {
        status = await streamer.read_last_status()
      } catch {
        // A fallback refresh must not tear down the live stream on a transient
        // indexer failure. The next interval will retry it.
        continue
      }

      if (status.kind === "None" || status.kind === transaction.status) {
        continue
      }

      yield {
        kind: "Progress",
        value: status as T,
        _emitter: "status_refresh",
      }

      if (
        status.kind === "Timeout" ||
        isTxDoneStreaming(transaction, status.kind as SendEvent["kind"])
      ) {
        return
      }
    }
  } catch (err) {
    yield { kind: "Error", error: err as Error, _emitter: "stream" }
  }
}

/**
 * Checks every stream to until last stream is received
 **/
export function isTxDoneStreaming(
  transaction: Transaction,
  status_kind: SendEvent["kind"],
): boolean {
  if (status_kind === "DestinationDelivered") return true

  return matchChain(transaction.destination, {
    // txs to the relay chain end at HyperbridgeVerified
    relay: () => TxOrder.gte(status_kind, "HyperbridgeVerified"),
    // else relay txs end at HyperbridgeFinalized
    evm: () => {
      return (
        transaction.relayerFee === 0 && status_kind === "HyperbridgeFinalized"
      )
    },
    none: () => false,
  })
}
