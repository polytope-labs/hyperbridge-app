import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { readContract, switchChain } from "@wagmi/core"
import { Effect } from "effect"
import { decodeFunctionData } from "viem"
import { EvmHostABI } from "@/abis/EvmHost"
import { HandlerV2ABI } from "@/abis/HandlerV2"
import { WagmiConfig } from "@/config/wagmi"
import type { HexString, Transaction } from "@/types/tx"
import type { TraceMeta } from "@/types/user-tracking"
import { isUserRejectedError } from "../error.helpers"
import { TxImpl } from "../factories/transaction"
import { UserTracking } from "../user-tracking"
import { safeNetworkConfig } from "../utils"
import { O, pipe } from "../utils/fp.helpers"
import { writeContractBuffered } from "./bridge-evm"
import type { EvmTxExecutor } from "./types"

export class EvmClaimFunds implements EvmTxExecutor {
  hostHandler: O.Option<HexString> = O.none()
  calldata: O.Option<HexString> = O.none()
  trace: O.Option<TraceMeta> = O.none()

  constructor(
    public account: HexString,
    public tx: Transaction,
  ) {
    this.trace = TxImpl.read_trace(tx)
  }

  get destination() {
    return pipe(
      safeNetworkConfig(this.tx.destination),
      O.filter((net) => net.group === "evm"),
      O.getOrThrowWith(
        () => new Error("ClaimError: Only EVM Accounts can claim funds"),
      ),
    )
  }

  async initialize() {
    const dest = this.destination

    const hostParams = await readContract(WagmiConfig, {
      abi: EvmHostABI,
      address: NetworkImpl.host_addr(dest),
      functionName: "hostParams",
      chainId: dest.chainId,
    })

    this.hostHandler = O.some(hostParams.handler)
    this.calldata = pipe(
      TxImpl.read_progress_event(this.tx, "HyperbridgeFinalized"),
      O.map((event) => event.status.calldata),
      O.getOrThrowWith(() => {
        return new Error(
          "Transaction not finalized. Claiming can happen only after Finalization",
        )
      }),
      O.some,
    )
  }

  handleTraceError(err: unknown) {
    if (!isUserRejectedError(err)) {
      if (O.isSome(this.trace)) {
        UserTracking.transaction_funds_claim_failed(this.trace.value, err)
      }
    }

    return Effect.fail(err)
  }

  async execute() {
    return await pipe(
      Effect.tryPromise(() => this.doClaim()),
      Effect.tapError((err) => this.handleTraceError(err)),
      Effect.runPromise,
    )
  }

  private async doClaim(): Promise<{
    txHash: HexString
  }> {
    await this.initialize()

    const { args, functionName } = decodeFunctionData({
      abi: HandlerV2ABI,
      data: this.calldata.pipe(
        O.getOrThrowWith(() => {
          return new Error(
            "Transaction not finalized. First invoke `initialize`",
          )
        }),
      ),
    })

    const claim_params = {
      account: this.account,
      abi: HandlerV2ABI,
      address: O.getOrThrowWith(
        this.hostHandler,
        () => new Error("Host handler missing"),
      ),
      chainId: this.destination.chainId,
      functionName,
      args,
    }

    await switchChain(WagmiConfig, {
      chainId: claim_params.chainId,
    })

    const tx_hash = await writeContractBuffered(
      WagmiConfig,
      {
        account: this.account,
        chainId: this.destination.chainId,
      },
      // Calldata is produced by the relayer; decode narrows to handler write fns.
      claim_params as Parameters<typeof writeContractBuffered>[2],
    )

    if (O.isSome(this.trace)) {
      UserTracking.transaction_funds_claimed(this.trace.value)
    }

    return { txHash: tx_hash }
  }
}
