import {
  isDevelopment,
  isEVMChain,
  isRelayChain,
  matchChain,
  NETWORK_ENV,
} from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import type { Web3ConnManager } from "@hyperbridge-fe/web3-connect/store"
import {
  readContract,
  switchChain,
  waitForTransactionReceipt,
} from "@wagmi/core"
import { Effect, pipe } from "effect"
import {
  autorun,
  computed,
  type IComputedValue,
  observable,
  observe,
} from "mobx"
import { fromPromise, type IPromiseBasedObservable } from "mobx-utils"
import { decodeFunctionData, hexToBytes } from "viem"
import { EvmHostABI } from "@/abis/EvmHost"
import { HandlerV2ABI } from "@/abis/HandlerV2"
import { SubstrateApiStore } from "@/config/services/substrate-api.ts"
import { WagmiConfig } from "@/config/wagmi"
import { IndexerTimeoutStream } from "@/lib/adapters/stream/indexer-timeout"
import { IndexerClientStream } from "@/lib/adapters/stream/indexer-transfer"
import { getErrorMessage } from "@/lib/error.helpers"
import { TxImpl } from "@/lib/factories/transaction"
import { TxEventImpl } from "@/lib/factories/tx-event"
import { TxNormalizer } from "@/lib/factories/tx-normalizer.ts"
import { TxOrder } from "@/lib/factories/tx-order.ts"
import { StatusEventObserver } from "@/lib/factories/tx-status-observer.ts"
import {
  fetchIPostRequestByCommitmentHash,
  safeIndexerClient,
} from "@/lib/hyperbridge-indexer"
import { TxFlow } from "@/lib/state-machine/tx-state-machine"
import { trackTransaction } from "@/lib/tracker"
import { writeContractBuffered } from "@/lib/transactions/bridge-evm"
import { Resumption } from "@/lib/transactions/resumption.ts"
import { fetchAndSetMissedEvents, getLastStatus } from "@/lib/tx.helpers.ts"
import { UserTracking } from "@/lib/user-tracking"
import { getNetworkConfig, safeNetworkConfig } from "@/lib/utils"
import { delay } from "@/lib/utils/async.helpers"
import { O } from "@/lib/utils/fp.helpers"
import { toast } from "@/lib/utils/toast"
import { TransactionStoreInstance } from "@/stores/tx-store"
import type {
  HexString,
  LegacyTxStatusKey,
  Transaction,
  TxMode,
  TxResumptionPayload,
} from "@/types/tx"
import { rootLogger } from "../logger"
import { ms } from "../utils/date.helpers"
import { EvmClaimFunds } from "./claim-evm"
import type { MediatorEntry, RunningState } from "./mediator"

const logger = rootLogger

export type ClaimButtonStatus = LegacyTxStatusKey | "WaitTimeOver"

type ProgressState = {
  claimPromise: IPromiseBasedObservable<unknown>
  claimInitState: "pending" | "ready" | "idle"
  showClaimButton: ClaimButtonStatus
  flow: LegacyTxStatusKey[]
  mode: TxMode
  tracking: boolean
}

export class TransactionProgressController
  extends EventTarget
  implements MediatorEntry
{
  private _hash: HexString

  public transaction: IComputedValue<Transaction>

  abortController = new AbortController()

  logger = rootLogger.withTag("TransactionProgressController")

  state = observable<ProgressState>({
    // observable promise tracking the claim transaction
    claimPromise: fromPromise(Promise.resolve()),
    showClaimButton: "Dispatched",
    claimInitState: "idle",
    flow: [] as LegacyTxStatusKey[],
    mode: "send" as TxMode,
    tracking: false,
  })

  running_state = observable({ value: "idle" as RunningState })

  constructor(
    private walletManager: Web3ConnManager,
    tx: Transaction,
    initialMode?: TxMode,
  ) {
    super()

    this.logger = rootLogger.withTag(
      `TransactionProgressController Tx(${tx.transaction_hash.substr(0, 5)})`,
    )
    this.transaction = computed(() => tx)
    this._hash = tx.transaction_hash
    const inferred_mode = TxImpl.infer_mode(tx)
    this.state.mode = initialMode ?? inferred_mode

    this.logger.log(`Using TxMode(${this.state.mode})`)
    if (isDevelopment) {
      autorun(() => {
        this.logger.trace("RunningStatus", this.running_state.value)
      })
    }
    this._addSubscription()
  }

  sourceNetwork = computed(() => {
    return getNetworkConfig(this.transaction.get().source)
  })

  destNetwork = computed(() => {
    return getNetworkConfig(this.transaction.get().destination)
  })

  indexerClient = computed(() => {
    const { source, destination } = this.transaction.get()

    return safeIndexerClient({ source, destination })
  })

  get flow() {
    return this.computeFlow()
  }

  control_key() {
    return this.hash()
  }

  get status() {
    return this.running_state.value
  }

  async start() {
    if (this.running_state.value === "running") {
      this.logger.info("Resumption ignored. Transaction is running")
      return
    }

    if (TxImpl.is_completed(this.transaction.get(), this.state.mode)) {
      this.logger.info("Resumption ignored. Transaction is complete")
      this.running_state.value = "stop"
      return
    }

    this.running_state.value = "running"
    this.logger.info("Resuming transaction")

    const abortController = new AbortController()
    this.startTracking({ signal: abortController.signal })

    abortController.signal.addEventListener("abort", () => {
      this.stop()
    })

    this.abortController.abort()
    this.abortController = abortController
  }

  async pause() {
    throw new Error("Pause functionality not implemented")
  }

  async stop() {
    this.abortController.abort()

    if (this.running_state.value !== "running") {
      this.logger.info("Pause ignored. Transaction isn't running")
      return
    }

    if (TxImpl.is_completed(this.transaction.get(), this.state.mode)) {
      this.logger.info("Pause ignored. Transaction is complete")
      this.running_state.value = "stop"
      return
    }

    this.logger.info("Stopping transaction")
    this.running_state.value = "stop"
  }

  hash() {
    return this._hash
  }

  computeFlow() {
    const transaction = this.transaction.get()
    const dest_network = safeNetworkConfig(transaction.destination)

    const readMachineKey = TxImpl.key_infer({
      tx: transaction,
      mode: this.state.mode,
      priority: "token",
      dest_config: pipe(dest_network, O.getOrThrow),
    })

    return pipe(
      readMachineKey,
      O.map((machine_key) => Array.from(TxFlow.read(machine_key))),
      O.getOrElse(() => TxFlow.get("standard")),
    )
  }

  private async syncRunningState<
    TRes,
    T extends (...args: unknown[]) => Promise<TRes>,
  >(fn: T) {
    try {
      this.running_state.value = "running"
      return await fn()
    } finally {
      this.running_state.value = "stop"
    }
  }

  async initializeSend({
    signal = this.abortController.signal,
  }: {
    signal: AbortSignal
  }) {
    const transaction = this.transaction.get()

    if (NETWORK_ENV !== transaction.networkEnv) {
      return toast.error(
        `This transaction was performed on the "${transaction.networkEnv}".
        Please switch environment to proceed`,
        {
          duration: 500000,
        },
      )
    }

    const { source } = pipe(
      O.all({
        source: safeNetworkConfig(transaction?.source),
        destination: safeNetworkConfig(transaction?.destination),
      }),
      O.getOrThrowWith(() => {
        throw new Error(
          `Setup Terminated: Failed to resolve source/destination network. NetworkEnv(${transaction?.networkEnv})`,
        )
      }),
    )

    const _beginTracking = async () => {
      logger.debug("Dispatched Event recorded. Proceeding to tracking")
      return this.syncRunningState(() => this.beginTracking(transaction))
    }

    const resumeSuspendedTx = async (
      payload: TxResumptionPayload,
      signal: AbortSignal,
    ) => {
      logger.debug("Using Resumption Logic")

      try {
        const events = Resumption.resumeTx({
          source,
          transaction,
          payload,
        })

        for await (const event of events) {
          if (signal.aborted) {
            break
          }

          Resumption.recordEvent(event)

          matchChain(source.chainId, {
            relay: () => {
              if (event.kind === "CommitmentHash") {
                logger.info("Tracking from CommitmentHash for Relay")
                _beginTracking()
              }
            },
            _: () => {
              if (event.kind === "IPostRequest") {
                logger.info("Tracking from IPostRequest for Other networks")
                _beginTracking()
              }
            },
            none: () => {
              logger.warn(
                "Anomaly: Invalid `chainId` Provided",
                source?.chainId,
              )
            },
          })
        }
      } catch (err) {
        this.running_state.value = "stop"
        logger.error("ResumptionError", err)
        toast.error("Transaction error", {
          description: getErrorMessage(err),
        })

        this.dispatchEvent(
          new CustomEvent("error/init", {
            detail: {
              kind: "error",
              txHash: this.hash,
              error: err,
            },
          }),
        )
      }
    }

    if (TxImpl.is_done_streaming(transaction)) {
      return logger.info("Transaction completed. Skip tracking")
    }

    pipe(
      Resumption.read(transaction),
      O.match({
        onSome: (v) => resumeSuspendedTx(v, signal),
        onNone: () =>
          this.legacyInitialization(transaction).then(() => _beginTracking()),
      }),
    )
  }

  async autoTimeout() {
    const tx = this.transaction.get()

    const client = await this.indexerClient.get()
    StatusEventObserver.watchForTimeoutProgress({
      signal: this.abortController.signal,
      client,
      interval: 5000,
      transaction: tx,
      handler: () => {
        this.triggerRollback()
      },
    })
  }

  token = computed(() => {
    return TxImpl.match(this.transaction.get(), {
      transfer: (tx) => TxImpl.token(tx),
      _: () => {
        throw new Error("Inscription Transaction not found")
      },
    })
  })

  async legacyInitialization(transaction: Transaction) {
    logger.debug("Using Legacy Initialization Logic from", transaction.source)

    if (!transaction || TxImpl.isDelivered(transaction)) {
      logger.debug("Transaction completed. Initialization not necessary")
      return
    }

    if (transaction.progress.Dispatched?.status.kind !== "Dispatched") {
      logger.debug("Awaiting Dispatched Event")
      return new Promise((res, reject) => {
        const timer_id = setTimeout(() => {
          reject(new Error("Legacy Initialization Timed out"))
        }, ms("2 minutes"))

        // watch for request to be defined
        const unsubscribe = observe(transaction, (change) => {
          // when the dispatched property is set then beginTracking
          if (change.type === "add" && change.name === "request") {
            clearTimeout(timer_id)
            res(undefined)
            unsubscribe()
            // They both required IPostRequest to begin tracking
            const transaction = this.transaction.get()
            this.syncRunningState(() => this.beginTracking(transaction))
          }
        })
      })
    }
  }

  private async beginTracking(transaction: Transaction): Promise<void> {
    const logger_ = logger.withTag("Tracking")
    logger_.info("Begin tracking")

    const client = await this.indexerClient.get()
    const signal = this.abortController.signal
    const tx_hash = transaction.transaction_hash

    if (TxImpl.is_done_streaming(transaction)) {
      return logger.info("Transaction completed. Skip tracking")
    }

    // ensure commitment hash is present
    const commitment = TxImpl.commitment(transaction)

    if (O.isNone(commitment)) {
      logger_.error("Commitment Hash missing")
      toast.error("StreamError: Commitment Hash missing")
      return
    }

    // ensure IPOST Request is set
    if (!transaction.request) {
      logger_.info("Setting missing `IPostRequest` in Tx Record.")

      const request = await fetchIPostRequestByCommitmentHash({
        client,
        commitment_hash: commitment.value,
      })

      if (!request) {
        logger_.error("Anomaly: Unable to find IPOSTRequest for Commitment")
        return
      }

      transaction.request = request
    }

    this.show_claim_button_if_delivery_status_exceeds_wait_time()

    const streamer = new IndexerClientStream({
      transaction,
      client: client,
    })

    const events = trackTransaction({
      streamer,
      transaction,
    })

    const event_logger = logger_.withTag("event")

    await this.updateMissedEvents({ mode: "send" })

    for await (const write_event of events) {
      // @ts-expect-error I know the kind
      event_logger.debug(write_event.kind, write_event, write_event.value?.kind)

      if (signal.aborted) {
        logger_.trace("Stopping stream. Component Unmounted")
        break
      }

      if (
        write_event.kind === "Close" ||
        TxImpl.isClientFinalized(transaction)
      ) {
        event_logger.trace("Stream ended")
        break
      }

      if (write_event.kind === "Error") {
        event_logger.trace("Stop Streaming. Error", write_event)
        toast.error("Error Watching Transaction", {
          description: getErrorMessage(write_event.error),
        })
      }

      if (write_event.kind !== "Progress") continue

      if (write_event.value.kind === "Timeout") {
        TransactionStoreInstance.progressRequest(tx_hash, {
          kind: write_event.value.kind,
        })

        this.state.mode = "rollback"
        logger_.trace("Stopping stream. Broke at Timeout")
        break
      }

      event_logger.trace("Progress", write_event.kind, write_event)
      TransactionStoreInstance.progressRequest(tx_hash, write_event.value)

      // Important: Please do not await this promise
      this.updateMissedEvents({ mode: "send" })

      if (
        isEVMChain(transaction.source) &&
        isRelayChain(transaction.destination)
      ) {
        // DestinationDelivered should be saved
        // HyperbridgeVerified for EVM -> Relay tx
        if (write_event.value.kind === "DestinationDelivered") {
          TransactionStoreInstance.progressRequest(
            tx_hash,
            {
              ...write_event.value,
              kind: "HyperbridgeVerified",
            },
            { overwrite: true },
          )
        }
      }
    }

    await this.updateMissedEvents({ mode: "send" })

    logger_.trace("Stream closed")
  }

  private async beginRollback(
    transaction: Transaction,
    { signal }: { signal: AbortSignal },
  ) {
    const _logger = logger.withTag("TrackingTimeoutEvents")
    const indexer_client = await this.indexerClient.get()

    try {
      this.state.tracking = true
      const streamer = new IndexerTimeoutStream({
        client: indexer_client,
        transaction,
      })

      const events = trackTransaction({
        transaction,
        streamer: streamer,
      })

      const event_logger = _logger.withTag("event")

      await this.updateMissedEvents({
        mode: "rollback",
      })

      event_logger.debug("Starting stream")
      for await (const event of events) {
        // @ts-expect-error I know the kind
        event_logger.debug(event.kind, event, event.value?.kind)

        if (signal.aborted) {
          break
        }

        if (event.kind === "Error") {
          throw event.error
        }

        if (event.kind !== "Progress") continue

        TransactionStoreInstance.progressTimedOutRequest(
          this._hash,
          event.value,
        )

        // Never await this Promise
        this.updateMissedEvents({
          mode: "rollback",
        })
      }

      await this.updateMissedEvents({
        mode: "rollback",
      })

      event_logger.debug("Stream stopped")
    } catch (err) {
      toast.error("Transaction Error", {
        description: getErrorMessage(err),
        duration: Number.POSITIVE_INFINITY,
      })
    } finally {
      this.state.tracking = false
    }
  }

  /**
   * Reads all the events for this transaction and write missing events to store
   * @param params
   */
  async updateMissedEvents({ mode }: { mode: TxMode }) {
    try {
      const transaction = this.transaction.get()
      const client = await this.indexerClient.get()
      const signal = this.abortController.signal

      const missed_events = await fetchAndSetMissedEvents({
        transaction: transaction,
        client,
        mode: mode,
      })

      for (const tx_event of missed_events) {
        if (signal.aborted) {
          return
        }

        if (mode === "send") {
          if (!TxEventImpl.is_send(tx_event)) continue

          TransactionStoreInstance.progressRequest(
            transaction.transaction_hash,
            tx_event,
            {
              overwrite: true,
            },
          )
        }

        if (mode === "rollback") {
          if (!TxEventImpl.is_rollback(tx_event)) continue
          TransactionStoreInstance.progressTimedOutRequest(
            transaction.transaction_hash,
            tx_event,
          )
        }
      }
    } catch (err) {
      logger.error(new Error("Failed to update missing events", { cause: err }))
    }
  }

  initializeRollback({
    signal = this.abortController.signal,
  }: {
    signal?: AbortSignal
  }) {
    const _logger = this.logger.withTag("initializeRollback")
    const transaction = this.transaction.get()

    // Ensure timeoutProgress has it's own DispatchEvent
    // @ts-expect-error Fix missing event
    if (!TxImpl.timeout_contains(transaction, "Dispatched")) {
      this.triggerRollback()
    }

    logger.log("2 > Iniitalizing Rollback for", transaction.transaction_hash)
    if (!transaction) {
      _logger.info("Transaction not found")
      return
    }

    if (NETWORK_ENV !== transaction.networkEnv) {
      toast.error(
        `This transaction was performed on the "${transaction.networkEnv}".
            Please switch environment to proceed`,
        {
          duration: 500000,
        },
      )
      return
    }

    const destination = TxImpl.read_progress_event(
      transaction,
      "DestinationDelivered",
    )

    if (O.isSome(destination)) {
      // redirect to tx page if destination is delivered
      _logger.info(
        "This transaction got to the destination network. Redirecting to Transaction page",
      )

      this.state.mode = "send"
      return
    }

    if (TxImpl.is_timeout_finalized(transaction)) {
      _logger.info("Transaction is timed out")

      return
    }

    this.syncRunningState(() => {
      return this.beginRollback(transaction, { signal: signal })
    })
  }

  startTracking(params: { signal: AbortSignal }) {
    if (this.state.mode === "send") {
      this.initializeSend({ signal: params.signal })
    }

    if (this.state.mode === "rollback") {
      this.initializeRollback({ signal: params.signal })
    }
  }

  claimer = computed(() => {
    const { evm } = this.walletManager.accounts
    const account = evm?.address

    if (!account) {
      throw new Error("ClaimError: Connect EVM Wallet to Claim your funds")
    }

    return new EvmClaimFunds(account as HexString, this.transaction.get())
  })

  async initializeClaim() {
    this.state.claimInitState = "pending"
    const indexer_client = await this.indexerClient.get()

    const transaction = this.transaction.get()
    const normalize = TxNormalizer.forIndexerStatus(transaction)

    const [original, last_status] = await pipe(
      TxImpl.commitment(transaction),
      O.map(async (commitment) => {
        const request = await indexer_client.queryRequestWithStatus(commitment)

        if (!request?.statuses) {
          throw new Error("IPOSTRequest not found")
        }

        const match = request.statuses.at(-1)
        if (!match) return Promise.reject("Error reading latest status")

        return [match, normalize(match)] as const
      }),
      O.getOrThrowWith(() => new Error("Can only claim valid requests")),
    )

    if (
      original.status === "DESTINATION_FINALIZED_TIMEOUT" ||
      original.status === "PENDING_TIMEOUT"
    ) {
      TransactionStoreInstance.progressRequest(this.hash(), {
        kind: "Timeout",
      })
      return
    }

    if (last_status.kind === "DestinationDelivered") {
      const empty_destination = {
        kind: "DestinationDelivered",
        block_hash: undefined,
        block_number: undefined,
        transaction_hash: undefined,
      }

      // @ts-expect-error Nothing like the movement
      TransactionStoreInstance.progressRequest(this.hash(), empty_destination)
      return
    }

    await this.updateMissedEvents({ mode: "send" })
    await this.claimer.get().initialize()

    this.state.claimInitState = "ready"
  }

  private async claimFunds(): Promise<void> {
    const transaction = this.transaction.get()

    try {
      const claimer = this.claimer.get()
      const { txHash } = await claimer.execute()

      const receipt = await waitForTransactionReceipt(WagmiConfig, {
        hash: txHash,
        chainId: claimer.destination.chainId,
        confirmations: 1,
      })

      setTimeout(
        () =>
          this.updateMissedEvents({
            mode: "send",
          }),
        3000,
      )

      TransactionStoreInstance.progressRequest(this.hash(), {
        kind: "DestinationDelivered",
        block_hash: receipt.blockHash,
        block_number: receipt.blockNumber,
        transaction_hash: txHash,
      })

      toast.success("Transaction Successful", {
        description:
          transaction.protocol.kind === "Transfer"
            ? "You've claimed your funds"
            : "You've completed your cross-chain inscription",
      })
    } catch (err: unknown) {
      console.dir(err)
      toast.error("Claim Error", {
        description: "Failed to claim funds",
      })
    }
  }

  private async claimRefund(): Promise<void> {
    const tx_hash = this._hash
    const transaction = this.transaction.get()

    const { evm } = this.walletManager.accounts
    const account = evm?.address as HexString | undefined
    const sourceChain = transaction.source
    const trace = TxImpl.read_trace(transaction)

    if (!account) {
      toast.error("Connect EVM account to claim refund")
      return
    }

    try {
      const network = getNetworkConfig(sourceChain)
      const call_data = pipe(
        TxImpl.read_timeout_event(transaction, "HyperbridgeFinalized"),
        O.map((event) => event.status.calldata),
        O.getOrThrowWith(
          () => new Error("Refund failed. Unable to retreive `Calldata`"),
        ),
      )

      await NetworkImpl.match(network, {
        evm: async (config) => {
          await switchChain(WagmiConfig, { chainId: config.chainId })

          const hostParams = await readContract(WagmiConfig, {
            abi: EvmHostABI,
            address: NetworkImpl.host_addr(config),
            functionName: "hostParams",
            chainId: config.chainId,
          })

          const { args, functionName } = decodeFunctionData({
            abi: HandlerV2ABI,
            data: call_data,
          })

          const hash = await writeContractBuffered(
            WagmiConfig,
            {
              account,
              chainId: config.chainId,
            },
            {
              abi: HandlerV2ABI,
              address: hostParams.handler,
              functionName,
              args,
            } as Parameters<typeof writeContractBuffered>[2],
          )

          const receipt = await waitForTransactionReceipt(WagmiConfig, {
            hash: hash,
            chainId: config.chainId,
            confirmations: 1,
          })

          TransactionStoreInstance.progressTimedOutRequest(tx_hash, {
            kind: "Receipt",
            block_hash: receipt.blockHash,
            block_number: receipt.blockNumber,
            transaction_hash: hash,
          })
        },
        substrate: async () => {
          try {
            const args = hexToBytes(call_data).slice(2)
            const api = await SubstrateApiStore.get(sourceChain)
            const tx = api.tx.ismp.handleUnsigned(args)

            function doSubmit(): Promise<{ transactionHash: HexString }> {
              return new Promise((resolve, reject) => {
                let unsub = () => {}

                tx.send(
                  async ({
                    isFinalized,
                    isInBlock,
                    isError,
                    dispatchError,
                    txHash,
                    // status,
                  }) => {
                    if (isFinalized || isInBlock) {
                      unsub()
                      resolve({
                        transactionHash: txHash.toHex(),
                      })
                    } else if (isError) {
                      unsub()
                      console.error(
                        "Unsigned transaction failed: ",
                        dispatchError,
                      )
                      reject(dispatchError)
                    }
                  },
                )
                  .then((unsubcribe) => {
                    unsub = unsubcribe
                  })
                  .catch((err) => reject(err))
              })
            }

            const { transactionHash } = await doSubmit()

            TransactionStoreInstance.progressTimedOutRequest(tx_hash, {
              kind: "Receipt",
              // @ts-expect-error Not required for Substrate
              block_hash: null,
              // @ts-expect-error Not required for Substrate
              block_number: null,
              transaction_hash: transactionHash,
            })
          } catch (err) {
            const message = getErrorMessage(err)
            if (message.includes("temporarily ban")) {
              toast.info("Try re-submitting in a few minutes")
            }
            throw err
          }
        },
        _: () => {
          throw new Error("SHOULD NEVER GET HERE!")
        },
      })

      await this.updateMissedEvents({
        mode: "rollback",
      })

      toast.success("Transaction Successful", {
        description:
          transaction.protocol.kind === "Transfer"
            ? "You've recovered your funds"
            : "You've timed out your transaction",
      })
    } catch (err) {
      if (O.isSome(trace)) {
        UserTracking.transaction_reversal_failed(trace.value, err)
      }
      logger.error(new Error("Reclaim failed after Timeout", { cause: err }))
      toast.error("Transaction Error", {
        description: getErrorMessage(err),
      })
    }
  }

  doClaimFunds() {
    this.state.claimPromise = fromPromise(this.claimFunds())
  }

  doClaimRefund() {
    this.state.claimPromise = fromPromise(this.claimRefund())
  }

  watching = false

  private async show_claim_button_if_delivery_status_exceeds_wait_time() {
    const tx = this.transaction.get()
    const abort = this.abortController

    if (!TxImpl.is_self_delivery_enabled(tx)) return
    if (TxImpl.is_timed_out(tx)) return

    if (TxImpl.progress_contains(tx, "DestinationDelivered")) {
      this.state.showClaimButton = "DestinationDelivered"
      return
    }

    this.watching = true

    try {
      const events = TransactionProgressController.wait_for_delivery(tx, {
        signal: abort.signal,
      })

      for await (const entry of events) {
        if (entry.state === "over-wait-time") {
          const prev = this.state.showClaimButton
          this.state.showClaimButton =
            prev === "DestinationDelivered" ? prev : "WaitTimeOver"

          this.initializeClaim()
          break
        }
      }
    } catch (error) {
      logger.error(error)
    } finally {
      this.watching = false
    }
  }

  destroy() {
    this.abortController.abort()
  }

  static async *check_status(
    tx: Transaction,
    id: string,
    opts: { signal: AbortSignal },
  ) {
    while (true) {
      try {
        logger.trace(`[check_status] Reading TxStatus - ${id}`)

        if (opts.signal.aborted) {
          break
        }

        await delay(3000)

        const timeout_status = TxImpl.read_progress_event(tx, "Timeout")

        // break if transaction is timed out
        if (O.isSome(timeout_status)) break

        const last_status = await Effect.runPromise(getLastStatus(tx))

        if (TxOrder.lt(last_status.kind, "DestinationDelivered")) {
          continue
        }

        if (TxOrder.gte(last_status.kind, "DestinationDelivered")) {
          yield last_status
          break
        }
      } catch (err) {
        await delay(30000)
        logger.trace("ClaimObserver: Failed reading last status.", err)
      }
    }
  }

  private triggerRollback() {
    const transaction = this.transaction.get()

    const trace = TxImpl.read_trace(transaction)

    if (O.isSome(trace)) {
      UserTracking.transaction_reversal_begin(trace.value)
    }

    this.state.flow = this.computeFlow()
    transaction.status = "Timeout"

    // @ts-expect-error Fix soon. Add timestamp to this copy of the Dispatched event
    transaction.timeoutProgress.Dispatched = transaction.progress.Dispatched
  }

  static async *wait_for_delivery(
    tx: Transaction,
    options: {
      waitTime?: number
      signal: AbortSignal
    },
  ) {
    const logger_ = logger.withTag("waitForDelivery")
    const { waitTime = 20_000, signal } = options

    if (isRelayChain(tx.destination)) {
      yield { state: "not-required" as const }
      return
    }

    const end_after = Date.now() + 3600 * 1000

    let state: TimerState = {
      startTime: null,
      endTime: null,
      value: "idle",
    }

    while (true) {
      if (signal.aborted) {
        break
      }

      const now = Date.now()

      // end if it's been running for over an hour
      if (now > end_after) {
        yield { status: "over-an-hour" } as const
        return
      }

      await delay(1000)

      if (state.value === "idle") {
        logger_.trace(
          "Received",
          TxImpl.progress_contains(tx, "HyperbridgeFinalized"),
        )

        // start listening countdown when
        if (TxImpl.progress_contains(tx, "HyperbridgeFinalized")) {
          const start_time = Date.now()

          state = {
            value: "running",
            startTime: start_time,
            endTime: start_time + waitTime,
          }
        }
      }

      if (state.value === "running") {
        if (Date.now() >= state.endTime) {
          logger_.trace("Completed", state.value)
          yield { state: "over-wait-time" as const }
          return
        }
      }
    }

    if (!signal.aborted) {
      throw new Error("DeliveryTimeoutError: Shouldn't reach end of function")
    }

    type TimerState =
      | {
          value: "idle"
          startTime: null
          endTime: null
        }
      | {
          value: "running"
          startTime: number // in milliseconds
          endTime: number // in milliseconds
        }
  }

  private _addSubscription() {
    const current = this.transaction.get()
    const initial_status = current.status

    // don't subscribe if completed
    if (current.completed) return

    autorun(() => {
      const tx = this.transaction.get()

      if (TxImpl.is_timeout_finalized(tx)) {
        this.dispatchEvent(new CustomEvent("rollback/TimedOut", { detail: tx }))
      }

      if (initial_status !== "Timeout" && tx.status === "Timeout") {
        this.dispatchEvent(new CustomEvent("send/Timeout", { detail: tx }))
      }

      if (tx.completed) {
        this.dispatchEvent(new CustomEvent("send/Destination", { detail: tx }))
      }
    })
  }

  override addEventListener(
    type:
      | "send/Destination"
      | "send/Timeout"
      | "rollback/TimedOut"
      | "error/init",
    callback: EventListenerOrEventListenerObject | null,
    options?: AddEventListenerOptions | boolean,
  ): void {
    super.addEventListener(type, callback, options)
  }
}
