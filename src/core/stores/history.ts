import { NETWORK_ENV, safeStr } from "@hyperbridge-fe/shared"
import { format } from "date-fns"
import { computed, observable } from "mobx"
import { TxImpl } from "@/lib/factories/transaction"
import { getNetworkConfig } from "@/lib/utils"
import type { Transaction } from "@/types/tx"
import { createSearchAction } from "./shared"
import { TransactionStoreInstance } from "./tx-store"

export const activeSearchState = observable({ searchTerm: "" })
export const historySearchState = observable({ searchTerm: "" })

export const historySearchActions = createSearchAction(
  historySearchState,
  "searchTerm",
)

export const activeSearchActions = {
  setSearchTerm: (term: string) => {
    activeSearchState.searchTerm = term
  },
  clearSearch: () => {
    activeSearchState.searchTerm = ""
  },
}

/**
 * Core computation: Filters, sorts, and aggregates all relevant transactions
 */
const allTransactions = computed(() => {
  const { transactions, hash_sorted } = TransactionStoreInstance

  return hash_sorted
    .get()
    .map((hash) => transactions[hash])
    .filter((tx): tx is Transaction => {
      if (!tx) return false

      if (tx.networkEnv !== NETWORK_ENV) return false

      if (TxImpl.errors(tx).some((err) => err.kind === "InitError")) {
        return false
      }

      return true
    })
})

const completedTx = computed(() =>
  allTransactions.get().filter((tx) => tx.completed),
)
const pendingTx = computed(() =>
  allTransactions.get().filter((tx) => !tx.completed),
)

export const filteredCompletedTransactions = computed(() =>
  filterBySearch(completedTx.get(), historySearchState.searchTerm),
)

export const filteredPendingTransactions = computed(() =>
  filterBySearch(pendingTx.get(), activeSearchState.searchTerm),
)

/**
 * Helper: Validates if a transaction matches the search term
 */
function matchesSearchTerm(
  transaction: Transaction,
  searchTerm: string,
): boolean {
  if (!searchTerm) return true
  const lowerSearch = searchTerm.toLowerCase()
  const contains = (val?: string) =>
    val ? safeStr(val).toLowerCase().includes(lowerSearch) : false

  // Date Check
  const dateFormatted = format(transaction.createdAt, "MMMM d, yyyy")
  if (contains(dateFormatted)) return true

  if (
    contains(transaction.transaction_hash) ||
    contains(transaction.commitment_hash)
  ) {
    return true
  }

  const isTokenMatch = TxImpl.match(transaction, {
    transfer: (tx) => contains(tx.token.symbol),
    _: () => false,
  })
  if (isTokenMatch) return true

  const sourceNetwork = getNetworkConfig(transaction.source)
  const destNetwork = getNetworkConfig(transaction.destination)
  return contains(sourceNetwork?.name) || contains(destNetwork?.name)
}

/**
 * Helper: Filters a list of transactions by a search term
 */
function filterBySearch(
  transactions: Transaction[],
  searchTerm: string,
): Transaction[] {
  const term = safeStr(searchTerm).trim()
  if (!term) return transactions
  return transactions.filter((tx) => matchesSearchTerm(tx, term))
}

/**
 * Pagination Helpers
 */
export function getPaginatedCompletedTransactions(
  page: number = 0,
  pageSize: number = 50,
) {
  return paginate(filteredCompletedTransactions.get(), page, pageSize)
}

export function getPaginatedPendingTransactions(
  page: number = 0,
  pageSize: number = 50,
) {
  return paginate(filteredPendingTransactions.get(), page, pageSize)
}

function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize
  return items.slice(start, start + pageSize)
}
