import Polkadot_to_Bsc_Tx from "@/lib/factories/__tests__/polkadot-bsc"
import { observable } from "mobx"
import { O } from "@/lib/utils/fp.helpers"
import { TxMediator } from "../tx-mediator"
import { TransactionProgressController } from "../progress-controller"
import type { Web3ConnManager } from "@hyperbridge-fe/web3-connect/store"
import type { Transaction } from "@/types/tx"
describe("TxMediator", () => {
  function setup(initial_tx: Transaction) {
    const tx = observable(initial_tx)

    const controller = new TransactionProgressController(
      {} as Web3ConnManager,
      tx,
    )
    const tx_mediator = new TxMediator(() => O.some(controller))

    return { tx_mediator, tx, controller }
  }

  it("should unregister when a transaction is completed", () => {
    const { tx_mediator, tx, controller } = setup({
      ...Polkadot_to_Bsc_Tx,
      completed: false,
    } as Transaction)

    // register a tx
    tx_mediator.addByHash(tx.transaction_hash)

    expect(tx_mediator.has(tx.transaction_hash)).toBe(true)
    expect(tx_mediator.get(tx.transaction_hash)).toBe(controller)

    tx.completed = true

    expect(tx_mediator.has(tx.transaction_hash)).toBe(false)
  })

  it("should unregister when a transaction is timed-out", () => {
    const { tx_mediator, tx, controller } = setup({
      ...Polkadot_to_Bsc_Tx,
      completed: false,
    } as Transaction)

    // register a tx
    tx_mediator.addByHash(tx.transaction_hash)

    expect(tx_mediator.has(tx.transaction_hash)).toBe(true)
    expect(tx_mediator.get(tx.transaction_hash)).toBe(controller)

    tx.status = "Timeout"

    expect(tx_mediator.has(tx.transaction_hash)).toBe(false)
  })

})
