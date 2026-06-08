import { type NetworkConfig, safeArray } from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Match, pipe } from "effect"
import type { TransactionStore } from "@/stores/tx-store"
import type {
  Transaction,
  TxCreationEvents,
  TxResumptionPayload,
} from "@/types/tx"
import { getErrorMessage } from "../error.helpers"
import { TxImpl } from "../factories/transaction"
import { IndexerQuery } from "../hyperbridge-indexer"
import { O } from "../utils/fp.helpers"
import { resolveTxError } from "./bridge-evm"
import { resumeEvmHftTx } from "./bridge-hft"
import { PolkadotBridgeTx } from "./bridge-polkadot"

export const makeResumption = (params: { store: TransactionStore }) => {
  const { store } = params

  /** Adds the events from a Resumable transaction */
  function recordEvent(event: TxCreationEvents): void {
    if (event.kind === "Error") {
      throw new Error(getErrorMessage(resolveTxError(event.error).error))
    }

    if (event.kind === "InBlock") {
      store.progressRequest(event.transaction_hash, {
        kind: "Dispatched",
        block_number: event.block_number,
      })
    }

    if (event.kind === "Finalized") {
      store.progressRequest(event.transaction_hash, {
        kind: "Dispatched",
        block_number: 0n,
      })
    }

    if (event.kind === "CommitmentHash") {
      const tx = store.transactions[event.transaction_hash]

      if (!TxImpl.has_commitment(tx)) {
        tx.commitment_hash = event.commitment_hash
      }
    }

    if (event.kind === "IPostRequest") {
      store.transactions[event.transaction_hash].request = event.request
    }

    if (event.kind === "Verified") {
      // Only for Polkadot
      store.progressRequest(event.transaction_hash, {
        kind: "HyperbridgeVerified",
        block_hash: event.block_hash,
        block_number: event.block_number,
        transaction_hash: "0x",
      })
    }
  }

  return {
    recordEvent,

    /** @todo Test this function */
    read(transaction: Transaction) {
      const match = safeArray(transaction.meta).find(
        (e) => (e as TxResumptionPayload)?.type === "resumption_params",
      )

      if (!match) return O.none()

      if (!("originalParams" in transaction)) {
        return O.none()
      }

      return O.some(match as TxResumptionPayload)
    },

    async *resumeTx(params: {
      source: NetworkConfig
      transaction: Transaction
      payload: TxResumptionPayload
    }) {
      const { source, transaction, payload } = params

      const events = await pipe(
        Match.value([payload, source]),
        Match.when(
          [{ network: "evm" }, { group: "evm" }],
          async ([payload, network]) => {
            return resumeEvmHftTx({
              transaction_hash: payload.transaction_hash,
              sourceChain: network.chainId,
            })
          },
        ),
        Match.when(
          [{ network: "relay" }, { group: "relay" }],
          async ([payload, relay]) => {
            return PolkadotBridgeTx.resume({
              ...transaction.originalParams,
              ...payload,
              source: relay.chainId,
              queryClient: IndexerQuery.singleton(),
            })
          },
        ),
        Match.orElse(() => {
          return Promise.reject(
            new Error("Unable to resolve Transaction Resumption handler"),
          )
        }),
      )

      for await (const event of events) {
        if (event.kind === "Error") {
          // @todo: Add test case
          if (event.transaction_hash) {
            store.setError(event.transaction_hash, resolveTxError(event.error))
          }
        }

        yield event
      }
    },

    /** Prepares a transaction for continuation */
    prepare(
      source: NetworkConfig,
      event: TxCreationEvents,
      params: {
        write: (event: Extract<TxCreationEvents, { kind: "Ready" }>) => void
        writeError: (
          event: Required<Extract<TxCreationEvents, { kind: "Error" }>>,
        ) => void
        navigate: (
          event: Extract<
            TxCreationEvents,
            { kind: "Ready" | "CommitmentHash" }
          >,
        ) => void
        complete: () => void
      },
    ) {
      if (event.kind === "Error") {
        const safe_hash = O.fromNullable(event?.transaction_hash)

        if (O.isSome(safe_hash)) {
          params.writeError({
            kind: "Error",
            error: event.error,
            transaction_hash: safe_hash.value,
          })
        }

        throw new Error(getErrorMessage(resolveTxError(event.error).error))
      }

      if (event.kind === "Ready") {
        params.write(event)
      }

      NetworkImpl.match(source, {
        substrate: () => {
          // Substrate can't resume so this needs
          // to be handled here instead of the next page
          recordEvent(event)

          if (event.kind === "CommitmentHash") {
            params.complete()
            params.navigate(event)
          }
        },
        relay: () => {
          recordEvent(event)

          if (event.kind === "Ready") {
            params.complete()
            params.navigate(event)
          }
        },
        _: () => {
          if (event.kind === "Ready") {
            params.complete()
            params.navigate(event)
          }
        },
      })
    },
  }
}
