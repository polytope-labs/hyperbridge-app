import {
  AccountItem,
  ListSection,
  NetworkGroupItem,
  Text,
  WalletHeaderContent,
} from "@hyperbridge/ui"
import { Plus } from "@hyperbridge/ui/icons"
import type { Account as Web3ConnectAccount } from "@hyperbridge-fe/web3-connect"
import { Image } from "@unpic/react"
import { ArrowLeftRightIcon } from "lucide-react"
import { observer } from "mobx-react"
import { handleCopyAddress } from "@/helpers/wallet-helpers"
import { refreshBalances } from "@/lib/global-listeners"
import { scheduler_yield } from "@/lib/utils/runtime.helper"
import { toast } from "@/lib/utils/toast"
import { normalizeAccount, WalletManager } from "@/lib/wallet-manager"
import {
  accountGrouped,
  activeAccounts,
  handleNetworkSelect,
  switchToNextAvailableAccount,
} from "@/stores/wallet"
import type { NetworkTagSimple } from "@/types"
import If from "../utils/if"

export const WalletManageAccount = observer(function WalletManageAccount() {
  const { polkadot: polkadotAccounts, evm: evmAccounts } = accountGrouped.get()

  const handleAccountSelect = (account: Web3ConnectAccount) => {
    const normalized = normalizeAccount(account)
    WalletManager.setAccount(
      normalized.networkType as NetworkTagSimple,
      account,
    )
    toast.success(`Switched to ${account.name || normalized.shortenedAddress}`)
    scheduler_yield().then(() => refreshBalances(WalletManager.accounts))
  }

  const handleDisconnect = (account: Web3ConnectAccount) => {
    WalletManager.disconnectProvider(account.provider)
    setTimeout(() => {
      switchToNextAvailableAccount(activeAccounts.get())
    }, 400)
  }

  return (
    <WalletHeaderContent className="pt-4">
      <ListSection
        caption={
          <Text variant="body1">
            <span className="font-medium">Manage Accounts</span>
          </Text>
        }
      >
        <div className="mt-4 flex flex-col gap-6">
          {/* 🔵 Polkadot Section */}
          <ListSection
            caption={
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className="border-brand-black-600 flex size-4 items-center justify-center overflow-hidden rounded-[5px] border bg-white">
                    <Image
                      src="/networks/polkadot.png"
                      alt="Polkadot Logo"
                      width={16}
                      height={16}
                    />
                  </div>
                  <Text variant="body1" className="font-medium">
                    Polkadot
                  </Text>
                </div>
                <If cond={polkadotAccounts.length > 0}>
                  <button
                    type="button"
                    className="cursor-pointer transition-colors duration-200 hover:text-white"
                    onClick={() => handleNetworkSelect("substrate")}
                  >
                    <span className="flex items-center gap-1">
                      Add more
                      <Plus className="size-4" />
                    </span>
                  </button>
                </If>
              </div>
            }
          >
            {polkadotAccounts.length > 0 ? (
              <div className="bg-brand-black-350 mt-1.5 rounded-2xl px-3">
                {polkadotAccounts.map((account) => {
                  const normalized = normalizeAccount(account)
                  const isSelected = WalletManager.isAccountSelected(
                    { ...account, address: normalized.encodedAddress },
                    { strict: true },
                  )
                  const providerEntry = WalletManager.getProviderByType(
                    account.provider,
                  )

                  return (
                    <AccountItem
                      key={`${account.address}-${account.provider}`}
                      address={normalized.shortenedAddress}
                      network={{
                        name: "Polkadot",
                        image: "/networks/polkadot.png",
                      }}
                      wallet={{
                        name: providerEntry?.wallet?.title || account.provider,
                        image:
                          providerEntry?.wallet?.logo.src ||
                          "/tokens/unknown.svg",
                      }}
                      isActive={isSelected}
                      onCopy={() =>
                        handleCopyAddress(normalized.encodedAddress)
                      }
                      onConnect={() => handleAccountSelect(account)}
                      onDisconnect={() => handleDisconnect(account)}
                    />
                  )
                })}
              </div>
            ) : (
              <NetworkGroupItem
                image={{
                  name: "Polkadot",
                  src: "/networks/polkadot.png",
                }}
                description={"Use Polkadot-compatible wallets"}
                onConnect={() => handleNetworkSelect("substrate")}
              />
            )}
          </ListSection>

          {/* 🟣 EVM Section */}
          <ListSection
            caption={
              <div className="flex w-full items-center justify-between">
                <div className="flex items-center gap-1">
                  <div className="border-brand-black-600 flex size-4 items-center justify-center overflow-hidden rounded-[5px] border bg-white">
                    <Image
                      src="/networks/ethereum.svg"
                      alt="Ethereum Logo"
                      width={16}
                      height={16}
                    />
                  </div>
                  <Text variant="body1" className="font-medium">
                    Ethereum
                  </Text>
                </div>
                <If cond={evmAccounts.length > 0}>
                  <button
                    type="button"
                    className="cursor-pointer transition-colors duration-200 hover:text-white"
                    onClick={() => handleNetworkSelect("evm")}
                  >
                    <span className="flex items-center gap-1">
                      Switch
                      <ArrowLeftRightIcon className="size-4" />
                    </span>
                  </button>
                </If>
              </div>
            }
          >
            {evmAccounts.length > 0 ? (
              <div className="bg-brand-black-350 mt-1.5 rounded-2xl px-3">
                {evmAccounts.map((account) => {
                  const normalized = normalizeAccount(account)
                  const isSelected = WalletManager.isAccountSelected(account, {
                    strict: true,
                  })
                  const providerEntry = WalletManager.getProviderByType(
                    account.provider,
                  )

                  return (
                    <AccountItem
                      key={`${account.address}-${account.provider}`}
                      address={normalized.shortenedAddress}
                      network={{
                        name: "Ethereum",
                        image: "/networks/ethereum.svg",
                      }}
                      wallet={{
                        name: providerEntry?.wallet?.title || account.provider,
                        image:
                          providerEntry?.wallet?.logo.src ||
                          "/tokens/unknown.svg",
                      }}
                      isActive={isSelected}
                      onCopy={() =>
                        handleCopyAddress(normalized.encodedAddress)
                      }
                      onConnect={() => handleAccountSelect(account)}
                      onDisconnect={() => handleDisconnect(account)}
                    />
                  )
                })}
              </div>
            ) : (
              <NetworkGroupItem
                image={{
                  name: "Ethereum",
                  src: "/networks/ethereum.svg",
                }}
                description={"Use EVM-compatible wallets"}
                onConnect={() => handleNetworkSelect("evm")}
              />
            )}
          </ListSection>
        </div>
      </ListSection>
    </WalletHeaderContent>
  )
})
