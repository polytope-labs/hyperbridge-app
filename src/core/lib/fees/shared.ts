import type { HexString } from "@hyperbridge/sdk"
import type { EVMChainConfig } from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { readContract } from "@wagmi/core"
import { pipe } from "effect"
import type { Client } from "viem"
import { publicActionsL2 } from "viem/op-stack"
import { EvmHostABI } from "@/abis/EvmHost"
import { gatewayConfig } from "@/config/services/gateway-config"
import { WagmiConfig } from "@/config/wagmi"
import type { AppBalance, FiatValue } from "@/types"
import type { BridgeGasResult, FeeValue } from "@/types/fee"
import { BalanceImpl } from "../factories/balance"
import { FiatImpl } from "../factories/fiat"
import { rootLogger } from "../logger"

export const FeeValues = {
  /**
   * Gas price + Gas fee
   * @returns
   */
  fee: (fee: bigint) => {
    return { kind: "fee", value: fee } as const
  },

  gas: (fee: bigint) => {
    return { kind: "gas", value: fee } as const
  },
}

/**
 * @description Calculates the relayer fee based on the execution cost in USD.
 * @returns
 */
export function deriveBaseRelayerFee(params: {
  executionCost: FiatValue
}): FiatValue {
  return pipe(
    params.executionCost,
    FiatImpl.map((amount) => amount * 0.02),
  )
}

export function clampToMinimumRelayerFee(relayer_fee: number) {
  // minimum relayer fee is 50 cents
  return Math.max(relayer_fee, 0.5)
}

/**
 * Estimates the exact fee in wei required for request delivery to an L2 chain.
 * This is to allow for more reliable estimates to prevent request timeouts as
 * a result of insufficient relayer fees.
 *
 * This function will estimate the cost of delivery for a **real request** which should
 * will never expire and should never be delivered. It only exists for the purpose
 * of fee estimation.
 */
export async function estimateL2RelayerFee(
  client: Client,
  destNetwork: EVMChainConfig,
  gasCalldata: HexString,
) {
  const destination = destNetwork.chainId

  if (!client) {
    throw new Error("Failed to resolve WagmiConfig")
  }

  const l2client = client.extend(publicActionsL2())

  // @todo: Added to hostParams to BridgeParamsHelpers
  const hostParams = await readContract(WagmiConfig, {
    abi: EvmHostABI,
    address: NetworkImpl.host_addr(destNetwork),
    functionName: "hostParams",
    chainId: destination,
  })

  // @ts-expect-error Expecting an extended API here.
  return await l2client?.estimateL1Fee?.({
    account: gatewayConfig.dispatcherAddress.get(),
    to: hostParams.handler,
    data: gasCalldata,
  })
}

type CalculateExecutionFeeParams = {
  /**
   * Hyperbridge estimated gas fee.
   */
  gasInfo: BridgeGasResult

  /**
   * destination chain gas price
   */
  gasPriceInWei: FeeValue
  /**
   * Source chain Native token
   */
  nativeToken: {
    symbol: string
    decimals: number
  }
}

/**
 * @description Estimates the gas fee in Native token
 * @param args
 * @returns Native Token value
 */
export function calculateExecutionFee(
  args: CalculateExecutionFeeParams,
): AppBalance {
  rootLogger.trace("Calculating execution cost", args)

  const { nativeToken, gasInfo, gasPriceInWei } = args

  if (gasInfo.fee_kind === "default") {
    const native_token_base_gas_fee =
      gasPriceInWei.value * gasInfo.bridge_fee.value

    return BalanceImpl.create(
      native_token_base_gas_fee,
      nativeToken.decimals,
      nativeToken.symbol,
    )
  }

  if (gasInfo.fee_kind === "l2") {
    const native_token_base_gas_fee =
      gasPriceInWei.value * gasInfo.bridge_fee.value + gasInfo.l2_fee.value

    return BalanceImpl.create(
      native_token_base_gas_fee,
      nativeToken.decimals,
      nativeToken.symbol,
    )
  }

  throw new Error("Error calculating execution fee. Invalid `gasInfo` argument")
}
