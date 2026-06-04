import { type TransferState, transferState } from "@app/stores/transfer"
import { fullRefresh, makeTransfer } from "@app/stores/transfer-actions"
import {
  receivedAmount,
  receivedUSDAmount,
  senderUsdValue,
} from "@app/stores/transfer-computed"
import {
  Dialog,
  DialogFooter,
  DialogHeader,
  DialogMorphContent,
  DialogTitle,
  DialogTrigger,
  IconButton,
  LabelledSeperator,
  ReviewItem,
  ReviewItemAddress,
  Text,
} from "@hyperbridge/ui"
import { ChevronBottomDown } from "@hyperbridge/ui/icons"
import {
  approximateFraction,
  logger,
  shortenAccountAddress,
} from "@hyperbridge-fe/shared"
import { pipe } from "effect"
import { clamp } from "effect/BigInt"
import once from "lodash-es/once"
import { observer } from "mobx-react"
import React from "react"
import { ComputedTextValue } from "@/components/integrated/values"
import {
  LoadingButton,
  LoadingButtonContent,
} from "@/components/loading-button"
import { assetManager } from "@/config/services/asset-manager.ts"
import { txMediator } from "@/config/services/tx-mediator.ts"
import { BalanceImpl } from "@/lib/factories/balance"
import { rootLogger } from "@/lib/logger"
import { safeNetworkConfig } from "@/lib/utils"
import { balancePreviewFormatter } from "@/lib/utils/formatting"
import { O } from "@/lib/utils/fp.helpers"
import { toast } from "@/lib/utils/toast"
import { txPopup } from "@/stores/tx-preview"
import type { HexString } from "@/types/tx"
import { BridgeSummaryContent } from "./bridge-summary"

const truncateNum = approximateFraction(balancePreviewFormatter)

export function ConfirmTx(props: { children: React.ReactNode }) {
  const source = safeNetworkConfig(transferState.sourceChain)
  const destination = safeNetworkConfig(transferState.destChain)
  const toggleRef = React.useRef<HTMLButtonElement>(null)

  return (
    <Dialog>
      <DialogTrigger asChild>{props.children}</DialogTrigger>

      <DialogMorphContent className="flex flex-col gap-0">
        <DialogHeader>
          <DialogTitle>Review</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 select-none flex-col gap-6">
          <section className="flex flex-col gap-1.5">
            <Text variant={"caption"}>You're bridging</Text>

            <ul className="flex flex-col items-center justify-center gap-[calc(3rem/16)] *:first:rounded-t-[1rem] *:last:rounded-b-[1rem]">
              {pipe(
                source,
                O.map((network) => {
                  return (
                    <ReviewItem
                      key="from"
                      tag="from"
                      networkName={network.name}
                      address={transferState.account}
                      asset={{
                        amount: truncateNum(Number(transferState.amount)),
                        symbol: transferState.token.symbol,
                        secondaryValue: (
                          <ComputedTextValue computedValue={senderUsdValue} />
                        ),
                      }}
                      badge={{
                        alt: transferState.token.symbol,
                        src: transferState.token.logo,
                        badgeAlt: network.name,
                        badgeSrc: network.logo,
                      }}
                      AddressInfo={AddressInfo}
                    />
                  )
                }),
                O.getOrElse(() => null),
              )}

              <IconButton
                size="xs"
                variant={"level_1"}
                rounded={"default"}
                className="!text-brand-black-100 border-brand-black-600 pointer-events-none absolute box-content w-[calc(24rem/16)] transform border-[3px]"
                asChild
              >
                <span>
                  <ChevronBottomDown />
                </span>
              </IconButton>

              {pipe(
                destination,
                O.map((network) => {
                  return (
                    <ReviewItem
                      key="to"
                      tag="to"
                      networkName={network.name}
                      address={transferState.recipient}
                      asset={{
                        amount: truncateNum(Number(receivedAmount.get())),
                        symbol: transferState.token.symbol,
                        secondaryValue: (
                          <ComputedTextValue
                            computedValue={receivedUSDAmount}
                          />
                        ),
                      }}
                      badge={{
                        alt: transferState.token.symbol,
                        src: transferState.token.logo,
                        badgeAlt: network.name,
                        badgeSrc: network.logo,
                      }}
                      AddressInfo={AddressInfo}
                    />
                  )
                }),
                O.getOrElse(() => null),
              )}
            </ul>
          </section>

          <div className="flex flex-col gap-4">
            <LabelledSeperator>Bridge summary</LabelledSeperator>
            <BridgeSummaryContent />
          </div>
        </div>

        <DialogFooter className="mt-[calc(24rem/16)]">
          <SubmitButton
            onClick={async () => {
              const trigger = transferState.bridgingTrigger

              if (O.isNone(trigger)) {
                return toast.error(
                  "Transaction failed. No bridging trigger provided",
                )
              }

              await makeTransfer(trigger.value, {
                handleEvents: once((event) => {
                  const hash = event.transaction_hash
                  txMediator.addByHash(hash)

                  optimisticUpdate(transferState, event.amount)
                  fullRefresh()

                  setTimeout(() => {
                    txPopup.switch(hash as HexString)

                    // close the review-popup
                    toggleRef.current?.click?.()
                  }, 0)
                }),
              }).catch((err) => {
                toast.error("Failed to bridge")
                rootLogger.error(err)
              })
            }}
          />
        </DialogFooter>

        <DialogTrigger ref={toggleRef} className="hidden">
          Close
        </DialogTrigger>
      </DialogMorphContent>
    </Dialog>
  )
}

const SubmitButton = observer(function SubmitButton(
  props: React.ComponentProps<typeof LoadingButton>,
) {
  const isLoading =
    transferState.relayerFee.state === "pending" ||
    transferState.transactionPending

  return (
    <LoadingButton className="w-full" loading={isLoading} {...props}>
      <LoadingButtonContent
        loading={isLoading}
        loadingText="Confirm Transaction"
      >
        Bridge now
      </LoadingButtonContent>
    </LoadingButton>
  )
})

function AddressInfo({ address, tag }: { address: string; tag: string }) {
  return (
    <ReviewItemAddress
      tag={tag}
      address={shortenAccountAddress(address ?? "")}
    />
  )
}

/**
 *
 * @todo: test this logic
 * @param transferState
 * @param last_amount
 */
function optimisticUpdate(transferState: TransferState, last_amount: bigint) {
  const _logger = logger.withTag("OptimisticUpdate")
  try {
    _logger.info("Performing optimistic update")

    const cur_bal = transferState.syncBalance
    const new_bal = pipe(
      cur_bal,
      BalanceImpl.map((cur_value) => cur_value - last_amount),
      BalanceImpl.map(clamp({ minimum: 0n, maximum: cur_bal.value })),
    )

    O.gen(function* () {
      const network = yield* safeNetworkConfig(transferState.sourceChain)

      _logger.trace("Updating balance to:", new_bal)
      assetManager.setBalance({
        network,
        balance: new_bal,
        token: transferState.token,
      })
    })

    _logger.trace("Balance updated")
  } catch (err) {
    _logger.error("Update failed with error", err)
  }
}
