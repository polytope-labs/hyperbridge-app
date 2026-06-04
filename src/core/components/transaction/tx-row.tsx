import { TimelineItem } from "@hyperbridge/ui"
import type { AnyToken, NetworkConfig } from "@hyperbridge-fe/shared/types"
import { isPast } from "date-fns"
import { flow, pipe } from "effect"
import Countdown from "react-countdown"
import { safeDict } from "@/lib/data.helpers"
import {
  TFImpl,
  type TimelineEventTransformer,
} from "@/lib/timeline/timeline-event-transformer"
import { O } from "@/lib/utils/fp.helpers"
import type { LegacyTxStatusKey } from "@/types/tx"
import { DebugClick } from "@/components/utils/debug-click"
import If from "@/components/utils/if"

export function TTItem(props: {
  level: 0 | 1
  event: LegacyTxStatusKey
  token: Pick<AnyToken, "symbol" | "name" | "logo">
  eventTransfer: TimelineEventTransformer
}) {
  const { level = 0 } = props

  const tf = props.eventTransfer
  const status = tf.read_status

  const network = tf.network.pipe(O.getOrElse(() => ({}) as NetworkConfig))
  const message = tf.get_message()
  const transactionUrl = tf.transaction_url()

  const processingStatus = timelineStatusMap.strict(status)
  const countdown_to = TFImpl.eta_to_datetimestamp(tf)

  const badge = {
    badgeAlt: network?.name ?? "",
    badgeSrc: network?.logo ?? "",
    alt: props.token?.name,
    src: props.token?.logo,
  }

  const logInput = () => ({
    badge,
    processingStatus,
    id: tf.id,
    tx: tf.tx,
    network: network,
  })

  if (processingStatus === "completed") {
    return (
      <DebugClick input={logInput}>
        <TimelineItem
          caption={message.title}
          badge={badge}
          durationMode="visible"
          data={{
            completedIn: tf.eta_formatted,
            transactionUrl: transactionUrl ?? "#",
          }}
          level={level}
          processingStatus={"completed"}
        />
      </DebugClick>
    )
  }

  if (processingStatus === "error") {
    return (
      <DebugClick input={logInput}>
        <TimelineItem
          caption={message.title}
          badge={badge}
          level={0}
          processingStatus={"error"}
        />
      </DebugClick>
    )
  }

  if (processingStatus === "upcoming")
    return (
      <DebugClick input={logInput}>
        <TimelineItem
          badge={badge}
          level={level}
          durationMode="visible"
          caption={message.title}
          processingStatus={"upcoming"}
        />
      </DebugClick>
    )

  return (
    <DebugClick input={logInput}>
      <TimelineItem
        caption={message.title}
        badge={badge}
        level={level}
        durationMode="visible"
        secondary={message.caption ?? undefined}
        processingStatus={"processing"}
        data={{
          eta: pipe(
            countdown_to,
            O.map((eta) => (
              <TTItemCountdown key={"countdown_eta"} date={eta.toTimestamp} />
            )),
            O.getOrElse(() => ""),
          ),
        }}
      />
    </DebugClick>
  )
}

const timelineStatusMap = safeDict({
  map: {
    loading: "processing",
    waiting: "upcoming",
    success: "completed",
    timeout: "error",
  },
  default: "error",
})

export function TTItemCountdown({ date }: { date: Date | number }) {
  if (isPast(date)) {
    return null
  }

  return (
    <Countdown
      date={date}
      autoStart={true}
      renderer={(v) => {
        if (v.completed) return null

        const pad = flow(String, (str) => str.padStart(2, "0"))

        return (
          <span className="tabular-nums">
            <If cond={v.days > 0}>{pad(v.days)}:</If>
            <If cond={v.hours > 0}>{pad(v.hours)}:</If>
            {pad(v.minutes)}:{pad(v.seconds)}
          </span>
        )
      }}
    />
  )
}
