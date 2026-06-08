export type FeeValue =
  | { kind: "fee"; value: bigint }
  | { kind: "gas"; value: bigint }

export type BridgeGasResult =
  | {
      fee_kind: "l2"
      l2_fee: FeeValue
      bridge_fee: FeeValue
    }
  | {
      fee_kind: "default"
      bridge_fee: FeeValue
    }
