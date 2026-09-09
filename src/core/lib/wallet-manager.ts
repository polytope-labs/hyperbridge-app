import { safeArray, shortenAccountAddress } from "@hyperbridge-fe/shared"
import type { Account as Web3ConnectAccount } from "@hyperbridge-fe/web3-connect"
import {
  type AccountsMap,
  type WalletProviderEntry,
  WalletProviderStatus,
} from "@hyperbridge-fe/web3-connect"
import { Web3ConnManager } from "@hyperbridge-fe/web3-connect/store"
import { watchAccount } from "@wagmi/core"
import { debounce } from "lodash-es"
import { observe, runInAction } from "mobx"
import { makePersistable } from "mobx-persist-store"
import { isHex } from "viem"
import { WagmiConfig } from "@/config/wagmi"
import { encodePolkaAddress } from "@/lib/polkadot.helpers"

export const WalletManager = new Web3ConnManager(WagmiConfig)

const emptyAccounts = (): AccountsMap => ({ evm: null, substrate: null })

/**
 * Hydrate both the current object format and the JSON-string format written by
 * earlier versions of the wallet persistence layer.
 */
export const deserializeAccounts = (value: unknown): AccountsMap => {
  let parsed = value

  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value)
    } catch {
      return emptyAccounts()
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return emptyAccounts()
  }

  const { evm, substrate } = parsed as Partial<AccountsMap>
  return {
    evm: evm && typeof evm === "object" ? evm : null,
    substrate: substrate && typeof substrate === "object" ? substrate : null,
  }
}

export const normalizeAccount = (account: Web3ConnectAccount) => {
  const isSubstrate = !isHex(account.address)
  const encodedAddress = isSubstrate
    ? encodePolkaAddress(account.address)
    : account.address

  return {
    ...account,
    encodedAddress,
    shortenedAddress: shortenAccountAddress(encodedAddress, 5),
    networkType: isSubstrate ? "substrate" : "evm",
  }
}

const getUnifiedAccounts = (): AccountsMap => {
  const { evm, substrate } = WalletManager.accounts
  return {
    evm,
    substrate: substrate
      ? { ...substrate, address: encodePolkaAddress(substrate.address) }
      : null,
  }
}

const getUnifiedAccountByGroup = <K extends keyof AccountsMap>(group: K) =>
  getUnifiedAccounts()[group]

export const getUnifiedAddressByGroup = <K extends keyof AccountsMap>(
  group: K,
) => getUnifiedAccountByGroup(group)?.address

export function watchAccounts({
  onChange,
}: {
  onChange: (value: AccountsMap) => void
}) {
  const handleChange = debounce(() => onChange(getUnifiedAccounts()), 500)
  const mobxCleanup = observe(WalletManager.accounts, handleChange)
  const wagmiCleanup = watchAccount(WagmiConfig, { onChange: handleChange })
  return () => {
    mobxCleanup()
    wagmiCleanup()
  }
}

if (typeof window !== "undefined") {
  const STORAGE_KEY = "wallet-manager"

  const deserializeProviders = (str: string): WalletProviderEntry[] =>
    safeArray<WalletProviderEntry>(JSON.parse(str)).filter(
      (p) => p.status === WalletProviderStatus.Connected,
    )

  makePersistable(WalletManager, {
    name: STORAGE_KEY,
    storage: window.localStorage,
    properties: [
      "meta",
      {
        key: "providers",
        serialize: JSON.stringify,
        deserialize: deserializeProviders,
      },
      "recentProvider",
      {
        key: "accounts",
        serialize: (accounts: AccountsMap) => accounts,
        deserialize: deserializeAccounts,
      },
    ],
  }).then(() => {
    const enforceUnifiedSubstrateAddress = () => {
      const { substrate } = WalletManager.accounts
      if (!substrate) return
      const unified = encodePolkaAddress(substrate.address)
      if (substrate.address !== unified) {
        runInAction(() => {
          WalletManager.accounts.substrate = { ...substrate, address: unified }
        })
      }
    }

    enforceUnifiedSubstrateAddress()
    observe(WalletManager.accounts, enforceUnifiedSubstrateAddress)
  })
}
