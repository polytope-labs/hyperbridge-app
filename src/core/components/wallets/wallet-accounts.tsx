import React from "react"
import { HeaderNested, ListSection, WalletProviderItem } from "@hyperbridge/ui"
import type { NetworkTagSimple } from "@hyperbridge-fe/shared"
import { resolvePublicUrl } from "@hyperbridge-fe/shared/lib"
import {
  normalizeProviderType,
  useEnableWallet,
  type WalletProvider,
  WalletProviderStatus,
  WalletProviderType,
} from "@hyperbridge-fe/web3-connect"
import {
  isEvmProvider,
  resolveNetworkGroupByProvider,
} from "@hyperbridge-fe/web3-connect/helpers"
import { runInAction } from "mobx"
import { observer } from "mobx-react"
import {
  getUIWalletStatus,
  getUnsupportedMessage,
  handleWalletCancel,
} from "@/helpers/wallet-helpers"
import { rootLogger } from "@/lib/logger"
import { delay } from "@/lib/utils/async.helpers"
import { WalletManager } from "@/lib/wallet-manager"
import { activeAccounts, switchToNextAvailableAccount } from "@/stores/wallet"
import type { NetworkConfigWithDescription } from "@/types/network-types"
import { ScrollArea } from "../ui/scroll-area"
import { getErrorMessage } from "@/lib/error.helpers"
import { safeStr } from "@/lib/data.helpers"

export const WalletAccounts = observer(
  ({
    selectedNetworkConfig,
    handleBackToNetworks,
    installedWallets,
    notInstalledWallets,
    unsupportedWallets,
  }: {
    selectedNetwork: NetworkTagSimple
    selectedNetworkConfig: NetworkConfigWithDescription
    handleBackToNetworks: () => void
    installedWallets: WalletProvider[]
    notInstalledWallets: WalletProvider[]
    unsupportedWallets: WalletProvider[]
    handleCloseDrawer: () => void
  }) => {
    return (
      <div className="flex h-full flex-col">
        <HeaderNested
          heading={selectedNetworkConfig.name}
          image={{
            src: selectedNetworkConfig.logo,
            alt: `${selectedNetworkConfig.name} Logo`,
          }}
          onBack={handleBackToNetworks}
        />

        <ScrollArea className="-mx-4 flex-1">
          <div className="flex !h-full min-h-0 flex-1 flex-col gap-[1.5rem] px-4">
            {installedWallets.length > 0 && (
              <ListSection caption="Installed">
                {installedWallets.map((provider) => {
                  return (
                    <WalletConnectionIntegrated
                      key={provider.type}
                      provider={provider}
                      onSuccess={() => {
                        delay(200)
                          .then(handleBackToNetworks)
                          .then(() => delay(200))
                          .then(() =>
                            switchToNextAvailableAccount(activeAccounts.get()),
                          )
                          .catch(() =>
                            rootLogger.error(
                              "Successful Wallet Connection hook failed",
                            ),
                          )
                      }}
                    />
                  )
                })}
              </ListSection>
            )}

            {notInstalledWallets.length > 0 && (
              <ListSection caption="Not installed">
                {notInstalledWallets.map((provider) => (
                  <WalletProviderItem
                    key={provider.type}
                    image={{
                      name: provider.wallet.title,
                      src: resolvePublicUrl(provider.wallet.logo.src),
                    }}
                    status={getUIWalletStatus(provider)}
                    installed={false}
                    onConnect={() => {
                      openInstallUrl(provider.wallet.installUrl)
                    }}
                  />
                ))}
              </ListSection>
            )}

            {unsupportedWallets.length > 0 && (
              <ListSection caption="Other">
                {unsupportedWallets.map((provider) => (
                  <WalletProviderItem
                    key={provider.type}
                    image={{
                      name: provider.wallet.title,
                      src: resolvePublicUrl(provider.wallet.logo.src),
                    }}
                    status="idle"
                    installed={false}
                    unsupported={getUnsupportedMessage(provider.type)}
                  />
                ))}
              </ListSection>
            )}
          </div>
        </ScrollArea>
      </div>
    )
  },
)

const WalletConnectionIntegrated = observer(
  function WalletConnectionIntegrated({
    provider,
    onSuccess,
  }: {
    provider: WalletProvider
    onSuccess: () => void
  }) {
    const { type } = provider

    const { enable } = useEnableWallet(type, {
      onMutate: () => {
        WalletManager.setStatus(type, WalletProviderStatus.Pending)
      },
      onSuccess: (accounts) => {
        WalletManager.setStatus(type, WalletProviderStatus.Connected)

        if (!isEvmProvider(type) && accounts?.[0]?.wallet) {
          const account = accounts[0]
          const wallet = account.wallet
          if (wallet) {
            const providerType = normalizeProviderType(wallet) || type
            const networkGroup = resolveNetworkGroupByProvider(providerType)

            runInAction(() => {
              WalletManager.setAccount(networkGroup, {
                address: account.address,
                displayAddress: account.address,
                name: safeStr(account.name),
                provider: providerType,
                isExternalWalletConnected: false,
              })
            })
          }
        }

        onSuccess()
      },
      onError: (error) => {
        const errorMessage = getErrorMessage(error)

        if (
          type !== WalletProviderType.WalletConnect &&
          type !== WalletProviderType.WalletConnectEvm
        ) {
          WalletManager.setStatus(type, WalletProviderStatus.Error)
        }

        WalletManager.setError(type, errorMessage)
      },
    })

    const providerStatus = WalletManager.getStatus(type)

    const status = React.useMemo(() => {
      const status_map = {
        [WalletProviderStatus.Error]: "failed",
        [WalletProviderStatus.Pending]: "pending",
        [WalletProviderStatus.Disconnected]: "idle",
        [WalletProviderStatus.Connected]: "connected",
      } as const
      return providerStatus ? status_map[providerStatus] : "idle"
    }, [providerStatus])

    function connectWallet() {
      if (status === "connected") {
        return WalletManager.disconnect(type)
      }

      if (type === WalletProviderType.WalletConnect) {
        enable("polkadot")
      } else if (type === WalletProviderType.WalletConnectEvm) {
        enable("eip155")
      } else if (provider.wallet.installed) {
        enable(undefined)
      } else if (isEvmProvider(type)) {
        try {
          WalletManager.wagmiExtension.findConnector(provider.wallet)
          enable(undefined)
        } catch {
          openInstallUrl(provider.wallet.installUrl)
        }
      } else {
        openInstallUrl(provider.wallet.installUrl)
      }
    }

    return (
      <WalletProviderItem
        key={provider.type}
        image={{
          name: provider.wallet.title,
          src: resolvePublicUrl(provider.wallet.logo.src),
        }}
        status={getUIWalletStatus(provider)}
        onConnect={() => {
          connectWallet()
        }}
        onRetry={() => {
          connectWallet()
        }}
        onCancel={() => {
          handleWalletCancel(provider)
        }}
        onDisconnect={() => {
          WalletManager.disconnectProvider(provider.type)
        }}
      />
    )
  },
)

function openInstallUrl(installUrl: string) {
  window.open(installUrl, "_blank")
}
