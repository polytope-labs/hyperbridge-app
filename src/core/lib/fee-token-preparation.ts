import type { HexString } from "@hyperbridge/sdk"
import { NETWORK_ENV } from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import type { EVMChainConfig } from "@hyperbridge-fe/shared/types"
import {
  readContract,
  switchChain,
  waitForTransactionReceipt,
  writeContract,
} from "@wagmi/core"
import { formatUnits, parseEther } from "viem"
import { EvmHostABI } from "@/abis/EvmHost"
import { FeeTokenABI } from "@/abis/FeeToken"
import { TokenFaucetABI } from "@/abis/TokenFaucet"
import { gatewayConfig } from "@/config/services/gateway-config"
import { WagmiConfig } from "@/config/wagmi"
import { rootLogger } from "@/lib/logger"
import { evmFeeOverrides } from "@/lib/utils/gas"

const logger = rootLogger.withTag("FeeTokenPrep")

/** Drip when balance is below this (matches SDK HFT integration tests). */
const FAUCET_DRIP_THRESHOLD = parseEther("100")

/** On-chain fee tokens use `USD.h`; product/registry uses `USDH`. */
export function normalizeFeeTokenSymbol(symbol: string): string {
  return symbol.replaceAll(".", "").toUpperCase()
}

export async function readFeeTokenMetadata(source: EVMChainConfig): Promise<{
  address: HexString
  decimals: number
  symbol: string
}> {
  const sourceChain = source.chainId
  const hostAddress = NetworkImpl.host_addr(source)

  const hostParams = await readContract(WagmiConfig, {
    abi: EvmHostABI,
    address: hostAddress,
    functionName: "hostParams",
    chainId: sourceChain,
  })

  const [decimals, symbol] = await Promise.all([
    readContract(WagmiConfig, {
      abi: FeeTokenABI,
      address: hostParams.feeToken,
      chainId: sourceChain,
      functionName: "decimals",
    }),
    readContract(WagmiConfig, {
      abi: FeeTokenABI,
      address: hostParams.feeToken,
      chainId: sourceChain,
      functionName: "symbol",
    }),
  ])

  return {
    address: hostParams.feeToken,
    decimals,
    symbol: normalizeFeeTokenSymbol(symbol),
  }
}

export type FeeTokenBalance = {
  address: HexString
  balance: bigint
  decimals: number
  symbol: string
}

export async function readFeeTokenBalance(params: {
  owner: HexString
  source: EVMChainConfig
}): Promise<FeeTokenBalance> {
  const sourceChain = params.source.chainId
  const hostAddress = NetworkImpl.host_addr(params.source)

  const hostParams = await readContract(WagmiConfig, {
    abi: EvmHostABI,
    address: hostAddress,
    functionName: "hostParams",
    chainId: sourceChain,
  })

  const [balance, decimals, symbol] = await Promise.all([
    readContract(WagmiConfig, {
      abi: FeeTokenABI,
      address: hostParams.feeToken,
      chainId: sourceChain,
      functionName: "balanceOf",
      args: [params.owner],
    }),
    readContract(WagmiConfig, {
      abi: FeeTokenABI,
      address: hostParams.feeToken,
      chainId: sourceChain,
      functionName: "decimals",
    }),
    readContract(WagmiConfig, {
      abi: FeeTokenABI,
      address: hostParams.feeToken,
      chainId: sourceChain,
      functionName: "symbol",
    }),
  ])

  return {
    address: hostParams.feeToken,
    balance,
    decimals,
    symbol: normalizeFeeTokenSymbol(symbol),
  }
}

/**
 * Requests testnet USD.h from the TokenFaucet (once per wallet per day).
 * Returns true when a drip tx was submitted.
 */
export async function requestFeeTokenDrip(params: {
  owner: HexString
  source: EVMChainConfig
  feeTokenAddress: HexString
}): Promise<boolean> {
  if (NETWORK_ENV === "mainnet") {
    return false
  }

  const faucet = gatewayConfig.tokenFaucetAddress.get()
  if (!faucet || faucet === "0x") {
    throw new Error("Token faucet is not configured for this network")
  }

  await switchChain(WagmiConfig, { chainId: params.source.chainId })

  const feeOverrides = await evmFeeOverrides(params.source.chainId)

  const hash = await writeContract(WagmiConfig, {
    abi: TokenFaucetABI,
    address: faucet,
    functionName: "drip",
    args: [params.feeTokenAddress],
    chainId: params.source.chainId,
    account: params.owner,
    ...feeOverrides,
  })

  await waitForTransactionReceipt(WagmiConfig, {
    hash,
    chainId: params.source.chainId,
    confirmations: 1,
  })

  return true
}

/**
 * Ensures the wallet holds enough host fee tokens (USD.h on Gargantua testnet).
 * Automatically drips from the TokenFaucet when balance is low.
 */
export async function ensureFeeTokenBalance(params: {
  owner: HexString
  source: EVMChainConfig
  requiredAmount: bigint
}): Promise<FeeTokenBalance> {
  if (NETWORK_ENV === "mainnet") {
    const current = await readFeeTokenBalance(params)
    if (current.balance < params.requiredAmount) {
      throw new Error(
        `Insufficient ${current.symbol} fee tokens for this bridge.`,
      )
    }
    return current
  }

  let feeToken = await readFeeTokenBalance(params)

  const shouldDrip =
    feeToken.balance < params.requiredAmount ||
    feeToken.balance < FAUCET_DRIP_THRESHOLD

  if (shouldDrip) {
    logger.info("Requesting fee token drip", {
      balance: feeToken.balance.toString(),
      required: params.requiredAmount.toString(),
      token: feeToken.address,
    })

    try {
      await requestFeeTokenDrip({
        owner: params.owner,
        source: params.source,
        feeTokenAddress: feeToken.address,
      })
      feeToken = await readFeeTokenBalance(params)
    } catch (err) {
      logger.warn("Fee token faucet drip failed", err)
    }
  }

  if (feeToken.balance < params.requiredAmount) {
    const needed = formatUnits(params.requiredAmount, feeToken.decimals)
    const have = formatUnits(feeToken.balance, feeToken.decimals)

    throw new Error(
      `You need at least ${needed} ${feeToken.symbol} to pay the relayer fee (you have ${have}). ` +
        `On testnet, use "Get fee tokens" below or call drip() on the faucet once per day.`,
    )
  }

  return feeToken
}
