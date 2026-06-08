import { type IsmpClient, queryPostRequest } from "@hyperbridge/sdk"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { hexToU8a } from "@polkadot/util"
import { formatDistance } from "date-fns"
import { Effect } from "effect"
import type { PublicClient } from "viem"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { TxImpl } from "@/lib/factories/transaction.ts"
import { TxWriteImpl } from "@/lib/factories/tx-event.ts"
import { TxNormalizer } from "@/lib/factories/tx-normalizer.ts"
import { safeRpcURL } from "@/lib/utils"
import { Arr, O, pipe } from "@/lib/utils/fp.helpers.ts"
import type { RpcUrl } from "@/lib/utils/types"
import type {
  AnyToken,
  AppBalance,
  ChainId,
  NetworkConfig,
  Receipt,
} from "@/types"
import type { TimeoutStatusWithMeta } from "@/types/hyperclient"
import type {
  ExplicitStatusKey,
  HexString,
  IPostRequest,
  RemoteEvent,
  RemoteRollbackEvent,
  StreamEvent,
  Transaction,
  TxCreationEvents,
} from "@/types/tx"
import type { TxEvent } from "@/types/tx-event"
import { safeArray } from "@hyperbridge-fe/shared/lib"
import { FeeToken } from "./fee-token"
import { IndexerQuery } from "./hyperbridge-indexer"
import { rootLogger } from "./logger"
import { TxFlow } from "./state-machine/tx-state-machine"
import { EventTFStore } from "./timeline/steps/list"
import { delay as delayPromise } from "./utils/async.helpers"

type ExpectedEvents = RemoteRollbackEvent | Receipt
type AppTxTimeoutWriteEvent = StreamEvent<ExpectedEvents>

export type BridgeParams = {
  readonly source: ChainId
  readonly from: HexString
  readonly destination: ChainId
  readonly token: AnyToken
  readonly amount: number
  /**
   * eg. Timeout in seconds
   * 3600 -> 1hr
   */
  readonly timeout: number
  readonly relayerFee: number
  readonly recipient: HexString
}

export type InscriptionRequestParams = Omit<
  BridgeParams,
  "recipient" | "amount" | "token"
> & {
  message: string
  source: number
  destination: number
}

export async function* streamToAsyncIterator<T>(stream: ReadableStream<T>) {
  const reader = stream.getReader()

  while (true) {
    const { value: event, done } = await reader.read()
    if (done) break
    if (!event) continue

    yield event
  }
}

// Queries the request for the given commitment from the node.
// it expects the commitment to be a post request
export async function queryHyperbridgeRequest(
  commitmentHex: `0x${string}`,
  url?: RpcUrl,
): Promise<IPostRequest> {
  const default_rpc_url = () =>
    NetworkImpl.rpcUrl(gatewayConfig.hyperbridgeNet.get())

  const commitment = hexToU8a(commitmentHex)

  if (commitment.length !== 32) {
    throw new Error("Commitment must be 32 bytes long")
  }

  const rpc_url = safeRpcURL("https", url ?? default_rpc_url())
  const response = await fetch(rpc_url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: 29,
      jsonrpc: "2.0",
      method: "ismp_queryRequests",
      params: [
        [
          {
            commitment: commitmentHex,
          },
        ],
      ],
    }),
  })

  if (!response.ok) {
    throw new Error(`Response status: ${response.status}`)
  }

  const { result } = await response.json()

  if (result.length === 0) {
    throw new Error(`Request CommitmentHex(${commitmentHex}) not found!`)
  }

  const fetched = result[0].Post

  return {
    body: fetched.body,
    dest: fetched.dest,
    from: fetched.from,
    nonce: BigInt(fetched.nonce),
    source: fetched.source,
    timeoutTimestamp: BigInt(
      typeof fetched.timeout_timestamp !== "undefined"
        ? fetched.timeout_timestamp
        : fetched.timeoutTimestamp,
    ),
    to: fetched.to,
  }
}

export async function queryHyperBridgeRequestForChain(
  commitmentHex: HexString,
  chainId: ChainId,
) {
  const rpc = gatewayConfig.getNetwork(chainId)?.rpcUrls?.[0]

  if (!rpc) {
    throw new Error(`HyperBridgeQuery Failed. No Rpc Url for Chain(${chainId})`)
  }

  return queryHyperbridgeRequest(commitmentHex, rpc)
}

export const ReplayTx = {
  // Replay a Timed-out transaction
  async *replayTimeout(params: {
    transaction: Transaction
    sleepTime: number
    /**
     * A user will be require to click on the Refund button to complete the transaction.
     *
     * You will have to emit manually trigger the Receipt event at a later time
     */
    manual_completion?: boolean
  }): AsyncGenerator<AppTxTimeoutWriteEvent> {
    const { transaction, manual_completion = true } = params

    type Events = TimeoutStatusWithMeta["kind"]

    const event_emission_order: Events[] = [
      "DestinationFinalized",
      "HyperbridgeVerified",
      "HyperbridgeFinalized",
    ]

    for (const event_key of event_emission_order) {
      await delayPromise(params.sleepTime)

      const event_payload = transaction.timeoutProgress[event_key]

      if (!event_payload) {
        yield { kind: "Close", _emitter: "replayer" }
        break
      }

      yield {
        kind: "Progress",
        value: event_payload.status as ExpectedEvents,
        _emitter: "replayer",
      }
    }

    if (!manual_completion) {
      yield {
        kind: "Progress",
        value: { kind: "Receipt" } as Receipt,
        _emitter: "replayer",
      }
    }

    yield {
      kind: "Close",
      _emitter: "replayer",
    }
  },

  /** Replay Transaction events from Cache */
  *replayTransaction(params: {
    transaction: Transaction
    replayOrder: TxCreationEvents["kind"][]
  }): Generator<TxCreationEvents> {
    const { transaction, replayOrder } = params
    const { transaction_hash } = transaction

    for (const event_kind of replayOrder) {
      if (event_kind === "InBlock" && transaction.progress.Dispatched) {
        yield {
          kind: "InBlock",
          transaction_hash: transaction.transaction_hash,
          // @ts-expect-error Add expected properties
          block_number: transaction.progress.Dispatched.status.block_number,
        }
      }

      if (event_kind === "IPostRequest" && transaction.request) {
        yield {
          kind: "IPostRequest",
          transaction_hash: transaction_hash,
          request: transaction.request,
        }
      }

      if (
        event_kind === "Verified" &&
        transaction.progress.HyperbridgeVerified?.status
      ) {
        // @ts-expect-error Add expected properties
        const { block_hash, block_number } =
          transaction.progress.HyperbridgeVerified.status

        yield {
          kind: "Verified",
          transaction_hash: transaction_hash,
          block_hash,
          block_number,
        }
      }
    }
  },
}

export function calculateDotBridgingFee(params: {
  amountToTransfer: AppBalance
  percentage: bigint
}) {
  const { amountToTransfer: entered_amount } = params

  const positive_amount =
    entered_amount.value <= 0n
      ? entered_amount.value * -1n
      : entered_amount.value

  const pow = 10n ** BigInt(entered_amount.decimals)

  // maximum fee is 10 DOTS
  const ten_dots = 10n * pow

  // calulate fee of the entered amount
  const bridge_fee = positive_amount / params.percentage

  // check if the fee is greater than the maximum fee
  if (bridge_fee > ten_dots) return ten_dots

  return bridge_fee
}

/**
 * @notice Helper to get the official fee token for a given chain from its ISMP Host contract.
 */
export async function getFeeToken(
  publicClient: PublicClient,
  ismpHostAddress: HexString,
): Promise<HexString> {
  try {
    return await new FeeToken(publicClient, ismpHostAddress).feeTokenAddress()
  } catch (e) {
    rootLogger.error("Could not fetch fee token from host contract", e)
    throw new Error("Could not determine fee token for the source chain.")
  }
}

/**
 * Fetches the latest request statuses and crosscheck with tx record
 *
 * @param params
 * @returns the Missed events
 */
export async function fetchAndSetMissedEvents(params: {
  transaction: Transaction
  client: IsmpClient
  mode: "send" | "rollback"
}): Promise<TxEvent[]> {
  const _logger = rootLogger.withTag("fetchAndSetMissedEvents")

  const fallback = () => []
  const { client, transaction } = params

  const hash = TxImpl.commitment(transaction)

  if (O.isNone(hash)) {
    _logger.warn(
      "Anomaly: Commitment Hash expected to be set before reaching this",
    )
    return fallback()
  }

  const request = await pipe(
    Effect.tryPromise({
      try: () => client.queryRequestWithStatus(hash.value),
      catch: (err) => {
        return new Error("Failed to read request with status", { cause: err })
      },
    }),
    Effect.runPromise,
  )

  const normalize = TxNormalizer.forIndexerStatus(transaction)

  const latest_events = safeArray(request?.statuses).map((e) => {
    return normalize(e)
  })

  return latest_events.filter((entry) => {
    const stored_event = TxImpl.read_event_by_mode(
      transaction,
      params.mode,
      entry.kind,
    )

    if (O.isNone(stored_event)) {
      return true
    }

    return TxWriteImpl.is_missed(stored_event.value)
  })
}

export function getTransactionEta(tx: Transaction, source_net: NetworkConfig) {
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

  // get next expected event
  const next_event = all_events.find((event_key) => {
    return O.isNone(TxImpl.read_event_by_mode(tx, mode, event_key))
  })

  if (next_event === "Dispatched") {
    return source_net?.estimatedTransferTime ?? "1 hour"
  }

  // return the duration of the next event from now
  return pipe(
    O.fromNullable(next_event),
    O.flatMap((status_key) => {
      return O.fromNullable(
        EventTFStore.get(`${mode}/${status_key}` as ExplicitStatusKey)?.create(
          tx,
        ),
      )
    }),
    O.flatMap((tet) => {
      const value = tet.eta_duration()
      return value === "indefinite" ? O.none() : O.some(value)
    }),
    O.map((duration) => Date.now() + duration),
    O.map((e) => formatDistance(Date.now(), e)),
    O.getOrElse(() => ""),
  )
}

/**
 *
 * @param transaction
 * @param commitment_hash
 * @see getRecentEvents for fetching pure events from indexer
 * @returns
 */
const getRecentNormalizedEvents = async (
  transaction: Transaction,
  commitment_hash: HexString,
): Promise<RemoteEvent[]> => {
  async function getRecentEvents(commitment_hash: HexString) {
    // read updated request from indexer
    const updated_request = await queryPostRequest({
      commitmentHash: commitment_hash,
      queryClient: IndexerQuery.singleton(),
    })

    if (!updated_request) return []

    return updated_request.statuses
  }

  const statuses = await getRecentEvents(commitment_hash)
  const normalize = TxNormalizer.forIndexerStatus(transaction)

  return statuses.map((status_with_meta) => normalize(status_with_meta))
}

export function getLastStatus(tx: Transaction) {
  const get_statuses = (hash: HexString) =>
    Effect.tryPromise({
      try: () => getRecentNormalizedEvents(tx, hash),
      catch: (err) =>
        new Error("Error retreiving IPostRequest and status", {
          cause: err,
        }),
    })

  return pipe(
    TxImpl.commitment(tx),
    Effect.flatMap((hash) => get_statuses(hash)),
    Effect.flatMap((statuses) => Arr.last(statuses)),
    Effect.catchTag("NoSuchElementException", () => {
      return Effect.fail(new Error("Error reading latest status"))
    }),
  )
}
