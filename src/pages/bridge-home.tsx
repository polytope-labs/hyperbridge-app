import { BridgeTransfer } from "@app/components/integrated/bridge"
import { hasBridgeTokens } from "@app/stores/transfer"
import {
  EmptyState,
  EmptyStateContent,
  IconButton,
  Text,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@hyperbridge/ui"
import { History } from "@hyperbridge/ui/icons"
import isMobile from "is-mobile"
import { observer } from "mobx-react"
import { BackgroundAnimation } from "@/components/background-animation"
import { SettingsDialog } from "@/components/settings-dialog"
import { SidebarActions } from "@/components/wallets/wallet-connection"
import "@/lib/global-listeners"

export const BridgeHomePage = observer(function BridgeHomePage() {
  const is_mobile = isMobile()

  return (
    <div className="min-h-(--content-height) flex items-center justify-center px-5 md:px-0">
      {!is_mobile && <BackgroundAnimation />}

      {hasBridgeTokens ? (
        <div className="bg-background relative mx-auto flex max-w-[calc(440rem/16)] flex-col gap-4">
          <div className="flex justify-between">
            <Text variant="h6">Bridge</Text>

            <Tooltip>
              <SidebarActions targetView="active">
                <TooltipTrigger asChild>
                  <IconButton
                    rounded="full"
                    variant="secondary"
                    className="cursor-pointer"
                  >
                    <History className="size-5" />
                  </IconButton>
                </TooltipTrigger>
              </SidebarActions>
              <TooltipContent>Active transactions</TooltipContent>
            </Tooltip>
          </div>

          <BridgeTransfer />
        </div>
      ) : (
        <BridgeUnavailableMessage />
      )}
      <SettingsDialog />
    </div>
  )
})

function BridgeUnavailableMessage() {
  return (
    <div className="bg-background relative mx-auto flex w-full max-w-[calc(440rem/16)] flex-col">
      <EmptyState isEmpty={true}>
        <EmptyStateContent className="flex flex-col items-center justify-center py-16 text-center">
          <p className="body-2 text-brand-black-100 mb-1">
            No HFT tokens deployed
          </p>
          <p className="caption text-brand-black-60 max-w-sm">
            Hyperfungible tokens have not been deployed yet. The bridge will
            appear here once tokens are available on any supported network.
          </p>
        </EmptyStateContent>
      </EmptyState>
    </div>
  )
}
