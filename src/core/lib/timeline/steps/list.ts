import { pipe } from "effect"
import { memoize } from "lodash-es"
import { Arr } from "@/lib/utils/fp.helpers"
import type { ExplicitStatusKey, Transaction } from "@/types/tx"
import { DispatchTET } from "./01-dispatch"
import { SourceFinalizedTET } from "./02-source-finalized"
import { HyperbridgeVerifiedTET } from "./03-send-verified"
import { HyperbridgeFinalizedTET } from "./04-send-finalized"
import { DestinationTET } from "./05-destination"
import { RollbackDispatchTET } from "./06-rollback-dispatch"
import { RollbackDestinationFinalizedTET } from "./07-rollback-destination-finalized"
import { RollbackVerifiedTET } from "./08-rollback-verified"
import { RollbackFinalizedTET } from "./09-rollback-finalized"
import { RollbackTimedOutTET } from "./10-rollback-complete"

const events = [
  DispatchTET,
  SourceFinalizedTET,
  HyperbridgeVerifiedTET,
  HyperbridgeFinalizedTET,
  DestinationTET,
  RollbackDispatchTET,
  RollbackDestinationFinalizedTET,
  RollbackVerifiedTET,
  RollbackFinalizedTET,
  RollbackTimedOutTET,
]

const events_status_map = memoize(
  () => new Map(events.map((value) => [value.id, value])),
  () => "singleton",
)

export const EventTFMap = (tx: Transaction) => {
  return pipe(
    events,
    Arr.map((e) => {
      return [e.id, e.create(tx)] as const
    }),
    (e) => new Map(e),
  )
}

export const EventTFStore = {
  get: (status: ExplicitStatusKey) => {
    return events_status_map().get(status)
  },
}
