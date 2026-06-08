import posthog from "posthog-js"
import { safeObj } from "../data.helpers"
import { shortenAccountAddress } from "../utils/formatting"
import { UserEventHelpers } from "./helper"
import type { UserEventTracking } from "./user-events"

export const PostHogAdapter: UserEventTracking = {
  set_session(payload: Partial<{ evm: string; polkadot: string }>) {
    const { evm, polkadot } = payload

    if (evm && polkadot) {
      posthog.identify(shortenAccountAddress(evm))
    }

    if (evm && !polkadot) {
      posthog.identify(shortenAccountAddress(evm))
    }

    if (polkadot && !evm) {
      posthog.identify(shortenAccountAddress(polkadot))
    }
  },

  start_transaction(type, payload) {
    const trace = UserEventHelpers.makeTrace({
      trace_id: crypto.randomUUID(),
      label: type,
    })

    posthog.capture(
      "transaction_prepare",
      UserEventHelpers.add_metadata({ ...safeObj(payload), trace }),
    )

    return trace
  },

  transaction_initialized(trace, { tx_hash }) {
    posthog.capture(
      "transaction_initialized",
      UserEventHelpers.add_metadata({
        tx_hash: tx_hash,
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },

  transaction_failed(trace, error) {
    posthog.capture(
      "transaction_failed",
      UserEventHelpers.add_metadata({
        error,
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },

  user_cancelled_tx(trace) {
    posthog.capture(
      "transaction_user_cancelled",
      UserEventHelpers.add_metadata({
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },

  transaction_complete(trace) {
    posthog.capture(
      "transaction_complete",
      UserEventHelpers.add_metadata({
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },

  transaction_funds_claimed(trace) {
    posthog.capture(
      "transaction_user_claimed_funds",
      UserEventHelpers.add_metadata({
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },

  transaction_funds_claim_failed(trace, error) {
    posthog.capture(
      "transaction_user_claim_failed",
      UserEventHelpers.add_metadata({
        error,
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },

  /*------------TIMEOUT--------------*/

  transaction_reversal_begin(trace) {
    posthog.capture(
      "transaction_reversal_begin",
      UserEventHelpers.add_metadata({
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },

  transaction_reversal_successful(trace) {
    posthog.capture(
      "transaction_reversal_successful",
      UserEventHelpers.add_metadata({
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },

  transaction_reversal_failed(trace, error) {
    posthog.capture(
      "transaction_reversal_failed",
      UserEventHelpers.add_metadata({
        error,
        trace,
        trace_id: trace.trace_id,
      }),
    )
  },
  /*------------END TIMEOUT--------------*/

  visit_socials(params) {
    posthog.capture("social_media_click", params)
  },
}
