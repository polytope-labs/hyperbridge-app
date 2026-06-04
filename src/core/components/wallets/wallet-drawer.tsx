import { HBDrawer, Sheet } from "@hyperbridge/ui"
import isMobile from "is-mobile"
import { observer } from "mobx-react"
import { ConnectWalletDialog } from "@/components/wallets/wallet-connection"
import { handleCloseDrawer, walletConnectionState } from "@/stores/wallet"

export const WalletDrawer = observer(function WalletDrawer() {
  const { drawerState } = walletConnectionState
  const RootComponent = isMobile() ? HBDrawer : Sheet

  return (
    <RootComponent
      open={drawerState !== "closed"}
      onOpenChange={(open: boolean) => !open && handleCloseDrawer()}
      modal={true}
    >
      <ConnectWalletDialog params={{}} />
    </RootComponent>
  )
})
