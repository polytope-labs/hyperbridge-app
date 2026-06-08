import type {
  PostRequestTimeoutStatus,
  RequestStatusWithMetadata,
} from "@hyperbridge/sdk"
import { resolveNetworkTag } from "@hyperbridge-fe/shared"
import { omit, omitBy } from "lodash-es"
import { isObservable, toJS } from "mobx"
import { TxImpl } from "@/lib/factories/transaction.ts"
import type { Transaction } from "@/types/tx"
import { O } from "../utils/fp.helpers"
import { TxEventImpl } from "./tx-event"

export const TxNormalizer = {
  invalid_rollback_status_keys: [
    "SourceFinalized",
    "Timeout",
    "DestinationDelivered",
  ],

  invalid_send_status_keys: ["DestinationFinalized", "Receipt"],

  normalize_observable(tx: Transaction) {
    const is_observable = isObservable(tx)

    // @ts-expect-error Cast object to tx
    return TxNormalizer.normalize(is_observable ? toJS(tx) : safeObj(tx))
  },

  normalize(tx: Transaction): Transaction {
    const {
      is_corrupted,
      invalid_send_status_keys,
      invalid_rollback_status_keys,
    } = TxNormalizer

    if (!is_corrupted(tx)) return tx

    const cloned_tx = structuredClone(tx)

    // if progress contains invalid status
    cloned_tx.progress = {
      ...omit(tx.progress, invalid_send_status_keys),
      ...omitBy(
        cloned_tx.timeoutProgress,
        (key) => !invalid_rollback_status_keys.includes(key.status.kind),
      ),
    }

    // move it to the TimeoutProgress
    cloned_tx.timeoutProgress = {
      ...omit(cloned_tx.timeoutProgress, invalid_rollback_status_keys),
      ...omitBy(cloned_tx.progress, (key) => {
        return !invalid_send_status_keys.includes(key?.status?.kind)
      }),
    }

    // reset timeout if transaction is successful
    if (O.isSome(TxImpl.read_any_event(tx, "DestinationDelivered"))) {
      cloned_tx.timeout = []
      cloned_tx.timeoutProgress = {}
      cloned_tx.progress = omit(cloned_tx.progress, ["Timeout"])
    }

    return cloned_tx
  },

  is_corrupted(tx: Transaction): boolean {
    const { invalid_rollback_status_keys, invalid_send_status_keys } =
      TxNormalizer

    const progress_contains_invalid = invalid_rollback_status_keys.some(
      // @ts-expect-error No expecting valid checks
      (key) => tx?.timeoutProgress?.[key],
    )

    const rollback_contains_invalid = invalid_send_status_keys.some(
      // @ts-expect-error No expecting valid checks
      (key) => tx?.progress?.[key],
    )

    return progress_contains_invalid || rollback_contains_invalid
  },

  forIndexerStatus: (transaction: Transaction) => {
    // read updated request from indexer
    const network_group = resolveNetworkTag(transaction.source)
    if (!network_group) throw new Error("Unable to resolve NetworkTag")

    return function transform(
      status: RequestStatusWithMetadata | PostRequestTimeoutStatus,
    ) {
      return TxEventImpl.normalize(network_group, status)
    }
  },
}
