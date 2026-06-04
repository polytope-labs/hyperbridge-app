import type { HexString } from "@hyperbridge/sdk"
import { WrappedHyperFungibleTokenABI } from "@hyperbridge/sdk"
import { TokenImpl } from "@hyperbridge-fe/shared/factories"
import { matchChain, resolveNetworkTag } from "@hyperbridge-fe/shared/lib"
import { getBalance, readContract } from "@wagmi/core"
import { Effect, pipe } from "effect"
import { isNil } from "lodash-es"
import { type Address, erc20Abi, isAddress, zeroAddress } from "viem"
import { tokenRegistry } from "@/config/services/token-registry.ts"
import { type WagmiChainId, WagmiConfig } from "@/config/wagmi"
import { isHftToken } from "@/lib/hft/hyper-fungible-token"
import type { AnyToken, AppBalance, ChainId, EVMToken, SubstrateToken } from "@/types"
import { SubstrateBalances } from "./balances/substrate"
import { BalanceImpl } from "./factories/balance"
import { FeesHelper } from "./fees"
import { rootLogger } from "./logger"
import { pointfree_log } from "./utils/fp.helpers"

const logger = rootLogger.withTag("BalanceHelper")

/**
 * @todo Replace BalanceHelper with Balance interface for all the Different Network Group to follow
 */
export const BalanceHelper = {
  /**
   * @description Gets the actual balance of the token
   */
  async balance(params: {
    chainId: ChainId
    walletAddress: HexString
    tokenSymbol: string
    /**
     * Optional override for EVM token contract address.
     * When provided (and chain is EVM), we skip registry lookup and query this address directly.
     */
    tokenAddress?: HexString
  }): Promise<AppBalance> {
    const {
      chainId,
      walletAddress: address,
      tokenSymbol,
      tokenAddress,
    } = params

    if (!address) {
      throw new Error("Address required when fetching balance")
    }

    logger.trace(
      `Getting balance from Chain(${chainId}), WalletAddress(${address}), Token(${tokenSymbol})`,
    )

    try {
      // Fast path for EVM ERC20s when we already know the deployed address.
      if (tokenAddress && resolveNetworkTag(chainId) === "evm") {
        return await BalanceHelper._getEVMBalance({
          chainId: Number(chainId) as WagmiChainId,
          walletAddr: address,
          tokenAddr: tokenAddress,
        })
      }

      const token = tokenRegistry.getBySymbol(chainId, tokenSymbol)

      if (!token) {
        throw new Error(
          `Token not found for Chain(${chainId}) and Symbol(${tokenSymbol})`,
        )
      }

      // get evm chain balance
      const balance = await matchChain(chainId, {
        evm: async () => {
          if (
            TokenImpl.is(token) &&
            token.__type === "evm" &&
            isHftToken(token)
          ) {
            return BalanceHelper._getHftEVMBalance({
              chainId: Number(chainId) as WagmiChainId,
              walletAddr: address,
              token,
            })
          }

          const tokenAddr = TokenImpl.match(token, {
            evm: (t) => t.address as unknown as HexString,
            _: () => undefined,
          })

          return BalanceHelper._getEVMBalance({
            chainId: Number(chainId) as WagmiChainId,
            walletAddr: address,
            tokenAddr,
          })
        },
        relay: (chainId) => {
          return SubstrateBalances.get({
            chainId,
            walletAddr: address,
            token: token as SubstrateToken,
          })
        },
        substrate: (chainId) => {
          return SubstrateBalances.get({
            chainId,
            walletAddr: address,
            token: token as SubstrateToken,
          })
        },
        assetHub: () => Promise.resolve(BalanceImpl.empty()),
        none: () => Promise.resolve(BalanceImpl.empty()),
      })

      logger.trace(
        `Balance: Chain(${chainId}) Balance(${BalanceImpl.format(balance)}) Address(${address})`,
      )

      // get relay chain balance
      return balance
    } catch (err) {
      logger.error(
        `Failed to get balance for Address(${address}) Chain(${chainId})`,
        err,
        params,
      )

      throw new Error(
        `Error fetching balance for Address(${address}) Chain(${chainId})`,
        {
          cause: err,
        },
      )
    }
  },

  async _getEVMBalance(params: {
    chainId: WagmiChainId
    walletAddr: HexString
    tokenAddr?: HexString
  }): Promise<AppBalance> {
    const { chainId, walletAddr, tokenAddr } = params

    if (!isAddress(walletAddr)) {
      throw new Error(
        `Invalid EVM wallet address (${walletAddr}) for Chain(${chainId}).`,
      )
    }

    if (tokenAddr && !isAddress(tokenAddr)) {
      throw new Error(
        `Invalid EVM token address (${tokenAddr}) for Chain(${chainId}). This would otherwise fall back to native balance.`,
      )
    }

    const isNativeToken = !tokenAddr || tokenAddr === zeroAddress

    if (isNativeToken) {
      const balance = await getBalance(WagmiConfig, {
        address: walletAddr,
        chainId,
      })

      return BalanceImpl.create(balance.value, balance.decimals, balance.symbol)
    }

    const [value, decimals, symbol] = await Promise.all([
      readContract(WagmiConfig, {
        chainId,
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [walletAddr],
      }),
      readContract(WagmiConfig, {
        chainId,
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "decimals",
      }),
      readContract(WagmiConfig, {
        chainId,
        address: tokenAddr,
        abi: erc20Abi,
        functionName: "symbol",
      }),
    ])

    return BalanceImpl.create(value, Number(decimals), symbol)
  },

  /**
   * WrappedHyperFungibleToken is not an ERC20 — spendable balance is native
   * (when isWeth) or the underlying ERC20 (e.g. WBNB).
   */
  async _getHftEVMBalance(params: {
    chainId: WagmiChainId
    walletAddr: HexString
    token: EVMToken
  }): Promise<AppBalance> {
    const { chainId, walletAddr, token } = params
    const { symbol, decimals } = token

    if (token.hft?.type === "hft") {
      return BalanceHelper._getEVMBalance({
        chainId,
        walletAddr,
        tokenAddr: token.address as HexString,
      })
    }

    const wrapperAddr = token.address as Address

    const isWeth = await readContract(WagmiConfig, {
      chainId,
      address: wrapperAddr,
      abi: WrappedHyperFungibleTokenABI,
      functionName: "isWeth",
    })

    if (isWeth) {
      const balance = await getBalance(WagmiConfig, {
        address: walletAddr,
        chainId,
      })

      return BalanceImpl.create(balance.value, decimals, symbol)
    }

    const underlying =
      token.hft?.underlying ??
      ((await readContract(WagmiConfig, {
        chainId,
        address: wrapperAddr,
        abi: WrappedHyperFungibleTokenABI,
        functionName: "underlying",
      })) as Address)

    const value = await readContract(WagmiConfig, {
      chainId,
      address: underlying,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddr],
    })

    return BalanceImpl.create(value, decimals, symbol)
  },

  /**
   * @description Gets the balance and subtracts existentialDeposit when applicable.
   */
  transferableBalance(params: {
    token: AnyToken
    chainId: ChainId
    walletAddress: HexString
  }): Promise<AppBalance> {
    const { chainId, walletAddress: wallet_addr } = params

    return TokenImpl.match(params.token, {
      substrate: async (token) => {
        const balance = await SubstrateBalances.get({
          token: token,
          chainId: chainId,
          walletAddr: wallet_addr,
        })

        return await applySubstractions(chainId, token, balance)
      },
      _: async (token) => {
        if (isNil(token)) return BalanceImpl.empty()

        return await BalanceHelper.balance({
          chainId,
          walletAddress: wallet_addr,
          tokenSymbol: token.symbol,
        })
      },
    })
  },
}

export async function applySubstractions(
  chainId: ChainId,
  token: SubstrateToken,
  balance: AppBalance,
) {
  const { minusExistentialDeposit } = SubstrateBalances

  const substrateExecutionFee = (balance: AppBalance) => {
    if (!token.isNative) {
      return Effect.succeed(balance)
    }

    if (resolveNetworkTag(chainId) !== "substrate") {
      return Effect.succeed(balance)
    }

    return pipe(
      Effect.tryPromise(() =>
        FeesHelper.get_substrate_execution_fee(chainId, token),
      ),
      Effect.tap(
        pointfree_log(`Before substration ${token.symbol} `, logger.trace),
      ),
      Effect.map((fee) => BalanceImpl.minus(balance, fee)),
      Effect.tap(
        pointfree_log(`After substration ${token.symbol}`, logger.trace),
      ),
    )
  }

  return pipe(
    Effect.succeed(balance),
    Effect.map((balance) => {
      return pipe(
        balance,
        BalanceImpl.map((value) => minusExistentialDeposit(value, token)),
      )
    }),
    Effect.flatMap(substrateExecutionFee),
    Effect.runPromise,
  )
}
