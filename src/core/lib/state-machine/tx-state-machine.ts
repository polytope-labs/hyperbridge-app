import { matchChain } from "@hyperbridge-fe/shared"
import type { Maybe } from "@hyperbridge-fe/shared/types"
import { Machine } from "@/lib/simple-machine"
import { O } from "@/lib/utils/fp.helpers"
import type { ChainId } from "@/types"
import type { LegacyTxStatusKey } from "@/types/tx"

const STATE_MACHINES = Object.freeze({
  standard: Machine.create("Dispatched", [
    "Dispatched",
    "SourceFinalized",
    "HyperbridgeVerified",
    "HyperbridgeFinalized",
    "DestinationDelivered",
  ]),

  standard_rollback: Machine.create("Dispatched", [
    "Dispatched",
    "DestinationFinalized",
    "HyperbridgeVerified",
    "HyperbridgeFinalized",
  ]),

  evm_to_polkadot_dot: Machine.create("Dispatched", [
    "Dispatched",
    "SourceFinalized",
    "HyperbridgeVerified",
  ]),

  relay_source: Machine.create("Dispatched", [
    "Dispatched",
    "HyperbridgeVerified",
    "HyperbridgeFinalized",
    "DestinationDelivered",
  ]),

  rollback_relay_evm: Machine.create("Dispatched", [
    "Dispatched",
    "DestinationFinalized",
    "HyperbridgeVerified",
  ]),

  rollback_evm_substrate: Machine.create("Dispatched", [
    "Dispatched",
    "DestinationFinalized",
    "HyperbridgeVerified",
    "HyperbridgeFinalized",
    "TimedOut",
  ]),

  rollback_substrate_relay: Machine.create("Dispatched", [
    "Dispatched", // Maybe update to an Array -> ['timeout/Dispatched', 'progress/Dispatched']
    "HyperbridgeFinalized",
  ]),

  get rollback_evm_evm() {
    return this.standard_rollback
  },

  get rollback_relay_substrate() {
    return this.rollback_relay_evm
  },

  get rollback_evm_relay() {
    return this.rollback_substrate_relay
  },

  get rollback_substrate_evm() {
    return this.rollback_evm_substrate
  },
})

export type MachineKey = keyof typeof STATE_MACHINES

export const TxFlow = {
  has_key(machine_key: MachineKey) {
    return machine_key in STATE_MACHINES
  },

  /** @todo Test this function **/
  key_by_chain_id(chainId: ChainId): O.Option<MachineKey> {
    return matchChain(chainId, {
      relay: () => O.some("relay_source" as const),
      _: () => O.some("standard" as const),
      none: () => O.none(),
    })
  },

  prev(
    machine_key: MachineKey,
    status: LegacyTxStatusKey,
  ): Maybe<LegacyTxStatusKey> {
    const machine = STATE_MACHINES[machine_key]

    if (!machine) return null

    return Machine.from(status, machine.flow).backwards().next()
      .value as LegacyTxStatusKey
  },

  next(
    machine_key: MachineKey,
    status: LegacyTxStatusKey,
  ): Maybe<LegacyTxStatusKey> {
    const machine = STATE_MACHINES[machine_key]
    if (!machine) return null

    return Machine.from(status, machine.flow).forward().next()
      .value as LegacyTxStatusKey
  },

  *read(machine_key: MachineKey) {
    const machine: Machine | undefined = STATE_MACHINES[machine_key]

    if (!machine) return

    yield machine.initial
    yield* machine.forward()
  },

  get(machine_key: MachineKey) {
    return Array.from(this.read(machine_key))
  },
}
