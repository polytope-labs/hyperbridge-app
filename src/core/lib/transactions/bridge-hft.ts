import { postRequestCommitment, type HyperFungibleToken } from "@hyperbridge/sdk"
import { TokenImpl } from "@hyperbridge-fe/shared/factories"
import type { HexString } from "@polkadot/util/types"
import {
  getAccount,
  waitForTransactionReceipt,
  type Config,
  sendTransaction,
  switchChain,
} from "@wagmi/core"
import { parseEventLogs } from "viem"
import { EvmHostABI } from "@/abis/EvmHost"
import type { BridgeParamsHelper } from "@/lib/bridge-params-helpers/base.ts"
import { ensureFeeTokenBalance } from "@/lib/fee-token-preparation"
import {
  getDestStateMachineId,
  getHftRelayerFee,
  getHftTimeout,
  getHyperFungibleToken,
  isHftToken,
} from "@/lib/hft/hyper-fungible-token"
import { rootLogger } from "@/lib/logger"
import type { EVMToken } from "@/types"
import type { TxCreationEvents } from "@/types/tx"
import { WagmiConfig, type WagmiChainId } from "@/config/wagmi"
import type { BridgeTxExecutor } from "./types"

const logger = rootLogger.withTag("HftBridgeTx")

export class HftBridgeTx implements BridgeTxExecutor {
  private hft: HyperFungibleToken | null = null
  private relayerFee = 0n

  constructor(public readonly params: BridgeParamsHelper) {}

  async initialize() {
    const bridgeParams = this.params.bridgeParams
    const token = bridgeParams.token

    if (!TokenImpl.is(token) || token.__type !== "evm" || !isHftToken(token)) {
      throw new Error("HftBridgeTx requires an HFT token")
    }

    if (this.params.source.group !== "evm") {
      throw new Error("HftBridgeTx requires an EVM source")
    }

    if (this.params.destination.group !== "evm") {
      throw new Error("EVM HFT sends currently require an EVM destination")
    }

    this.relayerFee = getHftRelayerFee(token)
    this.hft = await getHyperFungibleToken(
      bridgeParams.source,
      bridgeParams.destination,
    )

    await switchChain(WagmiConfig, { chainId: this.params.source.chainId })

    const account = getAccount(WagmiConfig)
    if (!account.address) {
      throw new Error("Wallet not connected")
    }

    await ensureFeeTokenBalance({
      owner: account.address,
      source: this.params.source,
      requiredAmount: this.relayerFee,
    })
  }

  async *execute(): AsyncGenerator<TxCreationEvents> {
    const hft = this.hft
    if (!hft) {
      throw new Error("HftBridgeTx not initialized")
    }

    const bridgeParams = this.params.bridgeParams
    const source = this.params.source
    const token = bridgeParams.token as EVMToken

    if (source.group !== "evm") {
      throw new Error("HftBridgeTx requires an EVM source")
    }

    await switchChain(WagmiConfig, { chainId: source.chainId })

    const account = getAccount(WagmiConfig)
    if (!account.address) {
      throw new Error("Wallet not connected")
    }

    const gen = hft.bridge({
      token: token.address,
      from: account.address,
      to: bridgeParams.recipient as HexString,
      amount: bridgeParams.amount,
      dest: getDestStateMachineId(bridgeParams.destination),
      timeout: getHftTimeout(token),
      payInFeeToken: true,
      relayerFee: this.relayerFee,
    })

    let result = await gen.next()

    while (!result.done) {
      const step = result.value
      if (!step) break

      if (step.type === "approve") {
        logger.info("Submitting fee token approval")
        const hash = await sendTransaction(WagmiConfig, {
          to: step.tx.to,
          data: step.tx.data,
          chainId: source.chainId as WagmiChainId,
        })
        await waitForTransactionReceipt(WagmiConfig, {
          hash,
          chainId: source.chainId as WagmiChainId,
        })
        result = await gen.next()
        continue
      }

      if (step.type === "send") {
        logger.info("Submitting HFT send transaction")
        const hash = await sendTransaction(WagmiConfig, {
          to: step.tx.to,
          data: step.tx.data,
          value: step.tx.value,
          chainId: source.chainId as WagmiChainId,
        })

        yield {
          kind: "Ready",
          transaction_hash: hash,
          meta: [
            {
              type: "resumption_params",
              network: "evm",
              transaction_hash: hash,
            },
          ],
        }

        result = await gen.next(hash)
        continue
      }

      if (step.type === "submitted") {
        logger.info("HFT transfer submitted", { commitment: step.commitment })
        result = await gen.next()
        continue
      }

      if (step.type === "status") {
        logger.debug("HFT status", step.status)
        if (step.status === "DESTINATION" || step.status === "TIMED_OUT") {
          break
        }
        result = await gen.next()
        continue
      }

      result = await gen.next()
    }
  }

  /** HFT sends emit PostRequestEvent on the source host. */
  static resume = resumeEvmHftTx
}

/** Default relayer fee for HFT fee estimation (fee tokens, not USD) */
export function estimateHftFeeTokenCost(token: EVMToken): bigint {
  return getHftRelayerFee(token)
}

export async function* resumeEvmHftTx({
  transaction_hash,
  sourceChain,
  config = WagmiConfig,
}: {
  transaction_hash: HexString
  sourceChain: WagmiChainId
  config?: Config
}): AsyncGenerator<TxCreationEvents> {
  const receipt = await waitForTransactionReceipt(config, {
    hash: transaction_hash,
    chainId: sourceChain,
    confirmations: 1,
  })

  if (receipt.status !== "success") {
    yield {
      kind: "Error",
      transaction_hash,
      error: {
        kind: "InitError",
        error: "Transaction failed",
        timestamp: Date.now(),
      },
    }
    return
  }

  yield {
    kind: "InBlock",
    transaction_hash,
    block_number: receipt.blockNumber,
  }

  const event = parseEventLogs({ abi: EvmHostABI, logs: receipt.logs }).find(
    (entry) => entry.eventName === "PostRequestEvent",
  )

  if (!event || event.eventName !== "PostRequestEvent") {
    throw new Error("PostRequest event not found!")
  }

  const request = event.args
  const commitment_hash = postRequestCommitment(request).commitment

  yield {
    kind: "CommitmentHash",
    transaction_hash,
    commitment_hash,
  }

  yield {
    kind: "IPostRequest",
    request,
    transaction_hash,
  }

  yield {
    kind: "Closed",
  }
}
