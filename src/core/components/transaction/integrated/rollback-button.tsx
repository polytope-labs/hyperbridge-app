import { Button, GradientButton } from "@hyperbridge/ui"
import { observer } from "mobx-react"
import { LoadingButtonContent } from "@/components/loading-button"
import { Type } from "@/components/typing"
import If from "@/components/utils/if"
import { HyperBridgeConnectWallet } from "@/components/wallets/wallet-button"
import { TxImpl } from "@/lib/factories/transaction"
import { WalletManager } from "@/lib/wallet-manager"
import { useTxTimeline } from "./context"

export const TTRollbackButton = observer(function TTRollbackButton() {
  const { tx, controller, mode } = useTxTimeline()

  if (!TxImpl.is_timed_out(tx)) return null

  if (mode === "rollback") {
    if (TxImpl.is_waiting_for_timeout_stream_to_begin(tx)) {
      return (
        <Button
          onClick={() => {
            controller.initializeRollback({})
          }}
        >
          {TxImpl.match(tx, {
            transfer: () => "Recover transaction",
            inscription: () => "Begin transaction",
            _: () => null,
          })}
        </Button>
      )
    }

    return (
      <If cond={!TxImpl.is_completed(tx, "rollback")}>
        <TRecoverFundsButton />
      </If>
    )
  }

  return null
})

const TRecoverFundsButton = observer(function TRecoverFundsButton() {
  const { tx, controller } = useTxTimeline()

  const is_claim_pending = controller.state.claimPromise.state === "pending"

  return (
    <>
      {!WalletManager.accounts.evm ? (
        <HyperBridgeConnectWallet network="evm">
          <GradientButton>Connect EVM Wallet</GradientButton>
        </HyperBridgeConnectWallet>
      ) : (
        <>
          <If cond={TxImpl.is_time_for_refund(tx)}>
            <GradientButton
              animate={is_claim_pending}
              disabled={is_claim_pending}
              onClick={() => {
                controller.doClaimRefund()
              }}
            >
              <LoadingButtonContent
                loading={controller.state.claimPromise.state === "pending"}
                loadingText={
                  tx.protocol.kind === "Transfer"
                    ? "Recovering Funds"
                    : "Timing transaction"
                }
              >
                {tx.protocol.kind === "Transfer"
                  ? "Recover Funds"
                  : "Time out transaction"}
              </LoadingButtonContent>
            </GradientButton>
          </If>

          <If cond={!TxImpl.is_timeout_finalized(tx)}>
            <Button variant="secondary" disabled>
              {TxImpl.match(tx, {
                transfer: () => (
                  <span className="inline-flex">
                    Waiting for calldata to be ready <Type values={["..."]} />
                  </span>
                ),
                inscription: () => <>Transaction</>,
                _: () => null,
              })}
            </Button>
          </If>
        </>
      )}
    </>
  )
})
