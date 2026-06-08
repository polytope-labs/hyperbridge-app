import type { ChainId } from "@hyperbridge-fe/shared"
import type { TraceMeta } from "@/types/user-tracking"

export interface UserEventTracking extends Record<string, unknown> {
  set_session(payload: Partial<{ evm: string; polkadot: string }>): void

  /**
   * When a user submits a transaction before tracking
   *
   * @param payload
   */
  start_transaction(type: "inscription", payload?: undefined): TraceMeta
  start_transaction(
    type: "transfer",
    payload: {
      amount: string
      source: ChainId
      destination: ChainId
      token_symbol: string
    },
  ): TraceMeta

  /**
   * When an initalized the transaction in block
   *
   * @param trace
   * @param param1
   */
  transaction_initialized(
    tracing: TraceMeta,
    payload: { tx_hash: string },
  ): void

  /**
   * When a transaction fails inflight
   *
   * @param trace
   * @param error
   */
  transaction_failed(tracing: TraceMeta, error: unknown): void

  transaction_funds_claimed(tracing: TraceMeta): void
  transaction_funds_claim_failed(trace: TraceMeta, error: unknown): void
  transaction_complete(trace: TraceMeta): void

  transaction_reversal_begin(trace: TraceMeta): void
  transaction_reversal_successful(trace: TraceMeta): void
  transaction_reversal_failed(trace: TraceMeta, error: unknown): void

  /**
   * When a User cancels a transaction
   * @param trace
   */
  user_cancelled_tx(tracing: TraceMeta): void

  visit_socials(params: { label: "twitter" | "telegram" | "discord" }): void
}
