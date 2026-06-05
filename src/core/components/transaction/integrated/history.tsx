import {
  EmptyState,
  EmptyStateConceal,
  EmptyStateContent,
  Text,
  TxList,
  TxListItem,
  TxListItemProcessing,
} from "@hyperbridge/ui"
import { ArtifactNews } from "@hyperbridge/ui/icons"
import { resolvePublicUrl } from "@hyperbridge-fe/shared/lib"
import { format, fromUnixTime } from "date-fns"
import isMobile from "is-mobile"
import { toJS } from "mobx"
import { observer } from "mobx-react"
import { useCallback, useMemo } from "react"
import type { ListChildComponentProps } from "react-window"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  AutoSizer,
  ScrollWindowingArea,
} from "@/components/ui/scroll-windowing-area"
import { DebugClick } from "@/components/utils/debug-click"
import { TxImpl } from "@/lib/factories/transaction"
import { getTokenInfo } from "@/lib/network.helpers"
import { getTransactionEta } from "@/lib/tx.helpers"
import { getNetworkConfig } from "@/lib/utils"
import { toSeconds } from "@/lib/utils/date.helpers"
import { shortValueFormatter } from "@/lib/utils/formatting"
import {
  activeSearchState,
  filteredCompletedTransactions,
  filteredPendingTransactions,
  historySearchState,
} from "@/stores/history"
import type { Transaction } from "@/types/tx"
import { TransactionDialogTrigger } from "./dialog"

const HEADER_HEIGHT = 28
const ITEM_HEIGHT = 72
const is_mobile = isMobile()

interface GroupedTxItem {
  type: "HEADER" | "ITEM"
  label?: string
  key: string
  transaction?: Transaction
}

interface TxDisplayData {
  amount: string
  receiverAmount: string
  tokenSymbol: string
  tokenImage: string
}

/**
 * Group transactions by day for display in the history list
 */
function* groupByDay(txs: Transaction[]): Generator<GroupedTxItem> {
  let last: string | null = null
  let idx = 0

  for (const tx of txs) {
    const day = format(tx.createdAt, "MMMM d, yyyy")

    if (last !== day) {
      last = day
      yield {
        type: "HEADER",
        label: day,
        key: `${day}-${idx++}`,
      }
    }

    yield {
      type: "ITEM",
      transaction: tx,
      key: tx.transaction_hash,
    }
  }
}

function extractTxDisplayData(
  transaction: Transaction,
  isActiveView = false,
): TxDisplayData {
  return TxImpl.match(transaction, {
    transfer: (transfer) => {
      const token = TxImpl.token(transfer)
      const tokenInfo = getTokenInfo(token.symbol)

      const formattedAmount = isActiveView
        ? shortValueFormatter.format(transfer.protocol.amount)
        : Number(transfer.protocol.amount).toLocaleString(undefined, {
            roundingMode: "floor",
            maximumFractionDigits: 3,
          })

      return {
        amount: formattedAmount,
        receiverAmount: formattedAmount,
        tokenSymbol: token.symbol,
        tokenImage: tokenInfo.imageUrl,
      }
    },
    _: () => {
      return {
        amount: "0",
        receiverAmount: "0",
        tokenSymbol: "Unknown",
        tokenImage: resolvePublicUrl("/tokens/unknown.svg"),
      }
    },
  })
}

/**
 * Row renderer for react-window list
 */
function HistoryRow({
  index,
  style,
  data,
}: ListChildComponentProps<GroupedTxItem[]>) {
  const item = data[index]

  if (item.type === "HEADER") {
    return (
      <div className="*:w-full" style={style}>
        <div className="text-caption text-brand-black-100 select-none font-normal">
          {item.label}
        </div>
      </div>
    )
  }

  if (item.type === "ITEM" && item.transaction) {
    return (
      <div className="*:w-full" style={style}>
        <HistoryItem transaction={item.transaction} />
      </div>
    )
  }

  return null
}

function EmptyMessage({
  searchState,
  pending = false,
}: {
  searchState: typeof activeSearchState | typeof historySearchState
  pending?: boolean
}) {
  return (
    <div className="text-foreground-muted mb-20 mt-10 flex flex-col items-center justify-center gap-2">
      <ArtifactNews
        width="1.5rem"
        height="1.5rem"
        className="text-brand-black-100"
      />
      <Text variant="caption" className="text-brand-black-100 font-medium!">
        {searchState.searchTerm
          ? "No transactions found matching your search"
          : pending
            ? "You have no active transactions"
            : "You have no transactions to display yet"}
      </Text>
    </div>
  )
}

export const TxHistory = observer(function TxHistory() {
  const filteredCompleted = filteredCompletedTransactions.get()
  const isEmpty = filteredCompleted.length === 0

  return (
    <section className="flex flex-1 flex-col">
      <EmptyState isEmpty={isEmpty}>
        <EmptyStateConceal>
          <HistoricalTransactions />
        </EmptyStateConceal>

        <EmptyStateContent className="flex flex-1 flex-col justify-center">
          <EmptyMessage searchState={historySearchState} />
        </EmptyStateContent>
      </EmptyState>
    </section>
  )
})

export const ActiveTxs = observer(function ActiveTxs() {
  const filteredPending = filteredPendingTransactions.get()
  const isEmpty = filteredPending.length === 0

  return (
    <section className="flex flex-1 flex-col">
      <EmptyState isEmpty={isEmpty}>
        <EmptyStateConceal>
          <ActiveTransactions />
        </EmptyStateConceal>

        <EmptyStateContent className="flex flex-1 flex-col justify-center">
          <EmptyMessage searchState={activeSearchState} pending />
        </EmptyStateContent>
      </EmptyState>
    </section>
  )
})

const ActiveTransactions = observer(function ActiveTransactions() {
  const pendingTxs = filteredPendingTransactions.get()
  const groupedPending = useMemo(
    () => Array.from(groupByDay(pendingTxs)),
    [pendingTxs],
  )

  if (groupedPending.length === 0) return null

  return (
    <AutoSizer>
      {(dim) => (
        <div style={{ height: `${dim.height}px` }}>
          <ScrollArea className="h-full overflow-y-auto">
            <div className="pb-8">
              <TxList>
                {groupedPending.map((item) => {
                  if (item.type === "HEADER") {
                    return (
                      <div key={item.key}>
                        <div className="text-caption text-brand-black-100 select-none font-normal">
                          {item.label}
                        </div>
                      </div>
                    )
                  }

                  if (item.type === "ITEM" && item.transaction) {
                    return (
                      <ActiveHistoryItem
                        key={item.transaction.transaction_hash}
                        transaction={item.transaction}
                      />
                    )
                  }

                  return null
                })}
              </TxList>
            </div>
          </ScrollArea>
        </div>
      )}
    </AutoSizer>
  )
})

const HistoricalTransactions = observer(function HistoricalTransactions() {
  const filteredCompleted = filteredCompletedTransactions.get()
  const totalTransactions = filteredCompleted.length
  const virtualizedTxs = useMemo(
    () => Array.from(groupByDay(filteredCompleted)),
    [filteredCompleted],
  )

  const listKey = `${virtualizedTxs.length}-${totalTransactions}`

  const getItemSize = useCallback(
    (index: number) => {
      const item = virtualizedTxs[index]
      if (item.type === "ITEM") return ITEM_HEIGHT
      if (item.type === "HEADER") return HEADER_HEIGHT
      return 0
    },
    [virtualizedTxs],
  )

  if (totalTransactions === 0) return null

  return (
    <AutoSizer className="flex">
      {(dim) => (
        <div key={listKey} style={{ height: `${dim.height}px` }}>
          <ScrollArea className="h-full overflow-y-auto">
            <ScrollWindowingArea
              className="pb-5"
              key={`${listKey}-${historySearchState.searchTerm}`}
              width={dim.width}
              height={dim.height}
              itemCount={virtualizedTxs.length}
              itemSize={getItemSize}
              itemData={virtualizedTxs}
              itemKey={(index, data) => data[index].key}
            >
              {HistoryRow}
            </ScrollWindowingArea>
          </ScrollArea>
        </div>
      )}
    </AutoSizer>
  )
})

const HistoryItem = observer(function HistoryItem({
  transaction,
}: {
  transaction: Transaction
}) {
  const sourceNetwork = getNetworkConfig(transaction.source)
  const destNetwork = getNetworkConfig(transaction.destination)
  const transactionData = useMemo(
    () => extractTxDisplayData(transaction, false),
    [transaction],
  )

  const completedAt = format(
    fromUnixTime(toSeconds(transaction.createdAt)),
    "h:mm a",
  )

  const size = is_mobile ? "1.35rem" : "2rem"
  const caption = `${transactionData.tokenSymbol} to ${transactionData.tokenSymbol}`
  const amount = `${transactionData.amount} ${!is_mobile ? transactionData.tokenSymbol : ""}`
  const mode = TxImpl.infer_mode(transaction)

  return (
    <DebugClick input={() => ({ tx: toJS(transaction) })}>
      <div>
        <TransactionDialogTrigger tx_hash={transaction.transaction_hash}>
          <TxListItem
            mode={mode}
            className="w-full cursor-pointer"
            amount={amount}
            caption={caption}
            completedAt={completedAt}
            from={{
              badgeSrc: sourceNetwork?.logo || resolvePublicUrl("/tokens/unknown.svg"),
              badgeAlt: sourceNetwork?.name || "Unknown Network",
              src: transactionData.tokenImage,
              alt: transactionData.tokenSymbol,
            }}
            to={{
              badgeSrc: destNetwork?.logo || resolvePublicUrl("/tokens/unknown.svg"),
              badgeAlt: destNetwork?.name || "Unknown Network",
              src: transactionData.tokenImage,
              alt: transactionData.tokenSymbol,
            }}
            size={size}
          />
        </TransactionDialogTrigger>
      </div>
    </DebugClick>
  )
})

const ActiveHistoryItem = observer(function ActiveHistoryItem({
  transaction: tx,
}: {
  transaction: Transaction
}) {
  const sourceNetwork = getNetworkConfig(tx.source)
  const destNetwork = getNetworkConfig(tx.destination)
  const transactionData = useMemo(() => extractTxDisplayData(tx, true), [tx])

  const progressPercentage = TxImpl.percent_progress(tx)
  const eta = sourceNetwork ? getTransactionEta(tx, sourceNetwork) : ""
  const size = is_mobile ? "1.35rem" : "2rem"
  const caption = `${transactionData.tokenSymbol} to ${transactionData.tokenSymbol}`
  const amount = `${transactionData.amount} ${!is_mobile ? transactionData.tokenSymbol : ""}`

  return (
    <TransactionDialogTrigger tx_hash={tx.transaction_hash}>
      <DebugClick input={() => ({ tx: toJS(tx) })}>
        <div className="flex cursor-pointer *:flex-1">
          <TxListItemProcessing
            amount={amount}
            caption={caption}
            status={TxImpl.is_timed_out(tx) ? "failed" : "processing"}
            from={{
              badgeSrc: sourceNetwork?.logo || resolvePublicUrl("/tokens/unknown.svg"),
              badgeAlt: sourceNetwork?.name || "Unknown Network",
              src: transactionData.tokenImage,
              alt: transactionData.tokenSymbol,
            }}
            to={{
              badgeSrc: destNetwork?.logo || resolvePublicUrl("/tokens/unknown.svg"),
              badgeAlt: destNetwork?.name || "Unknown Network",
              src: transactionData.tokenImage,
              alt: transactionData.tokenSymbol,
            }}
            eta={String(eta)}
            percentage={progressPercentage}
            size={size}
          />
        </div>
      </DebugClick>
    </TransactionDialogTrigger>
  )
})
