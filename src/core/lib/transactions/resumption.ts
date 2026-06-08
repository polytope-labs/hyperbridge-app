import { makeResumption } from "@/lib/transactions/resumption-logic.ts"
import { TransactionStoreInstance } from "@/stores/tx-store.ts"

export const Resumption = makeResumption({
  store: TransactionStoreInstance,
})
