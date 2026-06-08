import type { LegacyTxStatusKey } from "@/types/tx"

export const TxOrder = {
  map: <Record<LegacyTxStatusKey, number>>{
    Error: -1,
    Timeout: -1,
    Pending: 0,
    Dispatched: 1,
    SourceFinalized: 2,
    DestinationFinalized: 2,
    HyperbridgeVerified: 3,
    HyperbridgeFinalized: 4,
    DestinationDelivered: 4,
    Receipt: 6,
    TimedOut: 6,
  },

  lt(status: LegacyTxStatusKey, cmp_status: LegacyTxStatusKey) {
    return this.map[status] < this.map[cmp_status]
  },

  gt(status: LegacyTxStatusKey, cmp_status: LegacyTxStatusKey) {
    return this.map[status] > this.map[cmp_status]
  },

  gte(status: LegacyTxStatusKey, cmp_status: LegacyTxStatusKey) {
    return this.map[status] >= this.map[cmp_status]
  },

  lte(status: LegacyTxStatusKey, cmp_status: LegacyTxStatusKey) {
    return this.map[status] <= this.map[cmp_status]
  },
}
