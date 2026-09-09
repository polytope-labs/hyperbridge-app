import {
  Text,
  TimelineRoot,
  TokenTransferPair,
  TimelineListGroup as TTListGroup,
} from "@hyperbridge/ui"
import { Alert, Circle } from "@hyperbridge/ui/icons"
import { shortenAccountAddress } from "@hyperbridge-fe/shared"
import { CheckCircle, Pause, Play, Square } from "lucide-react"
import { observer } from "mobx-react"
import React from "react"
import { CopyTransactionButton } from "@/components/devtools/copy-transaction"
import If from "@/components/utils/if"
import { isDevelopment, NETWORK_ENV } from "@/config/constants"
import { TxImpl } from "@/lib/factories/transaction"
import { debugLogger, rootLogger } from "@/lib/logger"
import { EventTFMap } from "@/lib/timeline/steps/list"
import type { RunningState } from "@/lib/transactions/mediator"
import { cn } from "@/lib/utils"
import { tokenValueFormatter } from "@/lib/utils/formatting"
import type { ExplicitStatusKey, LegacyTxStatusKey, TxMode } from "@/types/tx"

import { TTItem } from "../tx-row"
import { TTClaimButton } from "./claim-button"
import { useTxTimeline } from "./context"
import { TTCountdown, TTDuration, TTimerWrap } from "./countdown"
import { TTRollbackButton } from "./rollback-button"

export const TTContent = observer(function TTContent() {
  const { mode: tx_mode, tx } = useTxTimeline()
  debugLogger.trace("Re-rendering TTContent")

  // When no timeout is set. A transaction will not timeout automatically.
  // Basically, it'll be struck in PENDING_TIMEOUT until anyone initialize a rollback
  const will_timeout = tx.originalParams.timeout > 0

  return (
    <div className="flex flex-col gap-[calc(24rem/16)] py-4">
      <TTDebug />

      <TTTokenTransferPair />

      <TTimerWrap>
        <TimelineRoot>
          <TTActivity />
        </TimelineRoot>
      </TTimerWrap>

      <TTRollbackButton />
      <TTClaimButton />
      <TTDuration />

      <If cond={tx_mode === "send" && will_timeout}>
        <div className="flex flex-col items-center">
          <div className="w-max">
            <TTCountdown severity={"default"} />
          </div>
        </div>
      </If>

      <div className="-mb-4">
        <CopyTransactionButton transaction={tx} />
      </div>
    </div>
  )
})

export const TTActivity = observer(function TTActivity() {
  const { tx, flow, controller } = useTxTimeline()
  const source = controller.sourceNetwork.get()

  const eventsTFMap = EventTFMap(tx)
  const token = controller.token.get()

  function renderItem(event_key: ExplicitStatusKey, level: 1 | 0) {
    debugLogger.trace("Re-rendering TTItem")

    const tf = eventsTFMap.get(event_key)

    const [, event] = event_key.split("/") as [TxMode, LegacyTxStatusKey]

    if (!token) {
      rootLogger.warn("[TTActivity] Token missing")
      return null
    }

    if (!source) return null

    if (!tf) {
      rootLogger.warn("[TTActivity] TF missing")

      return null
    }

    return (
      <TTItem
        key={event_key}
        event={event}
        level={level}
        token={token}
        eventTransfer={tf}
      />
    )
  }

  debugLogger.trace("Re-rendering TTActivity")

  return (
    <>
      {flow.map((entry) => {
        if (!entry) return null

        const parent = renderItem(entry?.key, 0)

        if (entry.children.length > 0) {
          return (
            <React.Fragment key={entry.key}>
              {parent}

              <TTListGroup>
                {entry.children.map((e) => {
                  return renderItem(e.key, 1)
                })}
              </TTListGroup>
            </React.Fragment>
          )
        }

        return parent
      })}
    </>
  )
})

export const TTTokenTransferPair = observer(function TTTokenTransferPair() {
  const { tx, controller, mode } = useTxTimeline()
  const token = controller.token.get()
  const source = controller.sourceNetwork.get()
  const dest = controller.destNetwork.get()

  return (
    <section className="flex flex-col items-center gap-[1rem]">
      {TxImpl.match(tx, {
        transfer(transfer) {
          return (
            <>
              <TokenTransferPair
                size="2.5rem"
                fromToken={{
                  src: token.logo,
                  alt: `${token.name} Logo`,
                  badgeSrc: source?.logo ?? "",
                  badgeAlt: `${source?.name} Logo`,
                }}
                toToken={{
                  src: token.logo,
                  alt: `${token.name} Logo`,
                  badgeSrc: dest?.logo ?? "",
                  badgeAlt: `${dest?.name} Logo`,
                }}
              />

              <If cond={mode === "send"}>
                <div className="flex flex-col items-center gap-1 text-center">
                  <Text className="text-brand-white-500" variant="h6">
                    Bridging{" "}
                    {tokenValueFormatter.format(transfer.protocol.amount)}{" "}
                    {token.symbol}
                  </Text>
                </div>
              </If>

              <If cond={mode === "rollback"}>
                <div className="flex flex-col items-center gap-1 text-center">
                  <Text className="text-brand-white-500" variant="h6">
                    Transfer timed out
                  </Text>
                  <Text className="text-brand-black-100" variant="body1">
                    Bridging{" "}
                    {tokenValueFormatter.format(transfer.protocol.amount)}{" "}
                    {token.symbol}
                  </Text>
                </div>
              </If>
            </>
          )
        },
        _: () => <>Shouldn't be visible</>,
      })}
    </section>
  )
})

const TTDebug = observer(function TTDebug() {
  const { tx, mode, controller } = useTxTimeline()

  if (!isDevelopment) return null

  return (
    <div className="text-brand-black-100 border-brand-white-500/[0.2] absolute left-2 top-2 rounded-lg border bg-white/[0.05] p-3 text-xs backdrop-blur">
      <p>Mode: {mode}</p>
      <p>Network: {NETWORK_ENV}</p>
      <p className="flex gap-1">
        Track Status: <TrackingState value={controller.running_state.value} />
      </p>
      <p>Hash: {shortenAccountAddress(tx.transaction_hash)}</p>
      <p>
        Commitment:{" "}
        {tx.commitment_hash
          ? shortenAccountAddress(tx.commitment_hash)
          : "None yet"}
      </p>
      <p className="flex items-center gap-1">
        Issues:{" "}
        {tx.request ? (
          "None"
        ) : (
          <span
            className="flex items-center text-yellow-500"
            title="Request details are still loading; status tracking will continue"
          >
            <Alert /> <span>&nbsp;IPostRequest loading</span>
          </span>
        )}
      </p>
    </div>
  )
})

function TrackingState({ value }: { value: RunningState }) {
  const classNameMap: Record<RunningState, string> = {
    idle: "",
    running: "text-blue-500",
    completed: "text-green-500",
    stop: "text-red-500",
    paused: "text-purple-500",
  } as const

  const iconMap = {
    idle: <Circle className="size-[1em]" />,
    running: <Play className="size-[1em]" />,
    completed: <CheckCircle className="size-[1em]" />,
    stop: <Square className="size-[1em]" />,
    paused: <Pause className="size-[1em]" />,
  }

  const className = classNameMap[value]

  return (
    <span className={cn(className, "inline-flex items-center gap-1")}>
      {iconMap[value]} <span className="first-letter:uppercase">{value}</span>
    </span>
  )
}
