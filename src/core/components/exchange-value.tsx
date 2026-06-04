import { approximateFraction, safeObj } from "@hyperbridge-fe/shared"
import { pipe } from "effect"
import { isUndefined } from "effect/Predicate"
import React, { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import { isDevelopment } from "@/config/constants"
import { BalanceImpl } from "@/lib/factories/balance"
import { FiatImpl } from "@/lib/factories/fiat"
import { rootLogger } from "@/lib/logger"
import { shortValueFormatter } from "@/lib/utils/formatting"
import { O } from "@/lib/utils/fp.helpers"
import type { AppValue } from "@/types"
import { Loader } from "./common/Loader"
import If from "./utils/if"

type SharedProps = {
  /**
   * Relevant when mode is "approximate". Sets a fallback for very small value
   */
  minisculeValueFallback: React.ReactNode
  mode?: "approximate" | "default"
  formatter?: Intl.NumberFormat
  maximumFractionDigits?: number
  symbolView?: "hide" | "show"
}

/**
 * @todo: Unit test this component
 * @param props
 * @returns
 */
export function Value(
  props: {
    data: AppValue
  } & SharedProps,
) {
  const {
    formatter = shortValueFormatter,
    maximumFractionDigits: maxPrecision = 2,
    mode = "default",
    symbolView = "show",
  } = props

  const approximate = React.useMemo(
    () => approximateFraction(formatter),
    [formatter],
  )

  const data = safeObj(props.data)

  if ("currency_symbol" in data) {
    const formatter_options = formatter.resolvedOptions()
    const show_symbol =
      symbolView === "show" && isUndefined(formatter_options.currency)

    const is_approximate = mode === "approximate"

    if (
      is_approximate &&
      data.amount.toFixed(maxPrecision) === (0.0).toFixed(maxPrecision)
    ) {
      return props.minisculeValueFallback
    }

    if (is_approximate) {
      return (
        <>
          <span className="tabular-nums">{approximate(data.amount)}</span>
          &nbsp;
          <If cond={show_symbol}>{data.currency_symbol}</If>
        </>
      )
    }

    return (
      <>
        <span className="tabular-nums">
          {data.amount.toLocaleString("en-US", {
            ...formatter_options,
            currency: data.currency_symbol,
            style: "currency",
          })}
        </span>

        <If cond={show_symbol}>
          &nbsp;
          {data.currency_symbol}
        </If>
      </>
    )
  }

  return (
    <>
      <span className="tabular-nums">
        {BalanceImpl.formatUsing(data, formatter)}
      </span>
      <If cond={symbolView === "show"}>
        &nbsp;
        {data.symbol}
      </If>
    </>
  )
}

export function AsyncValueFallback(props: {
  value?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <ErrorBoundary
      fallback={props.value ?? <>{!isDevelopment ? "0.0" : "N/A"}</>}
      onError={rootLogger.error}
    >
      {props.children}
    </ErrorBoundary>
  )
}

type SuspenseProps = {
  suspend: boolean
  /**
   * Relevant when `suspend` is `true`. Sets a fallback value
   */
  suspenseFallback?: React.ReactNode
}

export function AsyncValue(
  props: {
    promise: Promise<O.Option<AppValue>> | PromiseLike<O.Option<AppValue>>
  } & SharedProps &
    SuspenseProps,
) {
  const component = <AsyncValueMain {...props} />
  const error_fallback = <>"--"</>
  const suspense_fallback = props.suspenseFallback ?? <Loader />

  if (props.suspend)
    return (
      <ErrorBoundary fallback={error_fallback}>
        <Suspense fallback={suspense_fallback}>{component}</Suspense>
      </ErrorBoundary>
    )

  return <ErrorBoundary fallback={error_fallback}>{component}</ErrorBoundary>
}

function AsyncValueMain(
  props: {
    promise: Promise<O.Option<AppValue>> | PromiseLike<O.Option<AppValue>>
  } & SharedProps,
) {
  const amount = React.use(props.promise)

  const default_value = pipe(
    amount,
    O.map(resolveEmpty),
    O.getOrElse(() => FiatImpl.asDollar(0)),
  )

  return (
    <Value
      {...props}
      data={pipe(
        amount,
        O.getOrElse(() => default_value),
      )}
    />
  )
}

function resolveEmpty(e: AppValue) {
  return e._tag === "fiat" ? FiatImpl.asDollar(0) : BalanceImpl.empty()
}

// function isAppBalance(data: unknown): data is AppValue {
//   // @ts-expect-error Tag
//   return data?._tag === "fiat" || data?._tag === "app-balance"
// }

// export function ValuePulsatingFallback(
//   props: Omit<React.ComponentProps<typeof Value>, "data"> & {
//     data?: unknown
//   },
// ) {
//   const last_value = React.useRef<AppValue>(null)
//   const data_ = props.data

//   if (!isAppBalance(data_) && last_value.current) {
//     return <Value key={"value"} {...props} data={last_value.current} />
//   }

//   if (!isAppBalance(data_)) {
//     return <span className="animate-pulse tabular-nums">0.0</span>
//   }

//   last_value.current = data_

//   return <Value key={"value"} {...props} data={last_value.current} />
// }
