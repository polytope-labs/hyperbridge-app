import { safeArray } from "@hyperbridge-fe/shared"
import { isEvmAddress } from "@hyperbridge-fe/shared/lib"
import {
  useAnnounceProviders,
  useWalletAccounts,
} from "@hyperbridge-fe/web3-connect"
import { autorun, observe, runInAction } from "mobx"
import React from "react"
import { useMedia } from "react-use"
import { WalletManager } from "@/lib/wallet-manager"
import { walletConnectionState } from "@/stores/wallet"

export function InitializeProviders() {
  useInitializeWalletManager()

  const wallet_accounts = useWalletAccounts()

  React.useEffect(() => {
    const disposer = autorun(() => {
      if (walletConnectionState.drawerState === "wallets") {
        wallet_accounts.refetch()
      }
    })

    const disposer1 = observe(WalletManager, (change) => {
      if (change.name === "providers" || change.name === "accounts") {
        console.log("{>>>}", change.name)
        //observer the providers and refetch accounts;
        wallet_accounts.refetch()
      }
    })

    return () => {
      disposer()
      disposer1()
    }
  }, [wallet_accounts])

  React.useEffect(() => {
    runInAction(() => {
      const existingEvmAccounts = walletConnectionState.accounts.filter(
        (acc) => acc && isEvmAddress(acc.address),
      )

      const substrateAccounts = safeArray(wallet_accounts.data)

      const allAccounts = [...existingEvmAccounts, ...substrateAccounts]
      const seen = new Set<string>()
      const uniqueAccounts = allAccounts.filter((acc) => {
        if (!acc) return false
        const key = `${acc.address}:${acc.provider}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      walletConnectionState.accounts = uniqueAccounts
    })
  }, [wallet_accounts.data])

  return null
}

function useInitializeWalletManager() {
  useAnnounceProviders()
  const isDesktop = useMedia("(min-width: 768px)")

  React.useEffect(() => {
    WalletManager.loadProviders({
      platform: isDesktop ? "desktop" : "mobile",
    })
    WalletManager.reconnectOnRefresh().catch((err) => {
      console.error("APP_ERROR: Reconnection failed!", err)
    })
  }, [isDesktop])
}
