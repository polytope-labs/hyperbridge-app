import { matchChain } from "@hyperbridge-fe/shared"
import { TxOrder } from "@/lib/factories/tx-order.ts"
import type {
  RemoteEvent,
  SendEvent,
  StreamEvent,
  Transaction,
} from "@/types/tx"

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
}): AsyncGenerator<StreamEvent<T>> {
  const { streamer } = params

  const past_events = fastForwardToLatestState<T>({ streamer })

  for await (const event of past_events) {
    yield event
  }

  yield* startStream({ streamer })
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
}): AsyncGenerator<StreamEvent<T>> {
  const { streamer } = params

  try {
    const tx_events = streamer.start()

    for await (const status of tx_events) {
      yield { kind: "Progress", value: status, _emitter: "stream" }
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
