import { NetworkImpl, TokenImpl } from "@hyperbridge-fe/shared/factories"
import type { EVMChainConfig } from "@hyperbridge-fe/shared/types"
import { Either, Equal, Match, pipe } from "effect"
import { autorun, runInAction, toJS } from "mobx"
import { fromPromise } from "mobx-utils"
import { isAppStaging, isDevelopment } from "@/config/constants"
import { assetManager } from "@/config/services/asset-manager.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { SubstrateBridgeHelper } from "@/lib/bridge-params-helpers/substrate-bridge.ts"
import { getErrorMessage, isUserRejectedError } from "@/lib/error.helpers.ts"
import { BalanceImpl } from "@/lib/factories/balance"
import { FiatImpl } from "@/lib/factories/fiat"
import { FeesHelper } from "@/lib/fees.ts"
import { safeIndexerClient as indexerClientOrThrow } from "@/lib/hyperbridge-indexer.ts"
import { rootLogger } from "@/lib/logger"
import { makeTransferPure } from "@/lib/make-transfer"
import { readFeeTokenMetadata } from "@/lib/fee-token-preparation"
import { isHftToken, getHftRelayerFee } from "@/lib/hft/hyper-fungible-token"
import { HftBridgeTx } from "@/lib/transactions/bridge-hft.ts"
import { PolkadotBridgeTx } from "@/lib/transactions/bridge-polkadot.ts"
import { SubstrateBridgeTx } from "@/lib/transactions/bridge-substrate.ts"
import type { BridgeTxExecutor } from "@/lib/transactions/types.ts"
import { UserTracking } from "@/lib/user-tracking"
import { enteredAmountFormatter } from "@/lib/utils/formatting"
import { O } from "@/lib/utils/fp.helpers"
import { toast } from "@/lib/utils/toast.tsx"
import { getNetworkConfig, safeNetworkConfig } from "@/lib/utils.ts"
import { WalletManager } from "@/lib/wallet-manager.ts"
import {
  DEFAULT_BALANCE,
  DEFAULT_RELAYER_FEE,
  DEFAULT_RELAYER_FEE_TOKEN,
  INITIAL_TOKEN,
  transferState,
} from "@app/stores/transfer"
import {
  bridgeParams,
  destinationToken,
  sourceToken,
} from "@app/stores/transfer-computed"
import { TransactionStoreInstance } from "@/stores/tx-store.ts"
import type {
  AnyToken,
  AppBalance,
  ChainId,
  Maybe,
  StrictChainId,
} from "@/types"
import type { TxCreationEvents } from "@/types/tx"

export function fetchFees() {
  const logger = rootLogger.withTag("Fees")

  try {
    console.assert(
      transferState.amount,
      "Transfer `amount` needed to estimate gas",
    )

    const bridge_params = bridgeParams.get()
    const token = bridge_params.bridgeParams.token

    if (
      bridge_params.source.group === "evm" &&
      token.__type === "evm" &&
      isHftToken(token)
    ) {
      const feeAmount = getHftRelayerFee(token)
      const source = bridge_params.source as EVMChainConfig

      runInAction(() => {
        transferState.nativeCost = 0n
        transferState.fee = "0"
        transferState.relayerFee = fromPromise(
          Promise.resolve(
            FiatImpl.create({
              amount: Number(feeAmount) / 1e18,
              currency_symbol: "USD",
            }),
          ),
        )
        transferState.relayerFeeToken = fromPromise(
          readFeeTokenMetadata(source).then((meta) =>
            BalanceImpl.create(feeAmount, meta.decimals, meta.symbol),
          ),
        )
      })
      return
    }

    runInAction(() => {
      transferState.relayerFeeToken = DEFAULT_RELAYER_FEE_TOKEN
    })

    const relayer_fee_promise = FeesHelper.get(bridge_params).then((v) => {
      logger.info("GasFee in USD", v)
      runInAction(() => {
        transferState.fee = String(v.amount)
      })
      return v
    })

    runInAction(() => {
      transferState.relayerFee = fromPromise(relayer_fee_promise)
    })
  } catch (err) {
    runInAction(() => {
      transferState.relayerFee = DEFAULT_RELAYER_FEE
      transferState.nativeCost = null
    })

    throw err
  }
}

export function handleTokenChange(destination_token: AnyToken) {
  const source_has_token = tokenRegistry.chainHasToken(
    transferState.sourceChain,
    destination_token.symbol,
  )

  const dest_has_token = tokenRegistry.chainHasToken(
    transferState.destChain,
    destination_token.symbol,
  )

  pipe(
    Match.value({ source_has_token, dest_has_token }),
    Match.when({ source_has_token: true, dest_has_token: true }, () => {
      /** do nothing */
    }),
    Match.orElse((pair) => {
      const first_enabled_pair = findFirstTransferPair({
        token_symbol: destination_token.symbol,
      })

      if (!first_enabled_pair) {
        return rootLogger.error(
          new Error("Panic: State not expected", {
            cause: {
              state: pair,
              meta: transferState,
            },
          }),
        )
      }

      runInAction(() => {
        transferState.sourceChain = first_enabled_pair[0]
        transferState.destChain = first_enabled_pair[1]
      })
    }),
  )

  const source_token = tokenRegistry.getBySymbol(
    transferState.sourceChain,
    destination_token.symbol,
  )

  if (source_token) {
    setToken(source_token)
  }

  refetchSourceBalance({ mode: "foreground" })
}

export function handleNetworkChange(params: {
  source: ChainId
  destination: ChainId
}) {
  const { source, destination } = params

  resetForm()

  const is_transferable = tokenRegistry.isTransferable({
    strict: true,
    source,
    destination,
    token: transferState.token,
  })

  runInAction(() => {
    transferState.sourceChain = source
    transferState.destChain = destination
  })
  refetchSourceBalance({ mode: "foreground" })

  if (is_transferable) return

  // set a valid token
  const source_tokens = tokenRegistry.find_transferable_token({
    source,
    destination,
  })

  const token = source_tokens.next().value
  if (token) {
    setToken(token)
    refetchSourceBalance({ mode: "foreground" })
    return
  }

  // reset to valid pair
  const default_pair = tokenRegistry.find_initial_pair({
    source,
  })

  const pair = default_pair.next().value

  if (pair) {
    runInAction(() => {
      setToken(pair.token)
      transferState.sourceChain = pair.source
      transferState.destChain = pair.destination
    })
    refetchSourceBalance({ mode: "foreground" })
    return
  }

  const fallback_pair = findFirstTransferPair({
    token_symbol: transferState.token.symbol,
  })
  const fallback_token = fallback_pair
    ? tokenRegistry.getBySymbol(fallback_pair[0], transferState.token.symbol)
    : null

  if (fallback_pair && fallback_token) {
    runInAction(() => {
      setToken(fallback_token)
      transferState.sourceChain = fallback_pair[0]
      transferState.destChain = fallback_pair[1]
    })
    refetchSourceBalance({ mode: "foreground" })
    return
  }

  rootLogger.error(
    new Error(
      `Panic: Unable to infer Transfer token between from Source(${source}) -> Destination(${destination})`,
      {
        cause: {
          meta: {
            source,
            destination,
            is_transferable,
            token_symbol: transferState.token.symbol,
          },
        },
      },
    ),
  )
}

function findFirstTransferPair(params: {
  token_symbol: string
}): Maybe<Readonly<[StrictChainId, StrictChainId]>> {
  const { token_symbol } = params

  const pairs = tokenRegistry.transferIndexer.find_transfer_pair(token_symbol)

  for (const tr_chain_pair of pairs) {
    const [source, dest] = tr_chain_pair.map((chain_id) => {
      return O.fromNullable(getNetworkConfig(chain_id))
    })

    const enabled_pair = pipe(
      O.all([source, dest]),
      O.tap((networks) => {
        const all_enabled = networks.every((config) => {
          return NetworkImpl.is_enabled(config)
        })

        // find first enabled pair
        return all_enabled ? O.some(undefined) : O.none()
      }),
      O.map(([source, dest]) => {
        return [
          source.chainId as StrictChainId,
          dest.chainId as StrictChainId,
        ] as const
      }),
      O.getOrElse(() => null),
    )

    if (!enabled_pair) continue

    return enabled_pair
  }

  return null
}

/**
 * Fetches and updates the balance for the source chain's active account
 * If no account is connected, sets balance to 0
 * Updates balance in transfer state with the fetched value
 */
export function refetchSourceBalance(params: {
  mode: "background" | "foreground"
}) {
  rootLogger.withTag("Refreshing source balance")
  const { mode = "foreground" } = params
  const { sourceChain } = transferState

  const sourceAccount = WalletManager.getActiveAccountByChain(sourceChain)

  if (!sourceAccount) {
    runInAction(() => {
      transferState.asyncBalance = DEFAULT_BALANCE
    })
    return
  }

  const source_network_token = pipe(sourceToken.get(), O.getOrNull)

  if (!source_network_token) {
    rootLogger.debug("Token not found. Resetting Token and Balance")
    runInAction(() => {
      setToken(INITIAL_TOKEN)
      transferState.asyncBalance = DEFAULT_BALANCE
    })
    return
  }

  const async_balance = pipe(
    safeNetworkConfig(sourceChain),
    O.map(async (source_network) => {
      return await assetManager
        .refreshBalance({
          network: source_network,
          token: source_network_token,
        })
        .then((balance) => {
          setBalance(balance)

          return balance
        })
    }),
    O.getOrElse(() => Promise.resolve(DEFAULT_BALANCE)),
  )

  if (mode === "foreground") {
    runInAction(() => {
      transferState.asyncBalance = fromPromise(async_balance)
    })
  }
}

export async function verifyTransaction() {
  try {
    runInAction(() => {
      transferState.bridgeSetupPending = true
    })
    const bridge_params = bridgeParams.get()

    const network = bridge_params.source
    const params = bridge_params.bridgeParams

    const initializeTransaction = async (): Promise<
      BridgeTxExecutor<unknown>
    > => {
      if (network.group === "evm") {
        const token = params.token
        const useHft =
          token &&
          token.__type === "evm" &&
          isHftToken(token)

        if (!useHft) {
          throw new Error("Only HFT transfers are supported from EVM chains")
        }

        const instance = new HftBridgeTx(bridge_params)

        await instance.initialize()

        return instance
      }

      const indexer_client = indexerClientOrThrow(params)

      if (network.group === "relay") {
        if (params.token.__type === "substrate") {
          const instance = new SubstrateBridgeTx(
            new SubstrateBridgeHelper(bridge_params, params.token),
            WalletManager.getSigner("substrate"),
          )

          await instance.initialize({
            indexerClient: await indexer_client,
          })

          return instance
        }

        const instance = new PolkadotBridgeTx(
          bridge_params,
          WalletManager.getSigner("substrate"),
        )

        await instance.initialize()

        return instance
      }

      if (network.group === "substrate") {
        const instance = new SubstrateBridgeTx(
          new SubstrateBridgeHelper(bridge_params, params.token),
          WalletManager.getSigner("substrate"),
        )

        await instance.initialize({
          indexerClient: await indexer_client,
        })

        return instance
      }

      throw new Error("Transaction failed. Unsupported network")
    }

    const value = await initializeTransaction()
    runInAction(() => {
      transferState.bridgingTrigger = O.some(value)
    })
  } finally {
    runInAction(() => {
      transferState.bridgeSetupPending = false
    })
  }
}

export async function makeTransfer(
  trigger: BridgeTxExecutor,
  events: {
    handleEvents: (
      payload: Extract<
        TxCreationEvents,
        { kind: "Ready" | "CommitmentHash" }
      > & {
        amount: bigint
      },
    ) => void
  },
  store = TransactionStoreInstance,
) {
  try {
    runInAction(() => {
      transferState.transactionPending = true
    })

    const params = trigger.params.bridgeParams
    const network = safeNetworkConfig(params.source).pipe(
      O.getOrThrowWith(() => new Error("Network config missing")),
    )

    if (!params.recipient) {
      return toast.error("Recipient address is missing")
    }

    const trace_meta = UserTracking.start_transaction("transfer", {
      source: params.source,
      amount: String(params.amount),
      destination: params.destination,
      token_symbol: params.token.symbol,
    })

    // initiate the relevant transaction
    try {
      const tx_events = makeTransferPure({
        trigger,
        store: store,
        source: network,
        events: {
          handleNavigation: (v) => {
            runInAction(() => {
              transferState.transactionPending = false
            })

            events.handleEvents({ ...v, amount: params.amount })
          },
        },
      })

      for await (const event of tx_events) {
        if (event.kind === "Closed") {
          resetForm()
        }
      }
    } catch (err) {
      if (isUserRejectedError(err)) {
        UserTracking.user_cancelled_tx(trace_meta)
      } else {
        UserTracking.transaction_failed(trace_meta, err)
      }

      rootLogger.error(err, trace_meta)
      toast.error("Bridging failed", {
        description: getErrorMessage(err),
      })
    }
  } finally {
    runInAction(() => {
      transferState.transactionPending = false
    })
  }
}

function setToken(value: AnyToken) {
  runInAction(() => {
    transferState.token = value
    setBalance(BalanceImpl.create(0n, value.decimals, value.symbol))
  })
}

/**
 * Sets the balance of the source token
 * @param value
 */
function setBalance(value: AppBalance) {
  const curr_token = transferState.token

  if (
    curr_token.symbol === value.symbol &&
    curr_token.decimals !== value.decimals
  ) {
    rootLogger.warn(
      "Anomaly detected: Token/Balance mismatch detected: Attempting to set a balance that isn't for the currently selected token",
      { current_token: toJS(curr_token), token: value },
    )
    return
  }

  runInAction(() => {
    transferState.syncBalance = value
  })
}

export function setTransferAmount(value: string | AppBalance) {
  const data = setTransferAmountPure(value)
  transferState.amountBigInt = data.amountBigInt
  transferState.amount = data.amount
}

export function setTransferAmountPure(amount_as_string: string | AppBalance): {
  amount: string
  amountBigInt: bigint
} {
  const normalizeAmount = (value: string) => {
    return value.replace(/,/g, "")
  }

  if (BalanceImpl.is(amount_as_string)) {
    return {
      amountBigInt: amount_as_string.value,
      amount: normalizeAmount(
        BalanceImpl.formatUsing(amount_as_string, enteredAmountFormatter),
      ),
    }
  }

  const safe = BalanceImpl.safeParse(
    amount_as_string,
    transferState.token.decimals,
    transferState.token.symbol,
  )

  if (Either.isLeft(safe)) {
    return {
      amount: normalizeAmount(amount_as_string),
      amountBigInt: 0n,
    }
  }

  return {
    amount: normalizeAmount(amount_as_string),
    amountBigInt: safe.right.value,
  }
}

export function adjustBalanceByPercentage(
  percent_value: number,
  final_balance: AppBalance,
) {
  if (!(percent_value > 0)) {
    return BalanceImpl.create(0n, final_balance.decimals, final_balance.symbol)
  }

  const new_value = (final_balance.value * BigInt(percent_value)) / 100n

  return BalanceImpl.create(
    new_value,
    final_balance.decimals,
    final_balance.symbol,
  )
}

function resetForm() {
  runInAction(() => {
    setTransferAmount("")
    transferState.fee = "0"
    transferState.percentage = null
    transferState.bridgingTrigger = O.none()
    transferState.bridgeSetupPending = false
    transferState.transactionPending = false
  })
}

export function fullRefresh() {
  const _logger = rootLogger.withTag("fullRefresh")

  _logger.trace("Starting")
  pipe(
    O.gen(function* () {
      const network = yield* safeNetworkConfig(transferState.sourceChain)
      return assetManager.refreshBalances({
        network,
      })
    }),
    O.match({
      onNone: () => _logger.error("Failed to refresh balances"),
      onSome: () => _logger.trace("Refresh command dispatched"),
    }),
  )
}

function makeGlobalSubscriptions() {
  const subscriptions = new Set<() => void>()

  function run() {
    const controller = new AbortController()

    assetManager.addEventListener(
      "balanceUpdated",
      function syncTransferStoreBalance(event) {
        const key = `${transferState.sourceChain}/${transferState.token.symbol}`

        if (event.detail.key === key) {
          const entry = event.detail.entry
          const new_balance = BalanceImpl.fromOption(entry.balance)

          const balance = pipe(
            transferState.syncBalance,
            BalanceImpl.as(new_balance.value),
          )

          // console.log("new balance", transferState.syncBalance, new_balance)
          setBalance(balance)
        }
      },
      { signal: controller.signal },
    )

    const unsubs = [
      () => controller.abort(),
      autorun(() => {
        if (!(isAppStaging || isDevelopment)) return
      }),

      autorun(function refreshAllSourceTokensWhenSourceChanges() {
        rootLogger.trace("[Autorun]:refreshAllSourceTokensWhenSourceChanges")
        pipe(
          safeNetworkConfig(transferState.sourceChain),
          O.map((network) => assetManager.refreshBalances({ network })),
          O.getOrNull,
        )
      }),

      autorun(function sourceAndDestinationTokensShouldBeUnique() {
        const _token = transferState.token
        const dest = destinationToken.get()
        const source = sourceToken.get()

        if (O.isNone(source) || O.isNone(dest)) return

        if (
          Equal.equals(
            TokenImpl.compare(source.value),
            TokenImpl.compare(dest.value),
          )
        ) {
          console.warn(
            "Anomaly detected:",
            `Derived Source and Destination tokens are identical. Please ensure they are different.`,
            _token,
          )
        }
      }),
    ]

    for (const unsub of unsubs) {
      subscriptions.add(unsub)
    }
  }

  return {
    run: run,
    clear: () => {
      subscriptions.forEach((fn) => fn())
      subscriptions.clear()
    },
  }
}

const globalSubscriptions = makeGlobalSubscriptions()
globalSubscriptions.run()

if (import.meta.hot) {
  import.meta.hot.on("vite:beforeUpdate", () => {
    // console.log("HMR before update:", data)
    globalSubscriptions.clear()
  })

  import.meta.hot.on("vite:afterUpdate", () => {
    // console.log("HMR update has been applied:", data)
    globalSubscriptions.run()
  })
}
