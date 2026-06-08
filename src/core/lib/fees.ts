import { resolveNetworkTag } from "@hyperbridge-fe/shared"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import type { BridgeParamsHelper } from "@/lib/bridge-params-helpers/base.ts"
import type { AppBalance, ChainId, FiatValue, SubstrateToken } from "@/types"
import { BalanceImpl } from "./factories/balance"
import { FiatImpl } from "./factories/fiat"
import { rootLogger } from "./logger"

const logger = rootLogger.withTag("Fees")

export const FeesHelper = {
  FALLBACK: Object.freeze({
    relayerFee: FiatImpl.empty,
    executionCost: FiatImpl.empty,
  }),

  async get(bridgeParams: BridgeParamsHelper): Promise<FiatValue> {
    return this.get_fees(bridgeParams).then((result) => {
      console.assert(
        result.executionCost.amount > 0,
        "FeesHelper: Gas Fee should never be zero",
      )

      return FiatImpl.add(result.relayerFee, result.executionCost)
    })
  },

  async get_substrate_execution_fee(
    chainId: ChainId,
    token: SubstrateToken,
  ): Promise<AppBalance> {
    if (resolveNetworkTag(chainId) === "relay") {
      return BalanceImpl.empty()
    }

    const native_token = tokenRegistry.getNativeToken(chainId)

    if (!native_token) {
      throw new Error("Native token required to estimate gas fee")
    }

    if (native_token.__type !== "substrate") {
      throw new Error("Invalid token type provided. Expecting substrate token")
    }

    if (token.symbol !== native_token.symbol) {
      throw new Error(
        `Only Native tokens can be used for gas estimation. Network(${chainId})`,
      )
    }

    console.assert(
      native_token.balance.pallet_prefix === "System",
      `Token(${native_token.symbol}) PalletPrefix must be a System`,
    )

    return BalanceImpl.parse("0.1", native_token?.decimals, native_token.symbol)
  },

  async get_fees(
    bridgeParams: BridgeParamsHelper,
  ): Promise<{ relayerFee: FiatValue; executionCost: FiatValue }> {
    const fallback = () => {
      logger.log(
        `Using fallback for (${bridgeParams.source.name}) -> (${bridgeParams.destination.name})`,
      )

      return this.FALLBACK
    }

    const key = bridgeParams.direction()

    if (key === "substrate->evm") {
      const { destination, source } = bridgeParams
      logger.log(
        `Fetching for Substrate(${source.name}) -> EVM(${destination.name})`,
      )

      return { relayerFee: FiatImpl.empty, executionCost: FiatImpl.empty }
    }

    return fallback()
  },
}
