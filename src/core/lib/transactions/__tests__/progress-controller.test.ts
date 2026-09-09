import type { IsmpClient } from "@hyperbridge/sdk"
import type { Web3ConnManager } from "@hyperbridge-fe/web3-connect/store"
import { observable } from "mobx"
import { TransactionProgressController } from "@/lib/transactions/progress-controller"
import type { Transaction } from "@/types/tx"
import { Evm_to_Evm, TxTestUtils } from "../../__tests__/shared"

describe("TransactionProgressController", () => {
  it("starts status tracking while request hydration and missed-event sync are pending", async () => {
    const transaction = TxTestUtils.freezeForSend(
      "Dispatched",
      Evm_to_Evm({
        source: -3,
        destination: 56,
        commitment_hash:
          "0x87f5b66d91e395cd00428d63b6b17d529977525c670ca0fa3d90f1eb9b9bf613",
        relayerFee: 0,
      }),
    )
    delete transaction.request

    if (!("token" in transaction.originalParams)) {
      throw new Error("Expected a transfer transaction")
    }
    transaction.originalParams.token.selfDelivery = false

    let markStatusRead: (() => void) | undefined
    const statusRead = new Promise<void>((resolve) => {
      markStatusRead = resolve
    })

    const verifiedStatus = {
      status: "SOURCE",
      metadata: {
        blockHash: "0xverified",
        blockNumber: 1n,
        transactionHash: "0xverified",
      },
    }
    const destinationStatus = {
      status: "DESTINATION",
      metadata: {
        blockHash: "0xdestination",
        blockNumber: 2n,
        transactionHash: "0xdestination",
      },
    }

    let statusReadCount = 0
    const client = {
      queryPostRequest: vi.fn(() => new Promise(() => undefined)),
      queryRequestWithStatus: vi.fn(async () => {
        statusReadCount += 1
        markStatusRead?.()
        return {
          statuses:
            statusReadCount === 1
              ? [verifiedStatus]
              : [verifiedStatus, destinationStatus],
        }
      }),
      async *postRequestStatusStream() {
        yield destinationStatus
      },
    } as unknown as IsmpClient

    const controller = new TransactionProgressController(
      { accounts: {} } as Web3ConnManager,
      transaction as Transaction,
    )

    Object.defineProperty(controller, "indexerClient", {
      value: { get: vi.fn(async () => client) },
    })
    Object.defineProperty(controller, "updateMissedEvents", {
      value: vi.fn(() => new Promise(() => undefined)),
    })
    Object.defineProperty(
      controller,
      "show_claim_button_if_delivery_status_exceeds_wait_time",
      { value: vi.fn(async () => undefined) },
    )

    void (
      controller as unknown as {
        beginTracking(transaction: Transaction): Promise<void>
      }
    ).beginTracking(transaction)

    const outcome = await Promise.race([
      statusRead.then(() => "tracking-started" as const),
      new Promise<"timed-out">((resolve) =>
        setTimeout(() => resolve("timed-out"), 100),
      ),
    ])

    expect(outcome).toBe("tracking-started")
  })

  it("unblocks legacy initialization as soon as the commitment is recorded", async () => {
    const transaction = observable(
      TxTestUtils.freezeForSend("Pending", Evm_to_Evm()),
    )
    delete transaction.request
    transaction.commitment_hash = undefined
    transaction.progress = {}

    const controller = new TransactionProgressController(
      { accounts: {} } as Web3ConnManager,
      transaction,
    )

    const initialized = controller.legacyInitialization(transaction)
    transaction.commitment_hash =
      "0x87f5b66d91e395cd00428d63b6b17d529977525c670ca0fa3d90f1eb9b9bf613"

    const outcome = await Promise.race([
      initialized.then(() => "initialized" as const),
      new Promise<"timed-out">((resolve) =>
        setTimeout(() => resolve("timed-out"), 100),
      ),
    ])

    expect(outcome).toBe("initialized")
  })
})
