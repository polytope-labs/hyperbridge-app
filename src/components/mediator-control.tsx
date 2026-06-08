import { Portal } from "@radix-ui/react-portal"
import { observer } from "mobx-react"
import { domAnimation, LazyMotion, m, type Variants } from "motion/react"
import React from "react"
import { Loader } from "@/components/common/Loader"
import { txMediator } from "@/config/services/tx-mediator.ts"
import { txPopup } from "@/stores/tx-preview"
import { TransactionStoreInstance } from "@/stores/tx-store"
import type { Transaction } from "@/types/tx"
import { TransactionDialog } from "@/components/transaction/integrated/dialog"

export const TxRemoteDialog = observer(function TxRemoteDialog() {
  React.useEffect(() => {
    return txPopup.subscribe({
      read_tx: (hash) => TransactionStoreInstance.get(hash),
      open: (hash) => {
        txMediator.addByHash(hash)
        txMediator.start(hash)
      },
      close: async () => {
        // await mediator.stop(hash)
        // mediator.unregister(hash)
      },
    })
  }, [])

  return (
    <Portal>
      <FloatingActiveTransactions />
      <TransactionDialog
        tx={txPopup.state.tx || ({} as Transaction)}
        open={txPopup.state.isOpen}
        onOpenChange={(open) => {
          if (open === false) {
            txPopup.close()
          }
        }}
      />
    </Portal>
  )
})

export const FloatingActiveTransactions = observer(
  function FloatingActiveTransactions() {
    const variants: Variants = {
      show: {
        opacity: 1,
        y: 0,
        transition: { type: "tween", ease: "anticipate" },
      },
      hide: { opacity: 0, y: -20 },
    }

    const active_txs = txMediator.active_transactions.get()
    const show_pill = active_txs.size > 0
    const active_txs_count = active_txs.size
    const active_txs_count_text =
      active_txs_count > 1 ? "active transactions" : "active transaction"

    return (
      <Portal>
        <div className="pointer-events-none fixed inset-0 z-[999] flex flex-col items-center justify-start p-[1rem]">
          <LazyMotion features={domAnimation}>
            <m.span
              variants={variants}
              initial={"hide"}
              animate={show_pill ? "show" : "hide"}
              className="bg-brand-black-500 text-caption pointer-events-auto z-50 flex items-center gap-2 rounded-full px-4 py-2"
            >
              <Loader />
              <span>
                {active_txs_count} {active_txs_count_text}
              </span>
            </m.span>
          </LazyMotion>
        </div>
      </Portal>
    )
  },
)
