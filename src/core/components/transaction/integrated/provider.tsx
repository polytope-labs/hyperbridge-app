import { pipe } from "effect"
import { autorun, toJS } from "mobx"
import { observer } from "mobx-react"
import type { ReactNode } from "react"
import React from "react"
import { createProgressController } from "@/config/services/progress-controller.ts"
import { debugLogger } from "@/lib/logger"
import { TimelineStructure } from "@/lib/timeline/timeline-event-transformer"
import type { ExplicitStatusKey, LegacyTxStatusKey, TxMode } from "@/types/tx"
import { TxTimelineContext, type TxTimelineContextType } from "./context"

type Props = {
  tx: TxTimelineContextType["tx"]
  flow?: LegacyTxStatusKey[]
  mode?: TxMode
  children: ReactNode
}

export const TTProvider = observer(function TTProvider(props: Props) {
  const { tx, flow, mode, children } = props

  const controller = createProgressController(tx, mode)
  const tx_mode = controller.state.mode
  const activity_flow = flow ?? controller.flow

  const [, forceUpdate] = React.useState(() => toJS(tx))

  React.useEffect(() => {
    return autorun(() => {
      forceUpdate(toJS(tx))
      debugLogger.log("TxChange", Object.keys(tx.progress))
    })
  }, [tx])

  const nested_flow = pipe(
    activity_flow.map((e) => `${tx_mode}/${e}` as ExplicitStatusKey),
    TimelineStructure.group_to_list,
    TimelineStructure.list_to_tree,
    (_) => Array.from(_).filter((e) => e !== null),
  )

  debugLogger.trace("Re-rendered TTProvider")

  return (
    <TxTimelineContext.Provider
      value={{ tx, mode: tx_mode, flow: nested_flow, controller }}
    >
      {children}
    </TxTimelineContext.Provider>
  )
})
