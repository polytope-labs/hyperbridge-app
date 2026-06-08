"use client"
import { Text, TimerWrap, TransactionTimer } from "@hyperbridge/ui"
import { format, isSameDay } from "date-fns/fp"
import { observer } from "mobx-react"
import { domAnimation, LazyMotion, m, type Variants } from "motion/react"
import React from "react"
import Countdown, { type CountdownRenderProps } from "react-countdown"
import { getTimeoutTimestamp, TxImpl } from "@/lib/factories/transaction"
import { toMilliseconds } from "@/lib/utils/date.helpers"
import { O, pipe } from "@/lib/utils/fp.helpers"
import { useTxTimeline } from "./context"

const TIMESTAMP_EMPTY: number = -1

export const TTCountdown = observer(function TransactionCountdown(
  props: Omit<React.ComponentProps<typeof Countdown>, "date"> & {
    severity: "warning" | "default"
  },
) {
  const { severity } = props
  const { tx, mode } = useTxTimeline()

  // stop running when transaction has timed/errored out
  const timestamp = getTimeoutTimestamp(tx).pipe(
    O.map((e) => Number(e)),
    O.getOrElse(() => TIMESTAMP_EMPTY),
  )

  const ref = React.useRef<Countdown>(null)
  const tx_completed = TxImpl.is_completed(tx, mode)
  const [show_timer, set_show_timer] = React.useState<boolean>(tx_completed)

  const start_time = React.useMemo(() => timestamp - Date.now(), [timestamp])
  const reversed_progress = ((timestamp - Date.now()) / start_time) * 100
  const actual_progress =
    reversed_progress < 100 ? 100 - reversed_progress : 100

  const date = toMilliseconds(Number(timestamp))

  const progress_ = tx_completed
    ? 100
    : // only render when IPOSTRequest has a ETA timestamp
      timestamp === TIMESTAMP_EMPTY
      ? 100
      : actual_progress

  React.useEffect(
    function startCountdown() {
      const api = ref.current?.api
      if (!api) return

      if (timestamp === TIMESTAMP_EMPTY) {
        api?.stop()
        return
      }

      api?.start()
      return
    },
    [timestamp],
  )

  return (
    <LazyMotion features={domAnimation}>
      <m.div
        variants={variants}
        initial={tx_completed ? "hide" : "show"}
        animate={!show_timer || actual_progress < 100 ? "show" : "hide"}
      >
        <Countdown
          ref={ref}
          {...props}
          date={date}
          autoStart={false}
          renderer={(v) => {
            return countdownRenderer({ ...v, progress: progress_, severity })
          }}
          onStart={() => set_show_timer(false)}
          onComplete={() => {
            set_show_timer(true)
          }}
        />
      </m.div>
    </LazyMotion>
  )
})

export function TTDuration() {
  const { tx, mode } = useTxTimeline()

  // only render transaction is complete
  if (TxImpl.is_completed(tx, mode)) return <TimelineCompletedTimestamp />

  if (TxImpl.is_timeout_finalized(tx)) return <TimelineCompletedTimestamp />

  return null
}

const variants: Variants = {
  hide: {
    marginTop: "-50%",
    opacity: 0,
    transition: { delay: 0.2 },
  },
  show: {
    marginTop: 0,
    opacity: 1,
    transition: { delay: 0 },
  },
}

function countdownRenderer({
  progress,
  hours,
  minutes,
  seconds,
  severity = "default",
}: CountdownRenderProps & {
  progress: number
  severity: "warning" | "default"
}) {
  // Render a countdown
  return (
    <TransactionTimer
      days={0}
      hours={hours}
      progress={progress}
      mins={minutes}
      seconds={seconds}
      severity={severity}
    />
  )
}

export function TTimerWrap(props: {
  children: React.ReactNode
  reveal?: boolean
}) {
  // const { tx } = useTxTimeline()

  // const is_finalized = TxImpl.is_timeout_finalized(tx)
  // const _is_processing_timeout = !(is_finalized || tx.completed)

  return (
    <TimerWrap
      // reveal={mode === "send" && !is_processing_timeout}
      reveal={false}
      Timer={<TTCountdown severity={"warning"} />}
    >
      {props.children}
    </TimerWrap>
  )
}

function TimelineCompletedTimestamp() {
  const { tx } = useTxTimeline()

  const from_timestamp = O.fromNullable(tx.createdAt)
  const to_timestamp = TxImpl.completed_at(tx)

  const format_range = pipe(
    O.all([from_timestamp, to_timestamp]),
    O.map(([from, to]) => {
      const from_format_str = isSameDay(from, to)
        ? "hh:mm"
        : "hh:mm a · MMM d, yyyy"

      return [
        format(from_format_str, from),
        format("hh:mm a · MMM d, yyyy", to),
      ]
    }),
    O.map((formats) => formats.join(" - ")),
  )

  if (O.isNone(format_range)) return null

  return (
    <Text className="text-brand-black-100 text-center" variant="caption">
      {format_range.value}
    </Text>
  )
}
