import { createContext, useContext } from "react"
import type { TransactionProgressController } from "@/lib/transactions/progress-controller"
import type { TimelineNode, Transaction, TxMode } from "@/types/tx"

export interface TxTimelineContextType {
  tx: Transaction
  mode: TxMode
  flow: TimelineNode[]
  controller: TransactionProgressController
}

export const TxTimelineContext = createContext<
  TxTimelineContextType | undefined
>(undefined)

export const useTxTimeline = () => {
  const context = useContext(TxTimelineContext)

  if (context === undefined) {
    throw new Error("useTxTimeline must be used within a TxTimelineProvider")
  }

  return context
}
