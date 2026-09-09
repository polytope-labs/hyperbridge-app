import type { RemoteEvent } from "@/types/tx"
import {
  isTxDoneStreaming,
  trackTransaction,
  type StreamClient,
} from "@/lib/tracker"
import { Evm_to_Evm } from "./shared"

describe("trackTransaction", () => {
  it("recovers destination delivery when the SDK stream closes during startup", async () => {
    const transaction = Evm_to_Evm()
    transaction.status = "HyperbridgeVerified"
    transaction.completed = false
    transaction.relayerFee = 1

    const verified = {
      kind: "HyperbridgeVerified",
      block_hash: "0xverified",
      block_number: 10n,
      transaction_hash: "0xverified",
    } as RemoteEvent
    const delivered = {
      kind: "DestinationDelivered",
      block_hash: "0xdelivered",
      block_number: 11n,
      transaction_hash: "0xdelivered",
    } as RemoteEvent
    let refreshCount = 0

    const streamer: StreamClient<RemoteEvent> = {
      async *read_past_events() {
        yield verified
      },
      async *start() {
        return
      },
      async read_last_status() {
        refreshCount += 1
        return refreshCount === 1 ? verified : delivered
      },
    }

    const events = await Array.fromAsync(
      trackTransaction({ transaction, streamer, statusRefreshIntervalMs: 1 }),
    )

    expect(events).toEqual([
      { kind: "Progress", value: verified, _emitter: "fast_forward" },
      { kind: "Progress", value: delivered, _emitter: "status_refresh" },
    ])
  })

  it("keeps tracking zero-fee transfers that require a relayer", () => {
    const transaction = Evm_to_Evm()
    transaction.relayerFee = 0
    if (!("token" in transaction.originalParams)) {
      throw new Error("Expected a transfer transaction")
    }
    transaction.originalParams.token.selfDelivery = false

    expect(isTxDoneStreaming(transaction, "HyperbridgeFinalized")).toBe(false)
    expect(isTxDoneStreaming(transaction, "DestinationDelivered")).toBe(true)
  })
})
