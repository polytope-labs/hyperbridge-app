import { isRelayChain, matchChain } from "@hyperbridge-fe/shared"
import { Match } from "effect"
import { JSONParse } from "json-with-bigint"
import {
  computed,
  makeAutoObservable,
  type ObservableSet,
  observable,
  runInAction,
} from "mobx"
import { makePersistable } from "mobx-persist-store"
import { safeArray } from "@/lib/data.helpers"
import { TxImpl } from "@/lib/factories/transaction"
import { TxEventImpl, TxWriteImpl } from "@/lib/factories/tx-event"
import { TxNormalizer } from "@/lib/factories/tx-normalizer.ts"
import { rootLogger as root_logger } from "@/lib/logger"
import { safeJSONParse } from "@/lib/transform.helpers.ts"
import { O, pipe } from "@/lib/utils/fp.helpers"
import type {
  HexString,
  RollbackEvent,
  SendEvent,
  Transaction,
  TxError,
} from "@/types/tx"
import type { TxEvent } from "@/types/tx-event"

type TransactionStoreMetadata = {
  lastSortLength: number
  indexerRevision: number
}

type TransactionStorePersistedState = Pick<
  TransactionStore,
  "transactions" | "hashes" | "metadata"
>

const METADATA_DEFAULTS: TransactionStoreMetadata = {
  lastSortLength: 0,
  indexerRevision: 0,
}

const logger = root_logger.withTag("TransactionStore")

export class TransactionStore {
  constructor() {
    makeAutoObservable(this)
    if (typeof window !== "undefined") {
      makePersistable<
        TransactionStorePersistedState,
        keyof TransactionStorePersistedState
      >(this, {
        name: "TransactionStore",
        properties: [
          {
            key: "transactions",
            serialize: (value: { [key: HexString]: Transaction }) => {
              const globalTxs: { [key: HexString]: Transaction } = {}
              for (const [hash, tx] of Object.entries(value)) {
                if (!this.indexerHashes.has(hash as HexString)) {
                  globalTxs[hash as HexString] = tx
                }
              }

              return JSON.stringify(globalTxs, (_key, val) =>
                typeof val === "bigint" ? val.toString() : val,
              )
            },
            deserialize: (value) => JSONParse(value),
          },
          {
            key: "hashes",
            serialize: (value: unknown) => {
              let allHashes: HexString[] = []
              if (Array.isArray(value)) {
                allHashes = value
              } else if (
                value instanceof Set ||
                (value &&
                  typeof value === "object" &&
                  Symbol.iterator in value &&
                  "has" in value)
              ) {
                allHashes = Array.from(value as Iterable<HexString>)
              } else {
                return JSON.stringify([])
              }

              const globalHashes = allHashes.filter(
                (h) => !this.indexerHashes.has(h),
              )
              return JSON.stringify(globalHashes)
            },
            deserialize: (value: string) => {
              return observable(
                new Set<HexString>(safeArray(JSON.parse(value))),
              )
            },
          },
          {
            key: "metadata",
            serialize: (value: TransactionStoreMetadata) =>
              JSON.stringify(value),
            deserialize: (value: string) =>
              safeJSONParse(value, METADATA_DEFAULTS),
          },
        ],
        stringify: true,
        storage: window.localStorage,
      })
    }
  }

  transactions: { [key: HexString]: Transaction } = {}

  indexerHashes: ObservableSet<HexString> = observable.set(new Set([]), {
    deep: false,
  })

  metadata: TransactionStoreMetadata = METADATA_DEFAULTS

  hashes: ObservableSet<HexString> = observable.set(new Set([]), {
    deep: false,
  })

  /**
   * Optimized computed property for sorted hashes
   */
  hash_sorted = computed(() => {
    const sorted = Array.from(this.hashes).sort((a, b) => {
      const txA = this.transactions[a]
      const txB = this.transactions[b]
      const timeA = txA?.createdAt || 0
      const timeB = txB?.createdAt || 0
      return timeB - timeA
    })

    return sorted
  })

  normalize(tx_hash: HexString): void {
    runInAction(() => {
      return pipe(
        O.fromNullable(this.transactions[tx_hash]),
        O.map((tx) => {
          if (TxNormalizer.is_corrupted(tx)) {
            this.transactions[tx_hash] = TxNormalizer.normalize_observable(tx)
          }
        }),
        O.getOrNull,
      )
    })
  }

  get(tx_hash: HexString): Transaction {
    this.normalize(tx_hash)
    return this.transactions[tx_hash]
  }

  hasTransaction(txHash: string): boolean {
    return this.hashes.has(txHash as HexString)
  }

  /**
   * Get all transactions without sorting (for processing)
   */
  getAllTransactions(): Transaction[] {
    return Array.from(this.hashes).map((hash) => this.transactions[hash])
  }

  /**
   * Add a new transaction to the store
   */
  addTransaction(tx: Transaction) {
    runInAction(() => {
      this.transactions[tx.transaction_hash] = tx
      this.hashes.add(tx.transaction_hash)
    })
  }

  /**
   * Batch add transactions with single MobX transaction
   */
  addTransactionsBatch(transactions: Transaction[]) {
    runInAction(() => {
      for (const tx of transactions) {
        if (!this.hashes.has(tx.transaction_hash)) {
          this.transactions[tx.transaction_hash] = tx
          this.hashes.add(tx.transaction_hash)
        }
      }
    })
  }

  /**
   * Add transactions from indexer (will NOT be persisted to global store)
   */
  addIndexerTransactionsBatch(transactions: Transaction[]) {
    runInAction(() => {
      for (const tx of transactions) {
        if (!this.hashes.has(tx.transaction_hash)) {
          this.transactions[tx.transaction_hash] = tx
          this.hashes.add(tx.transaction_hash)

          this.indexerHashes.add(tx.transaction_hash)
        }
      }
    })
  }

  /**
   * Clear all indexer transactions (used when switching accounts)
   */
  clearIndexerTransactions() {
    runInAction(() => {
      const hashesToRemove = Array.from(this.indexerHashes)
      for (const hash of hashesToRemove) {
        delete this.transactions[hash]
        this.hashes.delete(hash)
      }
      this.indexerHashes.clear()
    })
  }

  progressTimedOutRequest(
    hash: HexString,
    original_event: RollbackEvent | TxEvent,
  ) {
    const transaction = this.transactions[hash]

    if (!transaction) return

    const write_state = pipe(
      Match.value(original_event),
      Match.when({ __tag: "TxEvent", __path: "rollback" }, () => "proceed"),
      Match.when({ kind: Match.string }, () => "proceed"),
      Match.orElse(() => "skip"),
    )

    if (write_state === "skip") {
      logger.warn(
        "Unexpected Event in progressTimedOutRequest",
        original_event.kind,
        original_event,
      )

      return
    }

    const get_final_step_key = () =>
      matchChain(transaction.source, {
        relay: () => "HyperbridgeVerified" as const,
        none: () => "Receipt" as const,
      })

    const event: RollbackEvent =
      original_event.kind === "TimedOut"
        ? ({ ...original_event, kind: get_final_step_key() } as RollbackEvent)
        : (original_event as RollbackEvent)

    const read_missed_events = TxWriteImpl.advance_past_missed_status({
      mode: "rollback",
      flow: [
        "DestinationFinalized",
        "HyperbridgeVerified",
        "HyperbridgeFinalized",
        "Receipt",
      ],
    })

    const missed_events = Object.fromEntries(
      read_missed_events(transaction, event),
    )

    runInAction(() => {
      transaction.timeoutProgress = {
        ...transaction.timeoutProgress,
        ...missed_events,
      }

      switch (event.kind) {
        case "DestinationFinalized": {
          if (event.finalized_height !== 0n) {
            this.transactions[hash].timeout.push({
              DestinationFinalized: event.finalized_height,
            })
          }
          break
        }
        case "HyperbridgeVerified": {
          if (event.block_number !== 0n) {
            this.transactions[hash].timeout.push({
              HyperbridgeVerified: event.block_number,
            })
          }
          break
        }
      }

      const timestamp = readTimestamp(event)
      this.transactions[hash].timeoutProgress[event.kind] = TxWriteImpl.create(
        "stream",
        {
          status: event,
          timestamp: timestamp,
        },
      )

      if (
        event.kind === "Receipt" ||
        (isRelayChain(transaction.source) &&
          event.kind === "HyperbridgeVerified")
      ) {
        this.transactions[hash].completed = true
      }
    })
  }

  progressRequest(
    hash: HexString,
    status: SendEvent,
    opts: ProgressOption = {
      overwrite: false,
    },
  ): void {
    const transaction = this.transactions[hash]

    if (!transaction) return

    if (!opts.overwrite) {
      if (TxImpl.progress_contains(transaction, status.kind)) {
        return
      }
    }

    const read_missed_events = TxWriteImpl.advance_past_missed_status({
      mode: "send",
      flow: [
        "Dispatched",
        "SourceFinalized",
        "HyperbridgeVerified",
        "HyperbridgeFinalized",
        "DestinationDelivered",
      ],
    })

    const missed_events = Object.fromEntries(
      read_missed_events(transaction, status),
    )

    runInAction(() => {
      transaction.progress = {
        ...transaction.progress,
        ...missed_events,
      }

      switch (status.kind) {
        case "Dispatched": {
          if (status.block_number !== 0n) {
            this.transactions[hash].inflight.push({
              Dispatched: status.block_number,
            })
          }
          break
        }
        case "SourceFinalized": {
          if (status.finalized_height !== 0n) {
            this.transactions[hash].inflight.push({
              SourceFinalized: status.finalized_height,
            })
          }
          break
        }
        case "HyperbridgeVerified": {
          if (status.block_number !== 0n) {
            this.transactions[hash].inflight.push({
              HyperbridgeVerified: status.block_number,
            })
          }
          break
        }
        case "HyperbridgeFinalized": {
          if (status.finalized_height !== 0n) {
            this.transactions[hash].inflight.push({
              HyperbridgeFinalized: status.finalized_height,
            })
          }
          break
        }
        case "Timeout": {
          if (!isRelayChain(transaction.destination)) {
            this.transactions[hash].timeout.push("Pending")
          }
          this.transactions[hash].status = "Timeout"
          break
        }
      }

      const timestamp = readTimestamp(status)
      const tx_status = TxWriteImpl.create("stream", {
        status,
        timestamp: timestamp,
      })

      this.transactions[hash].status = status.kind
      this.transactions[hash].progress[status.kind] = tx_status

      if (
        status.kind === "DestinationDelivered" ||
        (isRelayChain(transaction.destination) &&
          status.kind === "HyperbridgeVerified")
      ) {
        this.transactions[hash].completed = true
      }
    })
  }

  setError(hash: HexString, error: TxError) {
    runInAction(() => {
      const tx = this.get(hash)

      if (!tx) {
        logger.warn("Error recording `TxError` in store. Tx not found")
        return
      }

      const errors = safeArray<TxError>(tx.errors)
      tx.errors = [...errors, error]
    })
  }
}

function readTimestamp(status: SendEvent | TxEvent | RollbackEvent) {
  return pipe(
    TxEventImpl.timestamp(status),
    O.getOrElse(() => {
      console.assert(
        false,
        "LegacyBehaviour: using current timestamp. Expected timestamp from TxEvent",
        { event: status },
      )

      return Date.now()
    }),
  )
}

type ProgressOption = {
  overwrite: boolean
}

export const TransactionStoreInstance = new TransactionStore()
