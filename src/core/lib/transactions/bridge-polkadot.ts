import type { HexString, IndexerQueryClient } from "@hyperbridge/sdk"
import { queryAssetTeleported, teleportDot } from "@hyperbridge/sdk"
import {
  isEVMChain,
  isNil,
  type Prettify,
  safeArray,
} from "@hyperbridge-fe/shared"
import { Gargantua, Nexus } from "@hyperbridge-fe/shared/config"
import type { ApiPromise } from "@polkadot/api"
import type { EventRecord } from "@polkadot/types/interfaces"
import type { Signer } from "@polkadot/types/types"
import { u8aToHex } from "@polkadot/util"
import { decodeAddress } from "@polkadot/util-crypto"
import { Effect, Match, pipe } from "effect"
import { formatUnits, isHex } from "viem"
import { gatewayConfig } from "@/config/services/gateway-config.ts"
import { SubstrateApiStore } from "@/config/services/substrate-api.ts"
import type { BridgeParamsHelper } from "@/lib/bridge-params-helpers/base.ts"
import {
  type BridgeParams,
  queryHyperbridgeRequest,
  streamToAsyncIterator,
} from "@/lib/tx.helpers"
import type {
  AppBridgeParams,
  TxCreationEvents,
  TxResumptionPayload,
} from "@/types/tx"
import { O } from "../utils/fp.helpers"
import type { BridgeTxExecutor } from "./types"

type RequestParams = Omit<Parameters<typeof teleportDot>[0], "options">

type PolkadotResumeParams = Prettify<
  AppBridgeParams &
    Extract<TxResumptionPayload, { network: "relay" }> & {
      queryClient: IndexerQueryClient
    }
>

export class PolkadotBridgeTx implements BridgeTxExecutor {
  safeRequestParams: O.Option<RequestParams> = O.none()

  constructor(
    public params: BridgeParamsHelper,
    private signer: Signer,
  ) {}

  /**
   * Initiates a Polkadot transaction, awaits the signature and isInBlock for the transaction
   **/
  async initialize(): Promise<void> {
    const params = this.params.bridgeParams
    const { from: walletAddress } = params

    if (!walletAddress) {
      throw new Error("[PolkadotTeleport]: No Wallet Address Provided")
    }

    const relayApi = await SubstrateApiStore.relay

    if (!isEVMChain(params.destination)) {
      throw new Error("Destination chain must be EVM")
    }

    const ParaIds = {
      [Gargantua.chainId]: 4009,
      [Nexus.chainId]: 3367,
    }

    const request_params: RequestParams = {
      /** @ts-expect-error Type mismatch */
      sourceApi: relayApi,
      who: params.from,
      xcmGatewayParams: {
        destination: params.destination,
        recipient: params.recipient,
        amount: Number(formatUnits(params.amount, params.token.decimals)),
        timeout: BigInt(params.timeout),
        paraId: ParaIds[gatewayConfig.hyperbridgeNet.get().chainId],
      },
    }

    this.safeRequestParams = O.some(request_params)
  }

  async *execute(): AsyncGenerator<TxCreationEvents> {
    const teleport_params = pipe(
      this.safeRequestParams,
      O.getOrThrowWith(() => new Error("Teleport parameters not set")),
    )

    const stream = await teleportDot({
      ...teleport_params,
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore Type mismatch
      options: { signer: this.signer },
    })

    const hyperbridge_api = await SubstrateApiStore.hyperbridge

    const nonce = await getNonce(hyperbridge_api, {
      wallet_addr: this.params.bridgeParams.from,
    })

    let txHash: HexString | undefined

    for await (const event of streamToAsyncIterator(stream)) {
      if (event.kind === "Ready") {
        txHash = event.transaction_hash
        yield {
          kind: "Ready",
          transaction_hash: event.transaction_hash,
          meta: [
            {
              type: "resumption_params",
              network: "relay",
              nonce,
              transaction_hash: event.transaction_hash,
              message_id: event.message_id,
            },
          ],
        } as Extract<TxCreationEvents, { kind: "Ready" }>
      }

      if (event.kind === "Error") {
        yield {
          kind: "Error",
          transaction_hash: txHash,
          error: String(PolkadotBridgeTx.transformTxError(event.error)),
        }
      }

      if (event.kind === "Finalized") {
        if (txHash && event.message_id) {
          yield {
            kind: "Finalized",
            transaction_hash: txHash,
            message_id: event.message_id,
          }
        }
      }
    }
  }

  static async *resume(
    resumption_params: PolkadotResumeParams,
  ): AsyncGenerator<TxCreationEvents> {
    const { transaction_hash } = resumption_params

    const hyperbridge = await SubstrateApiStore.hyperbridge

    const { commitment, block_number } =
      await PolkadotBridgeTx.readCommitmentAndBlockNumber(resumption_params)

    yield {
      kind: "CommitmentHash",
      commitment_hash: commitment,
      transaction_hash: transaction_hash,
    }

    // add the dispatched status,
    yield {
      kind: "InBlock",
      transaction_hash: transaction_hash,
      block_number: block_number,
    }

    const block_hash = await hyperbridge.rpc.chain.getBlockHash(block_number)
    const request = await queryHyperbridgeRequest(commitment)

    yield {
      kind: "IPostRequest",
      request,
      transaction_hash: transaction_hash,
    }

    yield {
      kind: "Verified",
      block_hash: block_hash.toHex(),
      block_number: block_number,
      transaction_hash: transaction_hash,
    }

    yield {
      kind: "Closed",
    }
  }

  static async readCommitmentAndBlockNumber(
    params: PolkadotResumeParams,
  ): Promise<{
    commitment: HexString
    block_number: bigint
  }> {
    const message_id = params?.message_id

    if (!isHex(message_id)) {
      throw new Error(
        "Invalid teleport `message_id`. Expecting a Hex got: ",
        message_id,
      )
    }

    const response = await queryAssetTeleported({
      id: message_id,
      queryClient: params.queryClient,
    })

    if (isNil(response?.commitment)) {
      throw new Error(
        "Failed to read commitment hash from `queryAssetTeleported`",
      )
    }

    return {
      commitment: response.commitment,
      // @ts-expect-error Fix soon blockNumber should be a bigint
      block_number: response.blockNumber as bigint,
    }
  }

  static parseExtrinsicError(err_msg: unknown) {
    // e.g Error: Error watching Extrinsics : { module: { index, error }}
    const matches = /Error watching extrinsic:(.+)"?$/.exec(String(err_msg))

    // @ts-expect-error handled edge case
    const [message, json_string] = safeArray(matches)

    const cleanJson = (stringify_json?: string) => {
      if (typeof stringify_json !== "string") return ""

      const value = String(stringify_json).endsWith('"')
        ? stringify_json.slice(0, stringify_json.length - 1)
        : stringify_json

      return value.trim()
    }

    const parsed = pipe(
      Effect.try(
        () => JSON.parse(cleanJson(json_string)) as Record<string, unknown>,
      ),
      Effect.match({
        onSuccess: (v) => v,
        onFailure: () => null,
      }),
      Effect.runSync,
    )

    return { meta: parsed ?? { module: {} }, message }
  }

  /**
   * Return a comprehensible error message for Transaction
   *
   * @param error
   * @returns
   */
  static transformTxError(error: unknown) {
    function transformExtrincsError(err_msg: unknown) {
      const { meta } = PolkadotBridgeTx.parseExtrinsicError(err_msg)

      return pipe(
        Match.value(meta.module),
        Match.when({ index: Match.is("99", 99), error: "0x11000000" }, () => {
          return new Error("Insufficient fee to cover Gas", { cause: error })
        }),
        Match.orElse(() => error),
      )
    }

    return pipe(
      Match.value(error),
      Match.when(
        (v: unknown) => String(v).includes("Error watching extrinsic"),
        transformExtrincsError,
      ),
      Match.orElse(() => error),
    )
  }

  /**
   * Extracts the commitment hash from the event data if the event data
   * matches the expected data
   */
  static extractCommitmentHashFromEvent({
    record,
    params,
  }: {
    record: EventRecord
    params: BridgeParams
  }): HexString | undefined {
    const { event } = record

    const [from, to, _amount, dest, commitment] = event.data

    const decodedFrom = u8aToHex(decodeAddress(from.toString(), false))
    const decodedWho = u8aToHex(decodeAddress(params.from, false))

    const isExpectedEvent =
      decodedFrom === decodedWho &&
      to.toString().toLowerCase() === params.recipient.toLowerCase() &&
      dest.toString().includes(params.destination?.toString())

    if (isExpectedEvent) {
      return commitment.toString() as HexString
    }
  }
}

async function getNonce(
  api: ApiPromise,
  params: { wallet_addr: string },
): Promise<string> {
  const response = await api.query.system.account(params.wallet_addr)

  // @ts-expect-error Nonce exists in Codec response
  return response.nonce.toString()
}
