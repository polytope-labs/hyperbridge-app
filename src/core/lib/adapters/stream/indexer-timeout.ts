import { type IsmpClient, TimeoutStatus } from "@hyperbridge/sdk"
import { pipe } from "effect"
import { isNil } from "lodash-es"
import { safeArray } from "@/lib/data.helpers"
import { TxImpl } from "@/lib/factories/transaction"
import { TxNormalizer } from "@/lib/factories/tx-normalizer.ts"
import type { StreamClient } from "@/lib/tracker"
import { O } from "@/lib/utils/fp.helpers"
import type { AppTimeoutEventMeta, HexString, Transaction } from "@/types/tx"

export class IndexerTimeoutStream implements StreamClient<AppTimeoutEventMeta> {
  client: IsmpClient
  transaction: Transaction

  constructor({
    client,
    transaction,
  }: {
    client: IsmpClient
    transaction: Transaction
  }) {
    this.client = client
    this.transaction = transaction
  }

  /** Retreives transaction commitment hash */
  get hash(): HexString {
    const error = () => {
      throw new Error("IndexerTimeoutStream: `commitment_hash` required")
    }

    return pipe(TxImpl.commitment(this.transaction), O.getOrThrowWith(error))
  }

  get normalize_event() {
    return TxNormalizer.forIndexerStatus(this.transaction)
  }

  async read_last_status() {
    const request = await this.client.queryRequestWithStatus(this.hash)
    const last_event = safeArray(request?.statuses).at(-1)

    if (!last_event) return { kind: "None" as const }

    return this.normalize_event(last_event)
  }

  async *read_past_events() {
    const request = await this.client.queryRequestWithStatus(this.hash)

    if (isNil(request)) return

    const events = request.statuses

    for (const event of events) {
      if (event.status in TimeoutStatus) {
        yield this.normalize_event(event)
      }
    }
  }

  async *start(): AsyncGenerator<AppTimeoutEventMeta> {
    const events = this.client.postRequestTimeoutStream(this.hash)
    for await (const event of events) {
      yield this.normalize_event(event) as AppTimeoutEventMeta
    }
  }
}
