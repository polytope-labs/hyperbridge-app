import type { SeverityState } from "@components/smart-button.tsx"
import {
  Ethereum,
  isEVMChain,
  isEvmAddress,
  isRelayChain,
  isSubstrateAddress,
  resolveNetworkGroup,
} from "@hyperbridge-fe/shared"
import { Duration, Either, pipe } from "effect"
import type { DurationInput } from "effect/Duration"
import { computed } from "mobx"
import { fromPromise } from "mobx-utils"
import { BRIDGING_PERCENTAGE } from "@/config/constants.ts"
import { priceManager } from "@/config/services/price-manager.ts"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { BridgeParamsHelper } from "@/lib/bridge-params-helpers/base.ts"
import { BalanceImpl } from "@/lib/factories/balance.ts"
import { FiatImpl } from "@/lib/factories/fiat.ts"
import { rootLogger } from "@/lib/logger"
import { calculateDotBridgingFee } from "@/lib/tx.helpers.ts"
import { ms } from "@/lib/utils/date.helpers.ts"
import { O } from "@/lib/utils/fp.helpers"
import { safeNetworkConfig } from "@/lib/utils.ts"
import { WalletManager } from "@/lib/wallet-manager.ts"
import { transferState } from "@app/stores/transfer"
import type { AppBalance, ChainId, FiatValue } from "@/types"
import type { HexString } from "@/types/tx"

type Id =
  | "invalid-amount"
  | "insufficient-funds"
  | "require-recipient-address"
  | "minimum-dots-required"
  | "okay"

export const receivedAmount = computed(() => {
  let value = Number(transferState.amount)

  if (
    isRelayChain(transferState.sourceChain) &&
    transferState.token.symbol === "DOT" &&
    value > 0
  ) {
    const fee = value * 0.001

    value -= fee

    if (transferState.destChain === Ethereum.chainId && value > 2) {
      value -= 2
    }

    return value
  }

  return transferState.amount
})

export const senderUsdValue = computed(() => {
  const amount = Number(transferState.amount)

  return fromPromise(
    priceManager
      .get(transferState.token.symbol)
      .then((usd_rate) => FiatImpl.asDollar(amount * usd_rate.amount)),
  )
})

export const receivedUSDAmount = computed(() => {
  const amount = Number(receivedAmount.get())

  return fromPromise(
    priceManager
      .get(transferState.token.symbol)
      .then((usd_rate) => FiatImpl.asDollar(amount * usd_rate.amount)),
  )
})

export const estimatedTransferTime = computed(() => {
  return pipe(
    safeNetworkConfig(transferState.sourceChain),
    Either.fromOption(() => new Error("Error estimating transfer time")),
    Either.flatMap((network) =>
      Either.try({
        try: () => {
          const tokenEstimate = pipe(
            sourceToken.get(),
            O.map((token) => token.estimatedTransferTime),
            O.getOrUndefined,
          )

          return ms(
            String(
              tokenEstimate ?? network.estimatedTransferTime,
            ) as DurationInput,
          )
        },
        catch: (cause) =>
          new Error("Invalid estimated transfer time", { cause }),
      }),
    ),
    Either.map(
      (duration) => `~ ${Duration.format(duration).replace("m", "mins")}`,
    ),
    Either.getOrElse((err) => {
      console.warn("No estimated transfer time found", err)

      return "~ 25 min"
    }),
  )
})

export const txFeeInUSD = computed(async () => {
  return transferState.relayerFee.then(O.some)
})

export const txFeeInNativeToken = computed(
  async (): Promise<O.Option<AppBalance>> => {
    if (isRelayChain(transferState.sourceChain)) {
      return O.none()
    }

    return transferState.relayerFee.then((e) => {
      return priceManager
        .dollarToBalance(e, transferState.syncBalance)
        .then(O.some)
        .catch(O.none)
    })
  },
)

const enteredAmountAsBalance = computed(() => {
  return pipe(safeBalance.get(), BalanceImpl.as(transferState.amountBigInt))
})

export const safeAccountAddress = computed(() => {
  if (isEvmAddress(transferState.account)) {
    return O.some(transferState.account)
  }

  if (isSubstrateAddress(transferState.account)) {
    return O.some(transferState.account)
  }

  return O.none()
})

export const sourceToken = computed(() => {
  return pipe(
    safeNetworkConfig(transferState.sourceChain),
    O.flatMapNullable((network_config) =>
      tokenRegistry.getBySymbol(
        network_config.chainId,
        transferState.token.symbol,
      ),
    ),
  )
})

export const destinationToken = computed(() => {
  return pipe(
    safeNetworkConfig(transferState.destChain),
    O.flatMapNullable((network_config) =>
      tokenRegistry.getBySymbol(
        network_config.chainId,
        transferState.token.symbol,
      ),
    ),
  )
})

export const safeBalance = computed((): AppBalance => transferState.syncBalance)

export const inferSeverity = computed(() => {
  const token_balance = safeBalance.get()
  const entered_amount = enteredAmountAsBalance.get()

  return validateTransfer({
    tokenBalance: token_balance,
    inputAmount: entered_amount,
    destChain: transferState.destChain,
    sourceChain: transferState.sourceChain,
    recipient: transferState.recipient,
  })
})

export function validateTransfer(params: {
  inputAmount: AppBalance
  tokenBalance: AppBalance
  destChain: ChainId
  sourceChain: ChainId
  recipient: string
}): [SeverityState, string, Id] {
  const {
    inputAmount: amountEntered,
    destChain,
    tokenBalance: token_balance,
    sourceChain,
    recipient,
  } = params

  if (token_balance.decimals !== amountEntered.decimals) {
    rootLogger.warn(
      "Anomaly detected",
      "Entered amount and Token balance should have the same decimals",
    )
  }

  const balance_amount = token_balance.value
  const entered_amount = amountEntered.value
  const tokenSymbol = token_balance.symbol

  const is_sufficent = !(entered_amount > balance_amount)
  const has_recipient = isSubstrateAddress(recipient) || isEvmAddress(recipient)

  if (!(entered_amount > 0n)) {
    return ["info", "Enter an amount", "invalid-amount"]
  }

  if (!is_sufficent) {
    return ["error", "Insufficient funds", "insufficient-funds"]
  }

  if (!has_recipient) {
    return ["info", "Enter Recipient address", "require-recipient-address"]
  }

  if (isRelayChain(sourceChain) && tokenSymbol === "DOT") {
    const max_amount = BalanceImpl.parse(
      "3",
      token_balance.decimals,
      token_balance.symbol,
    )

    // minimum bridge amount for Ethereum is 2 dot
    if (destChain === Ethereum.chainId && entered_amount < max_amount.value) {
      return ["error", "Minimum of 3 DOT required", "minimum-dots-required"]
    }
  }

  return ["default", "Continue", "okay"]
}

export const safeRelayerFee = computed(() => {
  return O.fromNullable(transferState?.relayerFee?.value as FiatValue)
})

export const bridgeParams = computed(() => {
  const sourceToken = tokenRegistry.getBySymbol(
    transferState.sourceChain,
    transferState.token.symbol,
  )

  // const timeout_num = safeNum(settingsStore.deadline, -1)

  // if (timeout_num === -1) {
  //   return toast.error(
  //     "Invalid Timeout value set. Timeout should be valid number.",
  //   )
  // }

  // const timeout_in_seconds = Duration.toSeconds(ms(`${timeout_num} minutes`))

  return new BridgeParamsHelper({
    from: transferState.account as HexString,
    source: transferState.sourceChain,
    destination: transferState.destChain,
    amount: transferState.amountBigInt,
    timeout: 0, // timeout_in_seconds,
    recipient: transferState.recipient as HexString,
    relayerFee: safeRelayerFee.get().pipe(O.getOrElse(() => FiatImpl.empty)),
    token: O.fromNullable(sourceToken).pipe(
      O.getOrThrowWith(() => new Error("Source token not found")),
    ),
  })
})

function getConnectionState(params: {
  accounts: typeof WalletManager.accounts
  sourceChain: ChainId
  address: string
}) {
  const { sourceChain, accounts, address } = params

  const isPolkaAccountSet = accounts.substrate !== null

  const isPolkaAccountConnected = isPolkaAccountSet
  const isEVMAccountConnected = isEVMChain(sourceChain) && isEvmAddress(address)

  const connected = {
    evm: isEVMAccountConnected,
    substrate: isPolkaAccountConnected,
  }

  const sourceNetwork = resolveNetworkGroup(sourceChain)
  const isSourceAccountConnected = connected[sourceNetwork]

  return {
    chain: sourceChain,
    sourceNetwork,
    isPolkaAccountSet,
    isEVMAccountConnected,
    isSourceAccountConnected,
    isPolkaAccountConnected,
  }
}

export const bridgeTxState = computed(() =>
  getConnectionState({
    address: transferState.account,
    accounts: WalletManager.accounts,
    sourceChain: transferState.sourceChain,
  }),
)

export const safeBridgeFee = computed((): O.Option<AppBalance> => {
  const _logger = rootLogger.withTag("Bridging fee")
  const { sourceChain, destChain, token } = transferState

  if (!isRelayChain(sourceChain)) return O.none()
  if (token.symbol !== "DOT") return O.none()

  const curr_balance = enteredAmountAsBalance.get()

  const fee = calculateDotBridgingFee({
    amountToTransfer: curr_balance,
    percentage: BRIDGING_PERCENTAGE,
  })

  const bridge_fee = pipe(curr_balance, BalanceImpl.as(fee))

  if (BalanceImpl.isEmpty(bridge_fee)) return O.none()

  if (destChain === Ethereum.chainId) {
    const dot = tokenRegistry.getBySymbol(sourceChain, "DOT")
    if (!dot) return O.none()

    const fixed_fee = BalanceImpl.parse("2", dot.decimals, dot.symbol)

    const safe_value = Either.try({
      try: () => BalanceImpl.add(fixed_fee, bridge_fee),
      catch: (err) => {
        return new Error(
          "DOT fixed fee + bridge fee for Ethereum destination",
          { cause: err },
        )
      },
    })

    const padded_bridging_fee = pipe(
      safe_value,
      Either.map(O.some),
      Either.getOrElse((err) => {
        _logger.error(err)
        return O.none()
      }),
    )

    _logger.info("Padded", padded_bridging_fee)
    return padded_bridging_fee
  }

  _logger.info(bridge_fee)
  return O.some(bridge_fee)
})
