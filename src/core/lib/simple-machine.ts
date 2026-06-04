import type { LegacyTxStatusKey } from "@/types/tx"

type Flow = Partial<
  Record<
    LegacyTxStatusKey,
    { prev: LegacyTxStatusKey[]; next: LegacyTxStatusKey[] }
  >
>

export class Machine {
  initial: LegacyTxStatusKey
  flow: Flow = {}

  constructor(initial: LegacyTxStatusKey, flow: Flow) {
    this.initial = initial
    this.flow = flow
  }

  static from(status: LegacyTxStatusKey, record: Flow) {
    return new Machine(status, record)
  }

  static create(initial: LegacyTxStatusKey, flow: Flow | LegacyTxStatusKey[]) {
    return new Machine(
      initial,
      Array.isArray(flow) ? Machine.fromList(flow) : flow,
    )
  }

  static fromList(list: LegacyTxStatusKey[]): Flow {
    const record: Flow = {}

    for (const index in list) {
      const curr = Number(index)
      const prev_value = list[curr - 1]
      const cur_value = list[curr]
      const next_value = list[curr + 1]

      record[cur_value] = {
        prev: prev_value ? [prev_value] : [],
        next: next_value ? [next_value] : [],
      }
    }

    return record
  }

  *forward() {
    let cur = this.flow[this.initial]
    while (true) {
      if (!cur) return

      if (cur.next.length === 0) {
        return
      }

      const next_step = cur.next[0]
      yield next_step

      cur = this.flow[next_step]
    }
  }

  *backwards() {
    let cur = this.flow[this.initial]

    while (true) {
      if (!cur) return

      if (cur.prev.length === 0) {
        return
      }

      const next_step = cur.prev[0]
      yield next_step

      cur = this.flow[next_step]
    }
  }
}
