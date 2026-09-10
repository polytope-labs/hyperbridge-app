import type { TransactionStore } from "@/stores/tx-store"
import type { HexString, Transaction } from "@/types/tx"
import { makeResumption } from "../resumption-logic"

describe("makeResumption", () => {
  it("records immediate Hyperbridge verification for a Nexus source block", () => {
    const transactionHash =
      "0xf76dabf0ac3fd186107e3798a4c2969d72b68ee25fc52cc32e2a24630e5c39f3" as HexString
    const transaction = { source: -3 } as Transaction
    const progressRequest = vi.fn()
    const store = {
      transactions: { [transactionHash]: transaction },
      progressRequest,
    } as unknown as TransactionStore

    const resumption = makeResumption({ store })
    resumption.recordEvent({
      kind: "InBlock",
      transaction_hash: transactionHash,
      block_number: 11820892n,
    })

    expect(progressRequest).toHaveBeenNthCalledWith(1, transactionHash, {
      kind: "Dispatched",
      block_number: 11820892n,
    })
    expect(progressRequest).toHaveBeenNthCalledWith(2, transactionHash, {
      kind: "HyperbridgeVerified",
      block_hash: "0x",
      block_number: 11820892n,
      transaction_hash: transactionHash,
    })
  })
})
