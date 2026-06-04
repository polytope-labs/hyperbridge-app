import type { IComputedValue } from "mobx"
import { observer } from "mobx-react"
import { Suspense } from "react"
import { rootLogger } from "@/lib/logger"
import {
  currencyFormatter,
  shortTokenValueFormatter,
} from "@/lib/utils/formatting"
import { O } from "@/lib/utils/fp.helpers"
import type { AppValue, PartialProps } from "@/types"
import { AsyncValue, Value } from "../exchange-value"

export const ComputedTextValue = observer(function ComputedTextValue({
  computedValue,
}: {
  computedValue: IComputedValue<PromiseLike<AppValue>>
}) {
  return (
    <Suspense fallback={<span>-- </span>}>
      <AsyncValue
        suspend={false}
        promise={computedValue
          .get()
          .then(O.fromNullable)
          // @ts-expect-error Expecting PromiseLike to have a .catch method
          .catch((err) => {
            rootLogger.error(err)
            return O.none()
          })}
        minisculeValueFallback="0.00"
        formatter={currencyFormatter}
      />
    </Suspense>
  )
})

type ValueProps = React.ComponentProps<typeof Value>

type OmitProperty = "minisculeValueFallback"

export function TokenValue(props: PartialProps<ValueProps, OmitProperty>) {
  return (
    <Value
      minisculeValueFallback={"0.0001"}
      formatter={shortTokenValueFormatter}
      {...props}
    />
  )
}

export function AsyncTokenValue(
  props: PartialProps<React.ComponentProps<typeof AsyncValue>, OmitProperty>,
) {
  return (
    <AsyncValue
      minisculeValueFallback={"0.0001"}
      formatter={shortTokenValueFormatter}
      {...props}
    />
  )
}
