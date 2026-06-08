import type { BridgeParamsHelper } from "@/lib/bridge-params-helpers/base.ts"
import type { HexString, TxCreationEvents } from "@/types/tx"

// biome-ignore lint/suspicious/noExplicitAny: Expecting an override
type Param = any

export interface BridgeTxExecutor<T = BridgeParamsHelper> {
  readonly params: T

  initialize: (init_params?: Param) => Promise<void>
  execute: (execute_params?: Param) => AsyncGenerator<TxCreationEvents>
}

export interface EvmTxExecutor {
  initialize: (init_params?: Param) => Promise<void>
  execute: (execute_params?: Param) => Promise<{ txHash: HexString }>
}
