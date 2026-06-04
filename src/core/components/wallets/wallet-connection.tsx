import {
  CWDrawerContent,
  DialogTitle,
  HeaderChooseProvider,
  ListSection,
  NetworkGroupItem,
  WalletConnectedHeader,
  WalletHeader,
  WalletHeaderContentBlur,
  WalletManagerUIProvider,
} from "@hyperbridge/ui"
import { logger, type NetworkTagSimple } from "@hyperbridge-fe/shared"
import { NetworkImpl } from "@hyperbridge-fe/shared/factories"
import { Slot } from "@radix-ui/react-slot"
import { Either, pipe } from "effect"
import isMobile from "is-mobile"
import { observer } from "mobx-react"
import { useEffect } from "react"
import If from "@/components/utils/if"
import { Accounts } from "@/components/wallets/connect-button"
import { WalletAccounts } from "@/components/wallets/wallet-accounts"
import { WalletManageAccount } from "@/components/wallets/wallet-header-section"
import { WalletMainContent } from "@/components/wallets/wallet-main-section"
import { NETWORKS } from "@/config/constant"
import {
  categorizeWallets,
  getNetworkCompatibleWallets,
  getSelectedAccounts,
} from "@/helpers/wallet-helpers"
import { findToasterRootElementFrom } from "@/lib/utils/toast"
import {
  handleBackToNetworks,
  handleCloseDrawer,
  handleNetworkSelect,
  viewMode,
  walletConnectionState,
} from "@/stores/wallet"
import type { NetworkConfigWithDescription } from "@/types/network-types"
import {
  HyperBridgeConnectWallet,
  type MultiConnectParams,
} from "./wallet-button"

export const WalletConnectionButton = observer(
  function WalletConnectionButton() {
    const {
      drawerState,
      selectedNetwork,
      accounts: walletAccounts,
    } = walletConnectionState

    const connectedWalletAccounts = getSelectedAccounts.get()

    const selectedNetworkConfig = selectedNetwork
      ? NETWORKS.find((n) => NetworkImpl.group(n) === selectedNetwork)
      : null

    const hasConnectedAccounts = connectedWalletAccounts.length > 0
    const hasSavedAccounts = walletAccounts.length > 0

    useEffect(() => {
      if (
        drawerState === "wallets" &&
        !hasConnectedAccounts &&
        !hasSavedAccounts &&
        !selectedNetworkConfig
      ) {
        walletConnectionState.drawerState = "networks"
      }
    }, [
      drawerState,
      hasConnectedAccounts,
      hasSavedAccounts,
      selectedNetworkConfig,
    ])

    return <Accounts />
  },
)

export const ConnectWalletDialog = observer(
  function ConnectWalletDialog(_props: { params: MultiConnectParams }) {
    const { selectedNetwork } = walletConnectionState

    const selectedNetworkConfig = selectedNetwork
      ? NETWORKS.find((n) => NetworkImpl.group(n) === selectedNetwork)
      : null

    const selectedWallets = getNetworkCompatibleWallets({
      network_group: selectedNetwork,
    })
    const platform = isMobile() ? "mobile" : "desktop"

    const view_mode = viewMode.get()
    const { installedWallets, notInstalledWallets, unsupportedWallets } =
      categorizeWallets(selectedWallets, platform)

    return (
      <CWDrawerContent
        onInteractOutside={(event) => {
          // do nothing when the target is a toast dialog
          pipe(
            findToasterRootElementFrom(event.currentTarget as HTMLElement),
            Either.match({
              onRight: () => event.preventDefault(),
              onLeft: (err) =>
                logger.trace(
                  "Ignoring outside interaction",
                  `Cause: ${err.message}`,
                ),
            }),
          )
        }}
      >
        <If cond={view_mode === "wallet_info"}>
          <DialogTitle className="sr-only">Wallet Connected</DialogTitle>

          <WalletManagerUIProvider>
            <WalletHeader persistOpen={false} className="flex flex-1 flex-col">
              <WalletConnectedHeader accounts={getSelectedAccounts.get()} />
              <WalletManageAccount />

              <WalletHeaderContentBlur className="flex flex-1 flex-col px-4">
                <WalletMainContent />
              </WalletHeaderContentBlur>
            </WalletHeader>
          </WalletManagerUIProvider>
        </If>

        <If cond={view_mode === "networks"}>
          <DialogTitle className="sr-only">Choose provider</DialogTitle>

          <HeaderChooseProvider />
          <ListSection caption="Networks">
            {NETWORKS.map((network) => {
              const id = NetworkImpl.group(network)

              return (
                <NetworkGroupItem
                  key={id}
                  image={{ src: network.logo, name: network.name }}
                  description={network.description}
                  onConnect={() => handleNetworkSelect(id)}
                />
              )
            })}
          </ListSection>
        </If>

        {/* Wallets */}
        <If cond={view_mode === "wallets" && !!selectedNetworkConfig}>
          <DialogTitle className="sr-only">Select account</DialogTitle>
          <WalletAccounts
            selectedNetwork={selectedNetwork as NetworkTagSimple}
            selectedNetworkConfig={
              selectedNetworkConfig as NetworkConfigWithDescription
            }
            installedWallets={installedWallets}
            unsupportedWallets={unsupportedWallets}
            notInstalledWallets={notInstalledWallets}
            handleCloseDrawer={handleCloseDrawer}
            handleBackToNetworks={handleBackToNetworks}
          />
        </If>
      </CWDrawerContent>
    )
  },
)

const hooks = Object.freeze({
  active: () => {
    walletConnectionState.lastViewedTab = "active"
  },
})

export function SidebarActions(props: {
  targetView: keyof typeof hooks
  children: React.ReactNode
}) {
  const hookFn = hooks[props.targetView]

  if (typeof hookFn !== "function") {
    logger.warn("[SidebarActions]: No HookFn available.")
  }

  return (
    <HyperBridgeConnectWallet>
      <Slot onClick={() => hookFn()}>{props.children}</Slot>
    </HyperBridgeConnectWallet>
  )
}
