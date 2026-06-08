import { Polkadot_to_Bsc_Tx } from "@/lib/factories/__tests__/shared"
import {
  TFImpl,
  type TimelineEventTransformer,
} from "../timeline-event-transformer"
import { HyperbridgeFinalizedTET } from "../steps"
import { O } from "@/lib/utils/fp.helpers"
import { pipe } from "effect"

describe("TimlineEventTransformer", () => {
  it("returns the correct countdown date", () => {
    const tx = Polkadot_to_Bsc_Tx
    const tf = HyperbridgeFinalizedTET.create(tx)

    const output = pipe(
      TFImpl.eta_to_datetimestamp(tf as TimelineEventTransformer),
      O.getOrThrow,
    )

    expect(output).toMatchObject({
      etaDuration: 300000,
      toTimestamp: 1738769610721,
    })
  })
})
