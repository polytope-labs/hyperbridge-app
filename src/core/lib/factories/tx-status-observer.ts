import type { IsmpClient, RequestStatusWithMetadata } from "@hyperbridge/sdk"
import { safeArray } from "@hyperbridge-fe/shared"
import type { Maybe } from "@hyperbridge-fe/shared/types"
import { TxImpl } from "@/lib/factories/transaction.ts"
import { TxNormalizer } from "@/lib/factories/tx-normalizer.ts"
import { rootLogger } from "@/lib/logger"
import { delay } from "@/lib/utils/async.helpers.ts"
import type { Transaction } from "@/types/tx"
import type { TxEvent } from "@/types/tx-event"
import { O } from "../utils/fp.helpers"

export const StatusEventObserver = {
  logger: rootLogger.withTag("StatusEventObserver"),

  /**
   * Look for when Timeout Progression begins. Timeout may be triggered from the Explorer
   *
   * @param params
   * @returns
   */
  async watchForTimeoutProgress(params: {
    interval?: number
    signal: AbortSignal
    client: IsmpClient
    transaction: Transaction
    handler: (event: TxEvent) => void
  }) {
    const { client, transaction } = params

    const normalize = TxNormalizer.forIndexerStatus(transaction)
    const getEvents = async () => {
      const hash = await this.waitForCommitment(params)
      if (!hash) return []

      const request = await client.queryRequestWithStatus(hash)
      return safeArray(request?.statuses)
    }

    await StatusEventObserver._watchUntilTimeoutBegins({
      signal: params.signal,
      getEvents,
      interval: params.interval,
      handler: (event) => {
        params.handler(normalize(event))
      },
    })
  },

  async waitForCommitment(params: {
    transaction: Transaction
    interval?: number
    signal: AbortSignal
  }) {
    const { signal, interval = 5000 } = params
    const _logger = this.logger.withTag("waitForCommitment")

    const hash = TxImpl.commitment(params.transaction)
    if (O.isSome(hash)) return hash.value

    let total_wait_time = 0

    while (true) {
      if (signal.aborted) {
        _logger.trace("aborted")
        break
      }

      if (total_wait_time > 60_000) {
        _logger.warn(
          "Commitment wait time is longer than expected. Expecting 60s",
        )
      }

      const hash = TxImpl.commitment(params.transaction)

      if (O.isSome(hash)) {
        _logger.trace("Commitment hash found")
        return hash.value
      }

      _logger.trace("Waiting for commitment...")
      await delay(interval)
      total_wait_time += interval
    }
  },

  async _watchUntilTimeoutBegins(params: {
    interval?: number
    signal: AbortSignal
    handler: (event: RequestStatusWithMetadata) => void
    getEvents: () => Promise<RequestStatusWithMetadata[]>
  }) {
    const { handler, ..._params } = params
    await this.waitUntil({
      ..._params,
      handler: (event) => {
        if (event.status === "PENDING_TIMEOUT") return

        // wait until the first time out event is present
        if (event.status.includes("_TIMEOUT")) {
          handler(event)
          return "success"
        }

        if (event.status.includes("TIMED_OUT")) {
          handler(event)
          return "success"
        }
      },
    })
  },

  async waitUntil(params: {
    interval?: number
    signal: AbortSignal
    handler: (event: RequestStatusWithMetadata) => Maybe<"success">
    getEvents: () => Promise<RequestStatusWithMetadata[]>
  }) {
    const { getEvents, signal, handler, interval = 5000 } = params

    while (true) {
      if (signal.aborted) {
        break
      }

      const latest_events = await getEvents()

      for (const event of latest_events) {
        if (handler(event) === "success") {
          return
        }
      }

      await delay(interval)
    }
  },
}
