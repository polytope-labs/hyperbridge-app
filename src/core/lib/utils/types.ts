export type RpcUrl = `${"https://" | "wss://"}${string}`

export type StateMachineId =
  | `SUBSTRATE-${string}`
  | `EVM-${string}`
  | `POLKADOT-${string}`
  | `KUSAMA-${string}`

export type UnifiedMatchers<TArg, TOut> = {
  evm?: (value: TArg) => TOut
  substrate?: (value: TArg) => TOut
  relay?: (value: TArg) => TOut
  assetHub?: (value: TArg) => TOut
  _?: (chainId: TArg) => TOut
  none: () => TOut
}

export type Prettify<T> = {
  [K in keyof T]: T[K]
} & {}
