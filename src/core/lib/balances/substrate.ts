import type { HexString } from "@hyperbridge/sdk"
import {
  isSubstrateAddress,
  safeArray,
  safeObj,
} from "@hyperbridge-fe/shared/lib"
import { isHex, u8aToHex } from "@polkadot/util"
import { decodeAddress } from "@polkadot/util-crypto"
import { Either, pipe, Record } from "effect"
import { isNil } from "lodash-es"
import { SubstrateApiStore } from "@/config/services/substrate-api.ts"
import { safeNum } from "@/lib/data.helpers"
import { BalanceImpl } from "@/lib/factories/balance"
import type { AppBalance, ChainId, SubstrateToken } from "@/types"
import {
  getBalanceFetchingStrategy,
  type SubstrateBalanceStorage,
} from "../substrate.storage"
import type { HttpRpcClient } from "../substrate-api"
import { O } from "../utils/fp.helpers"

export const SubstrateBalances = {
  async get(params: {
    chainId: ChainId
    token: SubstrateToken
    walletAddr: HexString
  }): Promise<AppBalance> {
    const { chainId, token, walletAddr: wallet_addr } = params

    console.assert(
      isSubstrateAddress(wallet_addr),
      `Invalid Substrate wallet address WalletAddr(${wallet_addr})`,
    )

    const api = await SubstrateApiStore.getHttp(chainId)
    const accountId = u8aToHex(decodeAddress(wallet_addr, false))

    const resolveBalance = (e: bigint | null) => {
      return isNil(e)
        ? BalanceImpl.create(0n, params.token.decimals, params.token.symbol)
        : BalanceImpl.create(e, params.token.decimals, params.token.symbol)
    }

    const strategy = getBalanceFetchingStrategy(token, {
      account_id: accountId,
      asset_id: token.assetId,
    })

    return SubstrateBalances.fromStorageKey(api, strategy)
      .then(resolveBalance)
      .catch(() => BalanceImpl.empty())
  },

  async fromStorageKey(api: HttpRpcClient, strategy: SubstrateBalanceStorage) {
    const response = await api.call("state_getStorage", [
      strategy.getStorageKey(),
    ])

    return pipe(
      O.fromNullable(response),
      O.flatMap((e) => (isHex(e) ? O.some(e) : O.none())),
      O.map((endcoded_balance) => strategy.decodeData(endcoded_balance)),
      O.getOrNull,
    )
  },

  /**
   *
   * @param token_balance — Token raw balance
   * @param token - Substrate Token
   * @returns
   */
  minusExistentialDeposit: (
    token_balance: string | bigint,
    token: SubstrateToken,
  ): bigint => {
    const deposit = Math.max(0, safeNum(token?.existentialDeposit))

    if (!(deposit > 0)) return 0n

    const balance_int = token_balance
    const deposit_int = deposit * 10 ** token.decimals

    const balance = BigInt(balance_int) - BigInt(deposit_int)

    return balance > 0n ? balance : 0n
  },

  batch(params: {
    chainId: ChainId
    walletAddr: string
    tokens: SubstrateToken[]
  }) {
    const { chainId, tokens, walletAddr } = params

    console.assert(
      isSubstrateAddress(walletAddr),
      `Invalid Substrate wallet address WalletAddr(${walletAddr})`,
    )

    const accountId = u8aToHex(decodeAddress(walletAddr, true))

    const balance_stores = tokens.map((e) =>
      getBalanceFetchingStrategy(e, {
        account_id: accountId,
        asset_id: e.assetId,
      }),
    )

    const storage_keys = balance_stores.map((e) => e.getStorageKey())

    return {
      getKeys: () => storage_keys,
      call: async () => {
        const api = await SubstrateApiStore.getHttp(chainId)
        const balances = await SubstrateBalances.batchFetchBalances(
          api,
          balance_stores,
        )

        return balances.map((balance, index) => {
          const token = tokens[index]

          if (Either.isLeft(balance))
            return [
              token,
              BalanceImpl.create(0n, token.decimals, token.symbol),
            ] as const

          return [
            token,
            BalanceImpl.create(balance.right[1], token.decimals, token.symbol),
          ] as const
        })
      },
    }
  },

  /**
   * @private Use .batch() method instead
   * @alias batch()
   * @param api
   * @param storage_keys
   * @returns
   */
  async batchFetchBalances(
    api: HttpRpcClient,
    storage_keys: SubstrateBalanceStorage[],
  ) {
    type StorageResult = { changes: [HexString, null | HexString][] }

    const default_bigint = 0n

    const result_ = await api.call("state_queryStorageAt", [
      storage_keys.map((e) => e.getStorageKey()),
      null,
    ])
    const result = safeArray(result_ as StorageResult[])

    // Process each storage result
    for (const index in result) {
      const storageResult = result[index]
      const storage_ref = storage_keys[index]

      const safe_storage: StorageResult = safeObj<StorageResult>(
        storageResult as StorageResult,
      )
      const try_decoding = (storage_key: HexString, value: HexString) => {
        return Either.try({
          try: () => storage_ref.decodeData(value),
          catch: (err) => {
            // Continue processing other locks even if one fails
            return new Error(
              `[BatchFetchBalance] Failed to parse lock data for key ${storage_key}:`,
              { cause: err },
            )
          },
        })
      }

      if (!Record.has(safe_storage, "changes")) continue

      const results = safe_storage.changes.map(([key, value]) => {
        if (isNil(value)) return Either.right([key, default_bigint] as const)

        return pipe(
          try_decoding(key, value),
          Either.map((e) => [key, e] as const),
        )
      })

      return results
    }

    return []
  },
}
