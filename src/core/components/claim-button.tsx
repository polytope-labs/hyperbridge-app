import { type Button, GradientButton } from "@hyperbridge/ui"
import { matchChain } from "@hyperbridge-fe/shared"
import { Slot } from "@radix-ui/react-slot"
import { observer } from "mobx-react"
import type React from "react"
import { TxImpl } from "@/lib/factories/transaction"
import type { ClaimButtonStatus } from "@/lib/transactions/progress-controller"
import { cn } from "@/lib/utils"
import { WalletManager } from "@/lib/wallet-manager"
import type { Transaction } from "@/types/tx"
import { HyperBridgeConnectWallet } from "./wallets/wallet-button"

export const ShowClaimWhenButton = observer(
  function ShowClaimWhenButton(props: {
    tx: Transaction
    showStatus: ClaimButtonStatus
    children: React.ReactNode
  }) {
    const { tx, children, showStatus: statusKey } = props

    if (!TxImpl.is_self_delivery_enabled(tx)) return null
    if (TxImpl.is_timed_out(tx)) return null
    if (TxImpl.isDelivered(tx)) return null

    const content = (
      <Slot data-waittime-elapsed={statusKey === "WaitTimeOver"}>
        {children}
      </Slot>
    )

    if (statusKey === "WaitTimeOver") return content

    if (TxImpl.is_time_to_claim(tx)) return content

    return null
  },
)

/**
 * @todo: Test this Component
 * @returns
 */
export function ClaimButton(
  props: React.ComponentProps<typeof Button> & {
    transaction: Transaction
  },
) {
  const { transaction, children, ...PROPS } = props

  return matchChain(transaction.destination, {
    evm: () => {
      if (!WalletManager.accounts.evm) {
        return (
          <HyperBridgeConnectWallet network="evm">
            <GradientButton>Connect EVM Wallet</GradientButton>
          </HyperBridgeConnectWallet>
        )
      }

      return (
        <GradientButton {...PROPS} className={cn("w-full", PROPS.className)}>
          {children}
        </GradientButton>
      )
    },
    none: () => null,
  })
}
