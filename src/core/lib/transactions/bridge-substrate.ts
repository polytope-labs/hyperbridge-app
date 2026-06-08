import { type IsmpClient } from "@hyperbridge/sdk"
import type { ApiPromise } from "@polkadot/api"
import type { ISubmittableResult, Signer } from "@polkadot/types/types"
import type { HexString } from "@polkadot/util/types"
import { hexToBytes, isAddress } from "viem"
import { SubstrateApiStore } from "@/config/services/substrate-api.ts"
import type { BridgeParamsHelper } from "@/lib/bridge-params-helpers/base.ts"
import type { SubstrateBridgeHelper } from "@/lib/bridge-params-helpers/substrate-bridge.ts"
import { streamToAsyncIterator } from "@/lib/tx.helpers"
import type { TxCreationEvents } from "@/types/tx"
import { rootLogger } from "../logger"
import { O } from "../utils/fp.helpers"
import type { BridgeTxExecutor } from "./types"

type HftSendParams = {
  assetId: HexString
  destination: { Evm: number }
  recipient: number[]
  amount: bigint
  timeout: bigint
  relayerFee: bigint
  callData: null
}

type RequestParams = {
  who: string
  params: HftSendParams
}

type HftSendEvent = {
  kind: "Ready" | "Dispatched" | "Finalized" | "Error"
  transaction_hash?: HexString
  block_number?: bigint
  commitment?: HexString
  error?: unknown
}

type HftExtrinsic = {
  signAndSend: (
    who: string,
    options: { signer: Signer },
    callback: (result: ISubmittableResult) => void | Promise<void>,
  ) => Promise<() => void>
}

const logger = rootLogger.withTag("SubstrateBridgeTx")

export class SubstrateBridgeTx implements BridgeTxExecutor {
  private requestParams: O.Option<RequestParams> = O.none()
  private indexerClient: O.Option<IsmpClient> = O.none()
  params: BridgeParamsHelper

  constructor(
    readonly substrateBrigeHelper: SubstrateBridgeHelper,
    private readonly signer: Signer,
  ) {
    this.params = substrateBrigeHelper.params
  }

  async initialize(config: { indexerClient: IsmpClient }) {
    this.indexerClient = O.some(config.indexerClient)
    const helper = this.substrateBrigeHelper

    const params = this.params.bridgeParams
    const sourceNetwork = helper.source
    const destNetwork = helper.destination

    const substrateApi = await SubstrateApiStore.get(sourceNetwork.chainId)

    if (destNetwork.group !== "evm") {
      throw new Error("Substrate HFT sends currently require an EVM destination")
    }

    const sendParams: HftSendParams = {
      assetId: helper.assetId as HexString,
      destination: { Evm: destNetwork.chainId },
      recipient: Array.from(resolveEvmRecipient(params.recipient)),
      amount: params.amount,
      timeout: BigInt(params.timeout),
      relayerFee: 0n,
      callData: null,
    }

    const requestParams: RequestParams = {
      who: params.from,
      params: sendParams,
    }

    this.requestParams = O.some(requestParams)
    this.substrateApi = O.some(substrateApi)
  }

  async *execute(): AsyncGenerator<TxCreationEvents> {
    const indexer_client = this.indexerClient.pipe(
      O.getOrThrowWith(() => new Error("Indexer client missing")),
    )

    const tx_params = this.requestParams.pipe(
      O.getOrThrowWith(() => new Error("Substrate HFT send params missing")),
    )

    const substrateApi = this.substrateApi.pipe(
      O.getOrThrowWith(() => new Error("Substrate API missing")),
    )

    logger.debug("Sending params to pallet HFT", tx_params)

    const tx = substrateApi.tx.hyperFungibleToken.send(tx_params.params)

    for await (const event of signAndSendHft({
      tx: tx as unknown as HftExtrinsic,
      who: tx_params.who,
      signer: this.signer,
      api: substrateApi,
    })) {
      if (event.kind === "Error") {
        yield {
          kind: "Error",
          error: String(event.error),
        }
      }

      if (event.kind === "Ready") {
        if (!event.transaction_hash) {
          yield {
            kind: "Error",
            error: "Transaction hash missing",
          }
          continue
        }

        yield {
          kind: "Ready",
          transaction_hash: event.transaction_hash,
          meta: [],
        }
      }

      if (event.kind === "Dispatched" || event.kind === "Finalized") {
        if (!event.transaction_hash) {
          yield {
            kind: "Error",
            error: "Transaction hash missing",
          }
          continue
        }

        if (event.kind === "Dispatched") {
          if (typeof event.block_number === "undefined") {
            yield {
              kind: "Error",
              error: "Block number missing",
            }
            continue
          }

          yield {
            kind: "InBlock",
            block_number: event.block_number,
            transaction_hash: event.transaction_hash,
          }
        }

        // get request body from indexer when commitment hash is received
        if (!event.commitment) continue

        yield {
          kind: "CommitmentHash",
          commitment_hash: event.commitment,
          transaction_hash: event.transaction_hash,
        }

        // if query takes too use the commitment_hash
        const request = await indexer_client.queryPostRequest(event.commitment)
        if (!request) continue

        yield {
          kind: "IPostRequest",
          request: request,
          transaction_hash: event.transaction_hash,
        }
        break
      }
    }
  }

  private substrateApi: O.Option<
    Awaited<ReturnType<typeof SubstrateApiStore.get>>
  > = O.none()
}

function resolveEvmRecipient(recipient: string): Uint8Array {
  if (!isAddress(recipient)) {
    throw new Error("Expected a 20-byte EVM recipient address")
  }

  return hexToBytes(recipient as HexString)
}

async function* signAndSendHft({
  tx,
  who,
  signer,
  api,
}: {
  tx: HftExtrinsic
  who: string
  signer: Signer
  api: ApiPromise
}): AsyncGenerator<HftSendEvent> {
  let unsub = () => {}
  let closed = false

  try {
    const stream = new ReadableStream<HftSendEvent>({
      async start(controller) {
        unsub = await tx.signAndSend(
          who,
          { signer },
          async (result: ISubmittableResult) => {
            try {
              const {
                status,
                dispatchError,
                txHash,
                isError,
                isInBlock,
                isFinalized,
              } = result

              if (dispatchError || isError) {
                controller.enqueue({
                  kind: "Error",
                  error: dispatchError?.toString() ?? "Transaction failed",
                })
                unsub?.()
                controller.close()
                closed = true
                return
              }

              if (status.type === "Ready") {
                controller.enqueue({
                  kind: "Ready",
                  transaction_hash: txHash.toHex() as HexString,
                })
              }

              if (isInBlock || isFinalized) {
                const blockHash = isInBlock
                  ? status.asInBlock.toHex()
                  : status.asFinalized.toHex()
                const header = await api.rpc.chain.getHeader(blockHash)
                const commitment = readCommitmentHash(result.events)

                if (!commitment) {
                  controller.enqueue({
                    kind: "Error",
                    error: "Commitment hash missing",
                  })
                  unsub?.()
                  controller.close()
                  closed = true
                  return
                }

                controller.enqueue({
                  kind: isInBlock ? "Dispatched" : "Finalized",
                  transaction_hash: txHash.toHex() as HexString,
                  block_number: header.number.toBigInt(),
                  commitment,
                })

                if (isFinalized) {
                  unsub?.()
                  controller.close()
                  closed = true
                }
              }
            } catch (err) {
              if (closed) return
              controller.enqueue({ kind: "Error", error: String(err) })
            }
          },
        )
      },
      cancel: () => unsub?.(),
    })

    yield* streamToAsyncIterator(stream)
  } finally {
    unsub?.()
  }
}

function readCommitmentHash(
  events: ISubmittableResult["events"],
): HexString | undefined {
  for (const { event } of events) {
    if (event.section === "hyperFungibleToken" && event.method === "TokenSent") {
      const commitment = event.data.toHuman() as { commitment?: string }
      if (commitment.commitment) return commitment.commitment as HexString
    }

    if (event.section === "ismp" && event.method === "Request") {
      const commitment = event.data[3]?.toHex()
      if (commitment) return commitment as HexString
    }
  }
}
