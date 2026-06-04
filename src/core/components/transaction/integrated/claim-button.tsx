import { observer } from "mobx-react"
import { ClaimButton, ShowClaimWhenButton } from "@/components/claim-button"
import { LoadingButtonContent } from "@/components/loading-button"
import { useTxTimeline } from "./context"

export const TTClaimButton = observer(function TimelineClaimButton() {
  const { tx: transaction, controller } = useTxTimeline()

  return (
    <ShowClaimWhenButton
      tx={transaction}
      showStatus={controller.state.showClaimButton}
    >
      <ClaimButton
        transaction={transaction}
        disabled={
          controller.state.claimPromise.state === "pending" ||
          controller.state.claimInitState === "pending"
        }
        onClick={() => {
          controller.doClaimFunds()
        }}
      >
        <LoadingButtonContent
          loading={controller.state.claimPromise.state === "pending"}
          loadingText="Claiming funds"
        >
          {transaction.protocol.kind === "Transfer"
            ? "Claim Funds"
            : "Complete your transaction"}
        </LoadingButtonContent>
      </ClaimButton>
    </ShowClaimWhenButton>
  )
})
