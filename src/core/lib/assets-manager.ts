import type { HexString } from "@hyperbridge/sdk"
import {
  isAssetHub,
  isNil,
  type NetworkConfig,
  resolveNetworkGroup,
  safeArray,
  safeObj,
} from "@hyperbridge-fe/shared"
import { TokenImpl } from "@hyperbridge-fe/shared/factories"
import type { AnyToken, SubstrateToken } from "@hyperbridge-fe/shared/types"
import { Effect, identity, pipe } from "effect"
import { runInAction } from "mobx"
import { isDevelopment } from "@/config/constants"
import type { Account, AppBalance, FiatValue } from "@/types"
import type { AssetItem, AssetManagerStore } from "./assets-store"
import { applySubstractions, type BalanceHelper } from "./balance-helper"
import { SubstrateBalances } from "./balances/substrate"
import { DedupePromise } from "./dedupe-promise"
import { BalanceImpl } from "./factories/balance"
import { FiatImpl } from "./factories/fiat"
import { rootLogger } from "./logger"
import type { TokenPriceManager } from "./token-price-manager"
import { O } from "./utils/fp.helpers"
import { scheduler_yield } from "./utils/runtime.helper"
import type { StateMachineId } from "./utils/types"

const logger = rootLogger.withTag("AssetManagerRoot")

class WalletRequiredError extends Error {
  constructor() {
    super("Wallet required to fetch balance")
    this.name = "WalletRequiredError"
  }
}

interface Deps {
  readonly getAccount: (a: NetworkConfig) => O.Option<Account>
  readonly resolveNetworkAndTokens: () => Generator<
    {
      token: AnyToken
      network: NetworkConfig
    },
    void,
    unknown
  >
  balanceHelper: typeof BalanceHelper
  priceManager: TokenPriceManager
}

export class AssetsManager extends EventTarget {
  constructor(
    public store: AssetManagerStore,
    private resolvers: Deps,
  ) {
    super()
  }

  dedupe = new DedupePromise()

  private hasConnectedAccountForNetwork(network: NetworkConfig): boolean {
    return O.isSome(this.resolvers.getAccount(network))
  }

  private hasAnyConnectedAccount(): boolean {
    for (const { network } of this.store.assets) {
      if (this.hasConnectedAccountForNetwork(network)) {
        return true
      }
    }
    return false
  }

  private hydrateAssetCatalog() {
    logger.trace("Fetching tokens for all supported networks")

    const all_tokens = Array.from(this.resolvers.resolveNetworkAndTokens())
    this.store.setAssets(all_tokens)

    const iterator = Iterator.from(this.loadBalances(all_tokens)).filter(
      (e) => !isAssetHub(e.network.chainId),
    )

    const grouped_by_chain = Object.groupBy(
      iterator,
      (asset) => asset.network.chainId,
    )

    this.networkTokensMap = grouped_by_chain

    return {
      allTokens: all_tokens,
      groupedByChain: grouped_by_chain,
    }
  }

  private *loadBalances(assets: Pick<AssetItem, "token" | "network">[]) {
    for (const { token, network } of assets) {
      yield {
        token: token,
        network: network,
        balance: O.none(),
        fiatBalance: O.none(),
      } satisfies AssetItem
    }
  }

  getBalance({
    network,
    token,
  }: {
    network: NetworkConfig
    token: AnyToken
  }): O.Option<AssetItem> {
    const value = O.fromNullable(
      this.store.balances.get(this.store.balanceId({ network, token })),
    )

    if (O.isNone(value)) {
      if (!this.hasConnectedAccountForNetwork(network)) {
        return value
      }

      this.fetchAndSyncTokenBalance({ network, token }).catch(() => {})
    }

    return value
  }

  networkTokensMap: Partial<
    Record<
      number | StateMachineId,
      {
        token: AnyToken
        network: NetworkConfig
        balance: O.Option<AppBalance>
        fiatBalance: O.Option<FiatValue>
      }[]
    >
  > = {}

  async refreshBalances(
    params: {
      network?: NetworkConfig
      signal?: AbortSignal
    } = {},
  ) {
    const { signal, network } = params
    if (this.store.assets.length === 0) {
      this.hydrateAssetCatalog()
    }

    if (network && !this.hasConnectedAccountForNetwork(network)) {
      logger.trace(
        `Skipping balance refresh for Network(${network.name}): no connected account`,
      )
      return
    }

    if (!network && !this.hasAnyConnectedAccount()) {
      logger.trace("Skipping global balance refresh: no connected accounts")
      return
    }

    if (network) {
      await this.dedupe.execute(
        () => `refresh_by_network/${network.chainId}`,
        () => this.refreshByNetwork({ network, signal }),
      )
    } else {
      await this.dedupe.execute(
        () => "refresh_all",
        () => this.refresh({ signal }),
      )
    }
  }

  /**
   * Refresh only specified Network tokens
   * @param params
   * @returns
   */
  private async refreshByNetwork(params: {
    network: NetworkConfig
    signal?: AbortSignal
  }) {
    const { signal, network } = params

    logger.info(`Refreshing only Network(${network.name}) tokens`)
    const noop = () => {}

    if (!this.hasConnectedAccountForNetwork(network)) {
      logger.trace(
        `Skipping network refresh for Network(${network.name}): no connected account`,
      )
      return
    }

    let assets = safeArray(this.networkTokensMap[network.chainId])
    if (assets.length === 0) {
      this.hydrateAssetCatalog()
      assets = safeArray(this.networkTokensMap[network.chainId])
    }

    if (assets.length === 0) return

    if (resolveNetworkGroup(network.chainId) === "substrate") {
      await this.batchRefresh({ assets }).catch(noop)
      return
    }

    for await (const asset of assets) {
      if (signal?.aborted) {
        break
      }

      this.refreshBalance(asset)
      await scheduler_yield()
    }
  }

  /**
   * Destroys the store and refetches all assets
   * @param params
   * @returns
   */
  private async refresh(
    params: {
      signal?: AbortSignal
    } = {},
  ) {
    const { signal } = params

    try {
      const { allTokens: all_tokens, groupedByChain: grouped_by_chain } =
        this.hydrateAssetCatalog()

      logger.info(`Found ${all_tokens.length} tokens`)
      logger.info("Refreshing all balances")

      for (const [group_id, assets] of Object.entries(grouped_by_chain)) {
        if (signal?.aborted) {
          break
        }

        if (isNil(assets)) continue

        if (resolveNetworkGroup(group_id) === "substrate") {
          await this.batchRefresh({ assets })
          continue
        }

        for await (const asset of assets) {
          if (signal?.aborted) {
            break
          }

          this.refreshBalance(asset)
          await scheduler_yield()
        }
      }
    } finally {
      logger.success("Reset complete")
    }
  }

  async refreshBalance({
    network,
    token,
  }: Pick<AssetItem, "network" | "token">): Promise<AppBalance> {
    const balance = await this.fetchAndSyncTokenBalance({ network, token })

    this.fetchAndSyncFiatBalance(
      {
        network,
        token,
        balance: balance.value > 0n ? O.some(balance) : O.none(),
      },
      { fresh: true },
    ).catch(() => {})

    return balance
  }

  private async batchRefresh(params: { assets: AssetItem[] }): Promise<void> {
    const { assets } = params

    // Assertions
    console.assert(assets.length > 0, "No assets provided for batch refresh")

    const uniq_networks = new Set(assets.map((e) => e.network.chainId))
    console.assert(
      uniq_networks.size === 1,
      "All assets are expected to be from one network",
      uniq_networks,
    )

    const is_all_substrate = assets.every((e) => e.token.__type === "substrate")
    console.assert(
      is_all_substrate,
      "All assets are expected to be Substrate tokens",
      uniq_networks,
    )
    // End Assertions

    const network = assets[0].network
    const _logger = logger.withTag("Batch").withTag(network.name)

    _logger.trace(
      `Making batch request for ${assets.length} Tokens to Network(${network.chainId})`,
    )

    const wallet_addr = this.resolvers
      .getAccount(network)
      .pipe(O.map((e) => e.address))

    if (O.isNone(wallet_addr)) return

    const balances = pipe(
      Effect.tryPromise(() => {
        const batch_params = {
          chainId: network.chainId,
          tokens: assets.map((e) => e.token as SubstrateToken),
          walletAddr: wallet_addr.value,
        }

        return SubstrateBalances.batch(batch_params).call()
      }),
      Effect.retry({ times: 3 }),
      Effect.map((fresh_balances) => {
        _logger.withTag("Fresh Balances").trace(fresh_balances)

        for (const [token, balance] of fresh_balances) {
          applySubstractions(network.chainId, token, balance).then(
            (adjusted_balance) => {
              this.setBalance({ network, token, balance: adjusted_balance })
            },
          )
        }
      }),
      Effect.mapError((err) => {
        _logger.error(
          new Error(`Failure: Batch request for Network(${network.chainId})`, {
            cause: err,
          }),
        )
      }),
      Effect.asVoid,
      Effect.runPromiseExit,
    )

    await balances
  }

  private fetchBalanceEffect(params: Pick<AssetItem, "network" | "token">) {
    const { network, token } = params

    return Effect.suspend(() => {
      const account = this.resolvers.getAccount(network).pipe(O.getOrNull)

      if (!account) {
        return Effect.fail(new WalletRequiredError())
      }

      const balanceEffect = Effect.tryPromise(() => {
        return this.resolvers.balanceHelper.transferableBalance({
          token: token,
          chainId: network.chainId,
          walletAddress: account.address as HexString,
        })
      })

      return pipe(balanceEffect, Effect.retry({ times: 2 }))
    })
  }

  /**
   * @description Fetches a token without fetching a Balance
   *
   * @param params
   * @returns
   */
  fetchBalance(params: Pick<AssetItem, "network" | "token">) {
    return pipe(
      this.fetchBalanceEffect(params),
      Effect.match({
        onSuccess: identity,
        onFailure: BalanceImpl.empty,
      }),
      Effect.runPromise,
    )
  }

  /**
   * @description Fetches the token balance of an asset. Automatically updates the assetStore.
   */
  async fetchAndSyncTokenBalance(
    params: Pick<AssetItem, "network" | "token">,
  ): Promise<AppBalance> {
    const { network, token } = params

    logger.trace(
      `Fetching Token Balance ↳ ${TokenImpl.type(token)}:${token?.name ?? "Native"}  Network(${network.name})`,
    )

    const updateBalanceRecord = (new_bal: AppBalance): void => {
      this.setBalance({ network, token, balance: new_bal })
    }

    return await pipe(
      this.fetchBalanceEffect(params),
      Effect.tap(updateBalanceRecord),
      Effect.mapError((err) => {
        if (err instanceof WalletRequiredError) {
          logger.trace(
            `Skipping Tokenbalance for ${this.store.balanceId(params)}: no connected wallet`,
          )
          return err
        }

        logger.error(
          `Failed to fetch Tokenbalance for ${this.store.balanceId(params)}`,
        )
        return err
      }),
      Effect.match({
        onSuccess: identity,
        onFailure: BalanceImpl.empty,
      }),
      Effect.runPromise,
    )
  }

  /**
   * @description Fetches the faitBalance of an asset. Automatically updates the assetStore.
   */
  async fetchAndSyncFiatBalance(
    asset: Omit<AssetItem, "fiatBalance">,
    config: {
      fresh?: boolean
      mutateStore?: boolean
    },
  ): Promise<O.Option<FiatValue>> {
    const { mutateStore = true } = config

    const fetchFiatBalance = Effect.tryPromise(async () => {
      return O.isSome(asset.balance)
        ? this.balanceToFiat(asset.balance.value, config)
        : O.none()
    })

    const updateFiatRecord = (fiat_balance: O.Option<FiatValue>) => {
      if (O.isNone(fiat_balance)) return Effect.succeed(0)

      const asset_store_key = this.store.balanceId(asset)
      const match = O.fromNullable(this.store.balances.get(asset_store_key))

      if (O.isNone(match)) return Effect.succeed(0)

      runInAction(() => {
        match.value.fiatBalance = fiat_balance
      })
    }

    return await pipe(
      fetchFiatBalance,
      mutateStore ? Effect.tap(updateFiatRecord) : identity,
      Effect.match({
        onSuccess: identity,
        onFailure: () => O.none(),
      }),
      Effect.runPromise,
    )
  }

  /**
   * @description Converts a TokenBalance to Fiat Balance.
   * @param balance
   * @param config
   * @returns
   */
  async balanceToFiat(
    balance: AppBalance,
    config?: { fresh?: boolean },
  ): Promise<O.Option<FiatValue>> {
    const { fresh = true } = safeObj(config)

    if (balance.value === 0n) return O.none()

    if (BalanceImpl.isNone(balance)) {
      return O.none()
    }

    const tokenRate = pipe(
      this.resolvers.priceManager.getSafe(balance.symbol, { fresh }),
      Effect.map((usd_rate) => {
        return BalanceImpl.toNumber(balance) * usd_rate.amount
      }),
      Effect.map((amount) => FiatImpl.asDollar(amount)),
      isDevelopment ? Effect.delay("5 seconds") : Effect.map(identity),
    )

    return tokenRate.pipe(
      Effect.match({
        onSuccess: (balance) => O.some(balance),
        onFailure: () => O.none(),
      }),
      Effect.runPromise,
    )
  }

  /**
   * @description Sets a balance for an asset.
   * @param params
   */
  setBalance(
    params: Omit<AssetItem, "fiatBalance" | "balance"> & {
      balance: AppBalance
    },
  ) {
    const new_bal = params.balance
    const item = params
    const key = this.store.balanceId(item)

    try {
      const match = this.store.balances.get(key)

      if (!match) {
        this.store.updateBalance(key, {
          ...item,
          balance: O.some(new_bal),
          fiatBalance: O.none(),
        })
        return
      }

      if (new_bal.value > 0n) {
        this.store.updateBalance(key, {
          ...match,
          balance: O.some(new_bal),
        })

        return
      }

      this.store.updateBalance(key, {
        ...match,
        balance: O.none(),
        fiatBalance: O.none(),
      })
    } finally {
      const entry = this.store.balances.get(key)
      if (entry) {
        this.dispatchEvent(
          balanceUpdate({
            key,
            entry,
          }),
        )
      }
    }
  }

  // @ts-expect-error Enforce type
  override addEventListener(
    type: "balanceUpdated",
    callback: EventListener,
    options?: AddEventListenerOptions | boolean,
  ): void {
    // biome-ignore lint/suspicious/noExplicitAny: Callback interface overrided
    super.addEventListener(type, callback as any, options)
  }
}

type EventListener = (evt: ReturnType<typeof balanceUpdate>) => void

function balanceUpdate(data: { key: string; entry: AssetItem }) {
  return new CustomEvent("balanceUpdated", {
    detail: data,
  })
}
