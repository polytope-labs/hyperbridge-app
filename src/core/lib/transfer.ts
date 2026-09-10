import { Bifrost, type TokenRegistry } from "@hyperbridge-fe/shared/config"
import {
  isEVMChain,
  isRelayChain,
  isSubstrate,
  resolveNetworkGroup,
} from "@hyperbridge-fe/shared/lib"
import type { AnyToken, NetworkConfig } from "@hyperbridge-fe/shared/types"
import { Either } from "effect"
import type { AppTransferValidationSchema } from "@/components/transfer-warnings"

export function validateRelayerFee(config: {
  params: () => {
    sourceChain: NetworkConfig
    destChain: NetworkConfig
    relayerFee?: number
    token: AnyToken
  }
}): AppTransferValidationSchema {
  type TransferCaseParams =
    | {
        sourceNetwork: "evm"
        sourceChain: NetworkConfig
        destChain: NetworkConfig
        relayerFee: number
      }
    | {
        sourceNetwork: "substrate"
        sourceChain: NetworkConfig
        destChain: NetworkConfig
      }

  return {
    validate() {
      const params = config.params()
      const okay = Either.right({ key: "okay" as const })

      const inferredSourceNetwork = resolveNetworkGroup(
        params.sourceChain.chainId,
      )

      if (params.token.selfDelivery === false) {
        return okay
      }

      if (inferredSourceNetwork === "evm") {
        return resolveExactCase({
          ...params,
          sourceNetwork: inferredSourceNetwork,
          relayerFee: params.relayerFee ?? 0,
        })
      }

      return resolveExactCase({
        ...params,
        sourceNetwork: inferredSourceNetwork,
      })

      function resolveExactCase(params: TransferCaseParams) {
        const { sourceChain: source, destChain: dest, sourceNetwork } = params

        if (sourceNetwork === "evm") {
          const isEVMToEVM = [source.chainId, dest.chainId].every((e) =>
            isEVMChain(e),
          )

          if (isEVMToEVM && params.relayerFee <= 0) {
            return Either.left({
              key: "relay-fee-required",
              heading: "Relayer fee is too low",
              message: `Relayer fee is ${params.relayerFee}. Ensure you have gas token in the ${dest.name} network to complete this multichain transaction
             `,
            })
          }

          if (isEVMToEVM) return okay
        }

        if (Bifrost.chainId === source.chainId) return okay

        if (sourceNetwork === "substrate") {
          if (isEVMChain(dest.chainId))
            return Either.left({
              key: "ensure-destination-can-cover-gas-fee",
              heading: "Gas fee notice",
              message: `You will need to make a final transaction on ${dest.name} to
              claim your funds. Please ensure you have sufficient token to cover
              gas fee`,
            })

          return okay
        }

        return okay
      }
    },
  }
}

export function validateExistentialDeposit(config: {
  params: () => {
    token: AnyToken
    amount: string
    destChain: NetworkConfig
    tokenRegistry: TokenRegistry
  }
}): AppTransferValidationSchema {
  return {
    validate() {
      const { destChain, token, amount, tokenRegistry } = config.params()

      // ensure the amount is greater than the Minimum Existential Deposit.
      if (isSubstrate(destChain.chainId) || isRelayChain(destChain.chainId)) {
        const dest_token = tokenRegistry.getBySymbol(
          destChain.chainId,
          token.symbol,
        )

        if (!dest_token) {
          return Either.left({
            key: "transfer-amount-too-small",
            heading: "Existential deposit notice",
            message: `Token(${token.symbol}) is missing existential deposit field. Please contact development team`,
          })
        }

        const existentialDeposit = Number(token.existentialDeposit)
        const parsed_amount = Number(amount)

        if (existentialDeposit > parsed_amount) {
          return Either.left({
            key: "transfer-amount-too-small",
            heading: "Existential deposit notice",
            message: `The minimum amount you can bridge to ${destChain.name} is ${existentialDeposit} ${token.symbol}`,
          })
        }
      }

      return Either.right({ key: "okay" as const })
    },
  }
}
