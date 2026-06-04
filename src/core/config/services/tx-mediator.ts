import type { HexString } from "@hyperbridge/sdk"
import { createProgressController } from "@/config/services/progress-controller.ts"
import {
  type ProgressController,
  TxMediator,
} from "@/lib/transactions/tx-mediator.ts"
import { O } from "@/lib/utils/fp.helpers.ts"
import { TransactionStoreInstance } from "@/stores/tx-store.ts"

const getEntry = (hash: HexString): O.Option<ProgressController> => {
  const tx = TransactionStoreInstance.get(hash)

  if (!tx) {
    throw new Error(
      "Failed to resolve Transaction from Store. Tx should be in store before invoking Mediator",
    )
  }

  return O.some(createProgressController(tx))
}

export const txMediator = new TxMediator(getEntry)
