import { memoize } from "lodash-es"
import { TransactionProgressController } from "@/lib/transactions/progress-controller"
import { WalletManager } from "@/lib/wallet-manager"
import type { Transaction, TxMode } from "@/types/tx"

export const createProgressController = memoize(
  function createProgressController(tx: Transaction, mode?: TxMode) {
    return new TransactionProgressController(WalletManager, tx, mode)
  },
  (tx) => tx.transaction_hash,
)
