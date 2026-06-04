import { Button, IconButton } from "@hyperbridge/ui"
import { Plus, Wallet } from "@hyperbridge/ui/icons"
import { shortenAccountAddress } from "@hyperbridge-fe/shared"
import { runInAction } from "mobx"
import { observer } from "mobx-react"
import { getSelectedAccounts } from "@/helpers/wallet-helpers"
import { encodePolkaAddress } from "@/lib/polkadot.helpers"
import { WalletManager } from "@/lib/wallet-manager"
import {
  handleConnectWalletClick,
  walletConnectionState,
} from "@/stores/wallet"
import type { HBUIAccount } from "@/types/network-types"
import { BadgeStack } from "./badge-stack"

export const Accounts = observer(function Accounts() {
  const connectedWalletAccounts = getSelectedAccounts.get()
  const connectedWalletsCount = connectedWalletAccounts.length

  const hasConnectedAccounts = WalletManager.connectedAccounts.length > 0
  const hasEvmAccount = WalletManager.accounts.evm !== null
  const hasPolkadotAccount = WalletManager.accounts.substrate !== null

  const hasSingleConnectedWallet = connectedWalletsCount === 1
  const hasBothNetworkTypes = hasEvmAccount && hasPolkadotAccount
  const hasSavedAccounts = walletConnectionState.accounts.length > 0

  const handleOpenNetworks = () => {
    const getAccountState = () => {
      if (!hasConnectedAccounts) return "no_accounts"
      if (hasEvmAccount && !hasPolkadotAccount) return "evm_only"
      if (hasPolkadotAccount && !hasEvmAccount) return "polkadot_only"
      return "both_or_unclear"
    }

    switch (getAccountState()) {
      case "no_accounts":
        walletConnectionState.drawerState = "networks"
        break

      case "evm_only":
        walletConnectionState.selectedNetwork = "substrate"
        walletConnectionState.drawerState = "wallets"
        break

      case "polkadot_only":
        walletConnectionState.selectedNetwork = "evm"
        walletConnectionState.drawerState = "wallets"
        break

      default:
        walletConnectionState.drawerState = "networks"
        break
    }
  }

  const label = (() => {
    if (!hasConnectedAccounts) {
      return hasSavedAccounts ? "Select account" : "Connect"
    }

    if (!hasSingleConnectedWallet) {
      return `${connectedWalletsCount} wallets`
    }

    const firstAddress = connectedWalletAccounts[0].address
    const unifiedAddress = WalletManager.accounts.substrate
      ? encodePolkaAddress(firstAddress)
      : firstAddress

    return `${shortenAccountAddress(unifiedAddress)}`
  })()

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="secondary"
        className="hidden min-w-[123px] items-center gap-2 !px-4 !py-[11px] md:flex"
        onClick={() => {
          const hasConnectedAccounts =
            WalletManager.connectedAccounts.length > 0

          runInAction(() => {
            if (hasConnectedAccounts || hasSavedAccounts) {
              walletConnectionState.drawerState = "wallets"
            } else {
              walletConnectionState.drawerState = "networks"
            }
          })
        }}
      >
        {hasConnectedAccounts ? (
          <BadgeStack items={connectedWalletAccounts as HBUIAccount[]} />
        ) : (
          <Wallet className="size-5" />
        )}
        <span className="body-2 leading-[1.25]">{label}</span>
      </Button>

      <IconButton
        variant="secondary"
        className="relative md:hidden"
        onClick={handleConnectWalletClick}
      >
        {hasConnectedAccounts ? (
          <BadgeStack items={connectedWalletAccounts as HBUIAccount[]} />
        ) : (
          <Wallet className="size-5" />
        )}
      </IconButton>

      {(hasConnectedAccounts || hasSavedAccounts) && !hasBothNetworkTypes && (
        <IconButton
          variant="secondary"
          className="relative !hidden cursor-pointer md:block"
          onClick={handleOpenNetworks}
        >
          <Plus className="size-5" />
        </IconButton>
      )}
    </div>
  )
})
