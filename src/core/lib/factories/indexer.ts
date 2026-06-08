import {
  type PostRequestTimeoutStatus,
  RequestStatus,
  type RequestStatusWithMetadata,
  TimeoutStatus,
} from "@hyperbridge/sdk"
import { pipe } from "effect"
import { mapKeys } from "effect/Record"
import { snakeCase } from "lodash-es"
import type { NetworkTag } from "@/types"
import type { LegacyTxStatusKey, RemoteEvent, StatusKey } from "@/types/tx"
import { rootLogger } from "../logger"
import { O } from "../utils/fp.helpers"

type HBRequest = RequestStatusWithMetadata | PostRequestTimeoutStatus

type StatusOldToNewMap = Partial<Record<StatusKey, LegacyTxStatusKey>>

const INDEXER_STATUS_MAPPING = {
  evm: {
    [RequestStatus.SOURCE]: "Dispatched",
    [RequestStatus.SOURCE_FINALIZED]: "SourceFinalized",
    [RequestStatus.HYPERBRIDGE_DELIVERED]: "HyperbridgeVerified",
    [RequestStatus.HYPERBRIDGE_FINALIZED]: "HyperbridgeFinalized",
    [RequestStatus.DESTINATION]: "DestinationDelivered",
    [TimeoutStatus.PENDING_TIMEOUT]: "Timeout",
    [TimeoutStatus.DESTINATION_FINALIZED_TIMEOUT]: "DestinationFinalized",
    [TimeoutStatus.HYPERBRIDGE_TIMED_OUT]: "HyperbridgeVerified",
    [TimeoutStatus.HYPERBRIDGE_FINALIZED_TIMEOUT]: "HyperbridgeFinalized",
    [RequestStatus.TIMED_OUT]: "TimedOut",
  } satisfies StatusOldToNewMap,

  relay: {
    [RequestStatus.SOURCE]: "HyperbridgeVerified",
    [RequestStatus.HYPERBRIDGE_FINALIZED]: "HyperbridgeFinalized",
    [TimeoutStatus.PENDING_TIMEOUT]: "Timeout",
    [TimeoutStatus.DESTINATION_FINALIZED_TIMEOUT]: "DestinationFinalized",
    [RequestStatus.DESTINATION]: "DestinationDelivered",
    [RequestStatus.TIMED_OUT]: "TimedOut",
  } as const satisfies StatusOldToNewMap,
}

export const IndexerEvent = {
  infer_event_key(
    network: NetworkTag,
    event: StatusKey,
  ): O.Option<LegacyTxStatusKey> {
    if (network === "relay")
      // @ts-expect-error Expected to return
      return O.fromNullable(INDEXER_STATUS_MAPPING?.relay?.[event])

    return O.fromNullable(INDEXER_STATUS_MAPPING?.evm?.[event])
  },

  /**
   * Normalize indexer events (SEND | ROLLBACK) to match LEGACY_EVENTS
   *
   * @returns A Normalized Event
   */
  normalize(network: NetworkTag, request_status: HBRequest) {
    const legacy_event_key = this.infer_event_key(
      network,
      request_status.status,
    )

    if (O.isNone(legacy_event_key)) {
      throw new Error(
        `Invalid status ${request_status.status} not expected in Network(${network}) record`,
      )
    }

    const transformed = pipe(
      {
        kind: legacy_event_key.value,
        ...request_status.metadata,
      },
      mapKeys((key) => snakeCase(key)),
    )

    rootLogger.debug(
      `Normalized event from ${request_status.status} -> ${legacy_event_key}`,
      { original: request_status, transformed },
    )

    return {
      payload: transformed as unknown as RemoteEvent,
      write_path: request_status.status,
    }
  },
}
