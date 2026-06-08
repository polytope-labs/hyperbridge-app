import { type NetworkConfig, safeArray } from "@hyperbridge-fe/shared"
import type { AnyToken } from "@hyperbridge-fe/shared/types"
import { Either } from "effect"
import { makeAutoObservable } from "mobx"
import { makePersistable } from "mobx-persist-store"
import { hash } from "ohash"
import { safeJSONParse, stringifyBigInt } from "@/lib/transform.helpers.ts"
import type { AppBalance, FiatValue } from "@/types"
import { BalanceImpl } from "./factories/balance"
import { FiatImpl } from "./factories/fiat"
import { rootLogger } from "./logger"
import { local_storage } from "./storage/local"
import { O, pipe } from "./utils/fp.helpers"

export type AssetItem = {
  token: AnyToken
  network: NetworkConfig
  balance: O.Option<AppBalance>
  fiatBalance: O.Option<FiatValue>
}

const logger = rootLogger.withTag("AssetManagerStore")

type AssetStoreState = {
  totalBalance: FiatValue
  balances: Map<string, AssetItem>
  assets: { token: AnyToken; network: NetworkConfig }[]
}

export class AssetManagerStore implements AssetStoreState {
  balances = new Map<string, AssetItem>()

  assets = <{ token: AnyToken; network: NetworkConfig }[]>[]

  constructor() {
    makeAutoObservable(this)

    makePersistable<AssetStoreState, keyof AssetStoreState>(this, {
      name: "asset-manager-store",
      properties: [
        {
          key: "balances",
          serialize: (balances) => {
            return stringifyBigInt(balances)
          },
          deserialize(store) {
            const store_as_array = safeJSONParse(store, []) as Array<
              [string, AssetItem]
            >

            const entries = Iterator.from(store_as_array)
              .map(([key, item]) => {
                const balance = pipe(
                  O.fromNullable(item.balance),
                  O.flatten,
                  O.flatMap((v) => {
                    return pipe(
                      BalanceImpl.decodeUnknown({
                        ...v,
                        value: BigInt(v.value),
                      }),
                      Either.match({ onLeft: O.none, onRight: O.some }),
                    )
                  }),
                )

                return [
                  key,
                  {
                    ...item,
                    balance,
                    fiatBalance: O.none(),
                  } satisfies AssetItem,
                ] as const
              })
              .toArray()

            return new Map(entries) satisfies AssetStoreState["balances"]
          },
        },
        {
          key: "assets",
          serialize: stringifyBigInt,
          deserialize: (v) => {
            return safeArray(safeJSONParse(v, []))
          },
        },
      ],
      storage: local_storage,
    })
  }

  get totalBalance() {
    logger.trace("BalanceStore updated. Syncing Total Balance")
    return AssetManagerStore.updateTotalBalance(this.balances)
  }

  static hash_assets(assets: AssetStoreState["assets"]) {
    return hash(
      assets.map((e) => `${e.token}-${e.network.name}-${e.network.chainId}`),
    )
  }

  setAssets(assets: AssetStoreState["assets"]) {
    const is_asset_list_empty = this.assets.length === 0

    const hash_changed =
      AssetManagerStore.hash_assets(this.assets) !==
      AssetManagerStore.hash_assets(assets)

    const can_reset = is_asset_list_empty || hash_changed

    if (!can_reset) return
    this.assets = assets

    this.resetBalances()
  }

  resetBalances() {
    this.balances = new Map()
  }

  static updateTotalBalance(store: AssetStoreState["balances"]) {
    const total = store
      .values()
      .map((e) => e.fiatBalance)
      .filter(O.isSome)
      .map(O.getOrElse(() => FiatImpl.empty))
      .reduce(FiatImpl.add, FiatImpl.empty)

    return total
  }

  balanceId(asset: Pick<AssetItem, "network" | "token">) {
    return `${asset.network.chainId}/${asset.token.symbol}`
  }

  updateBalance(key: string, overwrites: AssetItem) {
    logger.trace("Updating balance for", key, overwrites)

    this.balances.set(key, overwrites)
  }

  private getBalance({
    network,
    token,
  }: {
    network: NetworkConfig
    token: AnyToken
  }): O.Option<AssetItem> {
    const asset = this.balances.get(`${network.chainId}/${token.symbol}`)

    return O.fromNullable(asset)
  }

  get tokensWithFunds() {
    return Array.from(
      this.balances.values().filter((e) =>
        pipe(
          e.balance,
          O.map((e) => e.value > 0n),
          O.getOrElse(() => false),
        ),
      ),
    )
  }

  /**
   * @description reads assets with empty balances
   */
  get tokensWithoutFunds(): AssetItem[] {
    const all_hidden = this.assets
      .values()
      .filter((asset_item) => {
        // if asset isn't in the balance store
        const safe_asset = this.getBalance(asset_item)

        if (O.isNone(safe_asset)) return true

        // when asset blance hasn't been fetch
        const parseBalance = safe_asset.value.balance

        if (O.isNone(parseBalance)) return true

        // when there's a balance but it's zero
        if (parseBalance.value.value === 0n) return true

        return false
      })
      .map((e): AssetItem => {
        return {
          ...e,
          fiatBalance: O.none(),
          balance: O.none(),
        }
      })
      .toArray()

    return all_hidden
  }
}
