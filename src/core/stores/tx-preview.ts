import type { HexString } from "@hyperbridge/sdk"
import { autorun, observable, runInAction } from "mobx"
import type { Transaction } from "@/types/tx"

type TxPopupState = {
  current_hash: HexString | null
  tx: Transaction | null
  isOpen: boolean
}

class TxPopupController {
  state = observable<TxPopupState>({
    isOpen: false,
    current_hash: null,
    tx: null,
  })

  timer: NodeJS.Timeout | null = null

  switch(hash: HexString | null) {
    if (this.timer !== null) clearTimeout(this.timer)

    runInAction(() => {
      this.state.current_hash = null
    })

    this.timer = setTimeout(() => {
      runInAction(() => {
        this.state.current_hash = hash
      })
    }, 0)
  }

  close() {
    runInAction(() => {
      this.state.current_hash = null
    })
  }

  subscribe(params: {
    open: (hash: HexString) => void
    close: (hash: HexString) => void
    read_tx: (hash: HexString) => Transaction
  }) {
    let last_hash: HexString | null = null

    return autorun(() => {
      const new_hash = txPopup.state.current_hash

      try {
        if (last_hash === new_hash) return

        if (new_hash === null) {
          runInAction(() => {
            this.state.isOpen = false
          })

          const tx_hash = this.state.tx?.transaction_hash ?? null

          if (tx_hash !== null) {
            // stop streaming
            params.close(tx_hash)
          }

          return
        }

        const tx = new_hash ? params.read_tx(new_hash) : null
        if (!tx) return

        runInAction(() => {
          this.state.isOpen = true
          this.state.tx = tx
        })

        params.open(new_hash)
      } finally {
        last_hash = new_hash
      }
    })
  }
}

export const txPopup = new TxPopupController()
