import { Evm_to_Evm, Evm_to_Polkadot } from "@/lib/__tests__/shared"
import { TxFlow } from "@/lib/state-machine/tx-state-machine"
import { Polkadot_to_Bsc_Tx } from "@/lib/factories/__tests__/shared"
import type { Transaction } from "@/types/tx"
import { Machine } from "@/lib/simple-machine"
import { Paseo } from "@hyperbridge-fe/shared/config"
import { TxImpl } from "../transaction"

describe("TxStateMachine", () => {
  it("should stop at HyperbridgeFinalized for DOT transfer to Relay", () => {
    const dot_sent_tx: Transaction = {
      ...Evm_to_Polkadot(),
      token: {
        name: "Polkadot",
        symbol: "DOT",
        logo: "",
      },
      protocol: {
        kind: "Transfer",
        amount: 10,
      },
    }

    const flow = TxImpl.key_infer({
      priority: "token",
      mode: "send",
      tx: dot_sent_tx,
      dest_config: Paseo,
    })

    expect(flow).toMatchObject({ value: "evm_to_polkadot_dot" })
  })

  describe("Evm source", () => {
    it("should resolve to STANDARD for EVM -> Relay", () => {
      const dot_sent_tx: Transaction = Evm_to_Polkadot()

      const flow = TxImpl.key_infer({
        priority: "transaction",
        mode: "send",
        tx: dot_sent_tx,
      })

      expect(flow).toMatchObject({ value: "standard" })
    })

    it("should resolve to STANDARD for EVM -> EVM", () => {
      const dot_sent_tx: Transaction = Evm_to_Evm()

      const flow = TxImpl.key_infer({
        mode: "send",
        priority: "transaction",
        tx: dot_sent_tx,
      })

      expect(flow).toMatchObject({ value: "standard" })
    })
  })

  it("should resolve to RELAY for Polkadot -> EVM", () => {
    const dot_sent_tx: Transaction = Polkadot_to_Bsc_Tx

    const flow = TxImpl.key_infer({
      mode: "send",

      priority: "transaction",
      tx: dot_sent_tx,
    })

    expect(flow).toMatchObject({ value: "relay_source" })
  })

  describe("fromList", () => {
    it("should return a simple", () => {
      const actual = {
        Dispatched: {
          prev: [],
          next: ["HyperbridgeVerified"],
        },
        HyperbridgeVerified: {
          prev: ["Dispatched"],
          next: ["HyperbridgeFinalized"],
        },
        HyperbridgeFinalized: {
          prev: ["HyperbridgeVerified"],
          next: ["DestinationDelivered"],
        },
        DestinationDelivered: {
          prev: ["HyperbridgeFinalized"],
          next: [],
        },
      }

      const output = Machine.fromList([
        "Dispatched",
        "HyperbridgeVerified",
        "HyperbridgeFinalized",
        "DestinationDelivered",
      ])

      expect(output).toMatchObject(actual)
    })
  })
})

describe("flow test", () => {
  it("should return correct flow for DOT transfer to RELAY", async () => {
    const flow = TxFlow.read("evm_to_polkadot_dot")

    const steps = await Array.fromAsync(flow)

    expect(steps).toMatchInlineSnapshot(`
      [
        "Dispatched",
        "SourceFinalized",
        "HyperbridgeVerified",
      ]
    `)
  })

  it("should return correct flow for RELAY_SOURCE", async () => {
    const flow = TxFlow.read("relay_source")

    const steps = await Array.fromAsync(flow)

    expect(steps).toMatchInlineSnapshot(`
      [
        "Dispatched",
        "HyperbridgeVerified",
        "HyperbridgeFinalized",
        "DestinationDelivered",
      ]
    `)
  })
})
