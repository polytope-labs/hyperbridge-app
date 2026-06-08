import { NETWORK_ENV } from "@/config/constants.ts"
import { rootLogger } from "@/lib/logger"
import { Resumption } from "@/lib/transactions/resumption.ts"
import type { BridgeTxExecutor } from "@/lib/transactions/types.ts"
import { UserTracking } from "@/lib/user-tracking"
import type { TransactionStoreInstance } from "@/stores/tx-store.ts"
import type { NetworkConfig } from "@/types"
import type { TxCreationEvents } from "@/types/tx"
import type { HexString } from "@/types/web3"
import { O } from "./utils/fp.helpers"

export async function* makeTransferPure(transfer_params: {
  trigger: BridgeTxExecutor
  source: NetworkConfig
  events: {
    handleNavigation: (
      payload: Extract<TxCreationEvents, { kind: "Ready" | "CommitmentHash" }>,
    ) => void
  }
  store: typeof TransactionStoreInstance
}) {
  const { trigger, source: network, events, store } = transfer_params

  const params = trigger.params.bridgeParams
  const trace_meta = UserTracking.start_transaction("transfer", {
    source: params.source,
    amount: String(params.amount),
    destination: params.destination,
    token_symbol: params.token.symbol,
  })

  let written_to_store: O.Option<{ transaction_hash: HexString }> = O.none()

  // initiate the relevant transaction
  try {
    for await (const event of trigger.execute()) {
      Resumption.prepare(network, event, {
        write: (event) => {
          UserTracking.transaction_initialized(trace_meta, {
            tx_hash: event.transaction_hash,
          })

          store.addTransaction({
            transaction_hash: event.transaction_hash,
            protocol: {
              kind: "Transfer",
              amount: Number(trigger.params.formatted_amount),
            },
            source: params.source,
            destination: params.destination,
            token: params.token,
            relayerFee: params.relayerFee.amount,
            progress: {},
            timeoutProgress: {},
            completed: false,
            createdAt: Date.now(),
            status: "Pending",
            inflight: [],
            timeout: [],
            errors: [],
            meta: event.meta,
            originalParams: params,
            networkEnv: NETWORK_ENV,
            commitment_hash: undefined,
            tracing: trace_meta,
          })

          written_to_store = O.some({
            transaction_hash: event.transaction_hash,
          })
        },
        writeError: (event) => {
          rootLogger.error("Transfer Initialization Error:", event.error)
          UserTracking.transaction_failed(trace_meta, event.error)
          store.setError(event.transaction_hash, {
            kind: "InitError",
            error: event.error,
            timestamp: Date.now(),
          })
        },
        navigate: (event) => {
          events.handleNavigation(event)
        },
        complete: () => {},
      })

      yield event
    }
  } catch (err) {
    if (O.isSome(written_to_store)) {
      store.setError(written_to_store.value.transaction_hash, {
        kind: "InitError",
        error: err,
        timestamp: Date.now(),
      })
    }

    throw err
  }
}
